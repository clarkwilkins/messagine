const { replace } = require('lodash');
const fs = require ('fs');
const moment = require('moment-timezone');
const request = require('request');
const {
  API_ACCESS_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_OFF,
  SENDGRID_SENDER
} = process.env

// deactive all currently disqualified campaigns

exports.checkCampaigns = async (errorNumber, userId) => {

  const db = require('./db')
  const now = moment().format('X')
  const nowRunning = 'functions.js:checkCampaigns'
  const queryText = " UPDATE campaigns SET active = false WHERE (list_id NOT IN (SELECT list_id FROM lists WHERE active = true) OR ends < " + now + ") RETURNING campaign_id; "
  const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId)

  if (!results.rows) {
    
    recordError ({
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return { failure: 'campaign testing failed due to a database error', success: false }

  }

  const closedCampaigns = []

  Object.values(results.rows).map(row => { closedCampaigns.push(row.campaign_id) })

  return { closedCampaigns, success: true }

}

exports.containsHTML = string => { // c/o ChatGPT 3.5

  const htmlRegex = /<[^>]+>/g
  return htmlRegex.test(string)

}

exports.dateToTimestamp = date => {

  date = replace(date, /GMT/, '')
  date = date.substring(0, 30); // remove everything after the timezone
  date = +moment(date, 'DDD MMM YYYY HH:mm:ss Z').format('X')
  return date
  
}

exports.deleteCampaignMessage = async({ apiTesting, campaignId, errorNumber, messageId, position, userId }) => {

  const db = require('./db')
  const nowRunning = 'functions.js:deleteCampaignMessage'
  const { 
    recordError,
    recordEvent,
    stringCleaner
  } = require ('./functions')

  let queryText = `DELETE FROM campaign_messages WHERE campaign_id = '${campaignId}' AND message_id = '${messageId}'`;
 
  // this is just in case we have N > 1 of the same message for some reason and want to remove a specific instance

  if (+position) queryText += ` AND position = ${position}`;

  queryText += ` RETURNING *; SELECT message_name FROM messages WHERE message_id = '${messageId}'; `
  let results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

  if (!results[0].rows) {

    const failure = 'database error when deleting a campaign message link'
    console.log(`${nowRunning}: ${failure}\n`)
    await recordError ({
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return ({ deleteCampaignMessageFailure: failure, deleteCampaignMessageSuccess: false })

  }

  const messageName = stringCleaner(results[1].rows[0].message_name, true);
  const eventDetails = `The message ${messageName} was removed.`
  await recordEvent({ apiTesting, event: 6, eventDetails, eventTarget: campaignId, userId })

  queryText = `SELECT * FROM campaign_messages WHERE campaign_id = '${campaignId}' ORDER BY position;`
  results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting);

  if (!results.rows) {

    const failure = 'database error when getting remaining campaign messages';
    console.log(`${nowRunning}: ${failure}\n`)
    recordError ({
      context: `api: ${nowRunning}`,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return ({ deleteCampaignMessageFailure: failure, deleteCampaignMessageSuccess: false })
    
  }

  // if there are any remaining messages, they are now renumbered

  if (results.rowCount > 0) {

    queryText = `DELETE FROM campaign_messages WHERE campaign_id = '${campaignId}';`

    Object.values(results.rows).map((row, key) => {

      const {
        campaign_id: campaignId,
        message_id: messageId,
        last_sent: lastSent
      } = row;
      const position = +key + 1;
      queryText += ` INSERT INTO campaign_messages(campaign_id, message_id, last_sent, position) VALUES('${campaignId}', '${messageId}', ${+lastSent}, ${position});`

    })

    results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting);

    if (!results) {

      const failure = 'database error when repositiong remaining messages in the campaign';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return ({ deleteCampaignMessageFailure: failure, deleteCampaignMessageSuccess: false })
      
    }

  }

  return({ deleteCampaignMessageSuccess: true })

}

exports.getDynamicMessageReplacements = async ({ campaignId, errorNumber, userId }) => {

  const db = require('./db')
  const nowRunning = 'functions.js:getDynamicMessageReplacements'
  const success = false
  const { 
    containsHTML,
    recordError,
    stringCleaner
  } = require ('./functions')

  const queryText = `SELECT DISTINCT ON (target_name) * FROM dynamic_values WHERE message_id IN ( SELECT message_id FROM campaign_messages WHERE campaign_id = '${campaignId}') ORDER BY target_name, last_used`
  console.log(queryText)
  const results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

  if (!results?.rows) {

    const failure = 'database error when getting dynamic values records'
    console.log(`${nowRunning}: ${failure}\n`)
    recordError ({
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return ({ failure, success })
    
  }

  const dynamicValues = {}

  Object.values(results.rows).map(row => {

    const {
      dynamic_id: dynamicId,
      message_id: messageId,
      new_value: newValue,
      target_name: targetName
    } = row

    // This object has to account for multiple sets of dynamic values based on each specific message ID. The use-case is a non-repeating campaign where some users may get one message, and others, another. In this, different sets of dynamic values are possible.

    if (!dynamicValues[messageId]) dynamicValues[messageId] = {}
    
    dynamicValues[messageId][dynamicId] = { 
      newValue: stringCleaner(newValue, false, !containsHTML(newValue)),
      targetName: stringCleaner(targetName)
    }

  })

  return ({ dynamicValues, success: true })

}

// getUserLevel was rewritten by ChatGPT 3.5 to throttle it and add better error handling.

exports.getUserLevel = (() => {

  const throttledUsers = {}; // Store throttled users and their last execution time

  return async (userId) => {

    const nowRunning = "functions/getUserLevel"
    const currentTime = Date.now()

    if (throttledUsers[userId] && currentTime - throttledUsers[userId].lastExecutionTime < 60000) {

      console.log(nowRunning + ": throttled for user " + userId)
      return { level: throttledUsers[userId].cachedLevel }
    }

    console.log(nowRunning + ": started")

    const db = require('./db')

    try {

      const query = {
        text: "SELECT level FROM users WHERE user_id = $1 AND active = true",
        values: [userId]
      }

      const { rows } = await db.noTransaction(query)

      if (rows.length === 0) {

        console.log(nowRunning + ": user " + userId + " not found or inactive")
        return { level: throttledUsers[userId] ? throttledUsers[userId].cachedLevel : 0 }

      }

      const level = rows[0].level

      throttledUsers[userId] = {
        lastExecutionTime: currentTime,
        cachedLevel: level
      }

      console.log(nowRunning + ": finished")
      return { level }

    } catch (error) {

      console.error(nowRunning + ": error", error)
      return { level: throttledUsers[userId] ? throttledUsers[userId].cachedLevel : 0 }

    }

  }

})()

exports.getUsers = async () => {

  const nowRunning = "functions/getUsers"
  console.log(nowRunning + ": started")
  
  const db = require('./db')
  const { stringCleaner } = require("./functions")

  let { rows } = await db.noTransaction(" SELECT user_id, user_name FROM users ")
  let userList = {}

  Object.values(rows).map(theRow => { userList[theRow.user_id] = stringCleaner(theRow.user_name); })

  console.log(nowRunning + ": finished");  
  return ({ userList })

}

exports.isUrl = string => {

  var urlRegex = /^(https?|ftp):\/\/(-\.)?([^\s\/?\.#-]+\.?)+(\/[^\s]*)?$/i;
  return urlRegex.test(string);

}

exports.randomString = () => { // c/o ChatGPT3.5

  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz'
  const numberChars = '0123456789'

  const randomUppercase = uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)]
  const randomLowercase = lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)]
  const randomNumber = numberChars[Math.floor(Math.random() * numberChars.length)]

  const randomChars = uppercaseChars + lowercaseChars + numberChars
  let randomString = randomUppercase + randomLowercase + randomNumber

  for (let i = 0; i < 5; i++) { // inser an additional five random characters

    const randomChar = randomChars[Math.floor(Math.random() * randomChars.length)]
    randomString += randomChar

  }

  // shuffle the string to make it more random

  randomString = randomString.split('').sort(() => Math.random() - 0.5).join('')

  return randomString

}

exports.recordEvent = async({ apiTesting, event, eventDetails, eventTarget, userId }) => {

  const db = require('./db')
  const errorNumber = 44
  const now = moment().format('X')
  const nowRunning = 'functions.js:recordEvent'
  const { 
    recordError,
    stringCleaner
  } = require ('./functions')

  try { 

    const queryText = " INSERT INTO events (event_details, event_target, event_time, event_type, user_id) VALUES('" + stringCleaner(eventDetails, true) + "', '" + eventTarget + "', " + now + ", " + event + ", '" + userId + "'); "
    const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

    if (!results) {

      const failure = 'database error when trying to record an event'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ({
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })

    }


  } catch (e) {

    await recordError ({
      context: 'api: ' + nowRunning,
      details: 'exception thrown',
      errorMessage: e.message,
      errorNumber,
      userId
    })
    console.log(`${nowRunning}: ${e.message}\n`)

  }

}

exports.recordError = async data => { // data should be { context, details, errorMessage, errorNumber, userId }

  const nowRunning = 'functions/recordError'
  console.log (nowRunning + ': started')

  try {

    const {
      SANDBOX: sandbox,
      SIMPLEXABLE_API: host,
      SIMPLEXABLE_API_TOKEN: masterKey,
      SIMPLEXABLE_PLATFORM: platform
    } = process.env

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // avoids having node crash when we make the request

    request.post(
      {
        url: host + '/errors/record',
        json: {
          ...data,
          masterKey,
          platform,
       },
        headers: {
          'Content-Type': 'application/json',
       },
     }

  )

    console.log (nowRunning + ': finished')
    return({ success: true });    

 } catch(e) {

    console.log (nowRunning + ': failed with an exception: ', e)
    return ({ success: false })

 }

}

exports.sendMail = async (addressee, html, subject, testMode) => { 

  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(SENDGRID_API_KEY)
  let emailResults = null

  try {

    if (SENDGRID_OFF && !testMode) {
      
      emailResults = [ { statusCode: 200, status: 'Email is disabled by SENDGRID_OFF' } ]
      return emailResults

   }

    testMode ? addressee = 'simplexable@gmail.com' : null

    const text = 'Please read this email in a HTML-capable browser.'
    const sender = SENDGRID_SENDER
    console.log( `Sending ${subject} to ${addressee} @ ${moment().format('YYYY.MM.DD HH.mm.ss')}`)
    emailResults = await sgMail.send({ to: addressee, html, from: sender, subject, text })

    // The next line is useful if we want to comment out the Sendgrid API above for test purposes.

    // emailResults = [ { statusCode: 200, status: 'Sendmail bypassed' } ]

  } catch(e) {

    console.log('Sendgrid errors', e.response.body.errors)
    console.log('e', e)
    emailResults = [ { statusCode: 200, status: 'Sendmail threw a local exception: ' + e.message } ]

  }

  return emailResults
  
}

exports.stringCleaner = (string, toDb, nl2br) => {

  if (!toDb) string = replace(replace(string, /""/g, '"'), /''/g, "'").trim()

  if (toDb) string = replace(replace(string, /"/g, '""'), /'/g, "''").trim()

  if (nl2br) string = replace(string, /\n/g, '<br />')

  return string

}

exports.updateDynamicText = ({ dynamicValues, messageContent }) => {

  // Exit now if this was called for no reason.
  
  if (!dynamicValues || Object.keys(dynamicValues).length < 1) return messageContent

  const { stringCleaner } = require ('./functions')

  Object.values(dynamicValues).map(row => { 
        
    const newValue = stringCleaner(row.newValue)
    const targetName = stringCleaner(row.targetName)

    // The target string is programmatic c/o ChatGPT 3.5.

    const placeholderRegex = new RegExp(`\\[${targetName}\\]`, 'g')
    messageContent = replace(messageContent, placeholderRegex, newValue)

  })

  return messageContent

}

exports.validateSchema = (nowRunning, recordError, req, schema) => {

  try {

    var { error } = schema.validate (req.body)

    if (error) {

      const errorMessage = 'validation error: ' + error.details[0].message
      recordError ({
        context: 'api: ' + nowRunning,
        details: null,
        errorMessage,
        errorNumber: -1,
        userId: req.body.userId
     })
      return errorMessage
    
   }
    

  } catch (e) { console.log (nowRunning + ': failed with an exception: ', e); }  
  
}

exports.validateUUID = (string) => {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi

  return regexExp.test(string)

}