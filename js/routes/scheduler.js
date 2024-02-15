console.log("loading scheduler services now...")
const { replace } = require('lodash')
const db = require('../db')
const express = require('express')
const fs = require ('fs')
const Joi = require('joi')
const moment = require('moment')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
router.use(express.json())

const { API_ACCESS_TOKEN } = process.env
const { 
  getUserLevel,
  isUrl,
  recordError,
  recordEvent,
  stringCleaner,
  validateSchema
} = require('../functions.js')

const calculateNextRun = ({ interval, starts }) => {

  const startsMoment = moment.unix(starts)
  const hour = startsMoment.hour()
  const minute = startsMoment.minute()
  const nowMoment = moment()

  if (interval == 1) { // Set nextRunTime to the next weekday after now
    
    const nowMomentX = +moment().format('X')
    nextRunTime = nowMoment.clone().hour(hour).minute(minute).second(0)

    while (nextRunTime.isoWeekday() >= 6 && +nextRunTime.format('X') < nowMomentX) { nextRunTime.add(1, 'days') }

  } else if (interval === 2) { // Set nextRunTime for the next day.

    nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

  } else if (interval == 3) { // Set nextRunTime to one week.

    nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

  } else if (interval == 4) { // Set nextRunTime to two weeks.

    nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

  } else if (interval == 5) { // Set nextRunTime to one month.

    nextRunTime = nowMoment.clone().add(1, 'months').day(dayOfWeek).hour(hour).minute(minute)

  } else if (interval == 6) { // Set nextRunTime to the first day of the next month.
  
    nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').hour(hour).minute(minute)

  } else if (interval == 7) { // Set nextRunTime to the first weekday of the next month.
  
    nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  } else if (interval == 8) { // Set nextRunTime to three months from now (quarterly).

    nextRunTime = nowMoment.clone().add(3, 'years').hour(hour).minute(minute)

  } else if (interval == 9) { // Set nextRunTime to the first day of the next quarter.
  
    nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').hour(hour).minute(minute)

  } else if (interval == 10) { // Set nextRunTime to the first weekday of the next quarter.
  
    nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').isoWeekday(1).hour(hour).minute(minute)

  } else if (interval == 11) { // Set nextRunTime to six months from now (semiannual).

    nextRunTime = nowMoment.clone().add(6, 'months').hour(hour).minute(minute)

  } else if (interval == 12) { // Set nextRunTime to the first day of the next semiannual.

    nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').hour(hour).minute(minute)

  } else if (interval == 13) { // Set nextRunTime to the first weekday of the next semiannual.

    nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  } else if (interval == 14) { // Set nextRunTime to one year from now.

    nextRunTime = nowMoment.clone().add(1, 'years').hour(hour).minute(minute)

  } else if (interval == 15) { // Set nextRunTime to the first day of the next year.

    nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').hour(hour).minute(minute)

  } else if (interval == 16) { // Set nextRunTime to the first weekday of the next year.

    nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  }
  
  return +nextRunTime.format('X')

}

const getUnsubs = async ({ errorNumber, nowRunning, userId }) => {

  const blockAll = []
  const getUnsubsSuccess = false
  const unsubs = {}

  let queryText = "SELECT contact_id FROM contacts WHERE block_all = true; SELECT contact_id, campaign_id FROM unsubs"
  let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

  if (!results) {

    const failure = 'database error when getting unsub information'
    await recordError ({
      context: `api: ${nowRunning}.getUnsubs`,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return({ getUnsubsFailure: failure, getUnsubsSuccess})
    
  }

  Object.values(results[0].rows).map(row => { blockAll.push(row.contact_id) }) // Contains all completely blocked contact IDs.

  Object.values(results[1].rows).map(row => {

    const {
      contact_id: contactId,
      campaign_id: campaignId
    } = row

    if (!unsubs[campaignId]) {

      unsubs[campaignId] = [contactId]
      blockAll.map(contactId => unsubs[campaignId].push(contactId))

    } else {

      unsubs[campaignId].push(contactId)

    }

  })

  return ({ blockAll, getUnsubsSuccess: true, unsubs }) 

}

const processCampaigns = async ({ apiTesting, campaignId, eligibleRecipients, errorNumber, messageContent, messageId, messageSubject, nextMessage, unsubUrl, userId }) => {

  const now = moment().format('X')
  const nowRunning = 'scheduler.js:processCampaigns'
  const success = false
  const { 
    getDynamicMessageReplacements,
    sendMail
  } = require ('../functions')

  // Get dynamic replacements (to be applied to messageContent).

  const {
    dynamicValues,
    failure: getDynamicValuesFailure,
    success: getDynamicValuesSuccess
  } = await getDynamicMessageReplacements({ errorNumber, messageId, userId })

  if (!getDynamicValuesSuccess) {

    console.log(nowRunning + ": exited due to error on function getDynamicMessageReplacements\n")
    return ({ failure: getDynamicValuesFailure, success })

  }

  // Dynamic values are inserted into the message content if nextMessage is not present, so all recipients are getting the same message.

  if (!nextMessage) {

    Object.values(dynamicValues).map(row => { 
      
      const newValue = stringCleaner(row.newValue)
      const targetName = stringCleaner(row.targetName)

      // The target string is programmatic c/o ChatGPT 3.5.

      const placeholderRegex = new RegExp(`\\[${targetName}\\]`, 'g')
      messageContent = replace(messageContent, placeholderRegex, newValue)

    })

  }

  Object.entries(eligibleRecipients).map(async row => {

    const contactId = row[0]
    const {
      contactName,
      email
    } = row[1]

    // IMPORTANT! right here is where we engage in message substitution if indicated.
    // When this is running, we have to updated messageContent for each user because it's NOT guaranteed to be the same on every iteration.

    if (nextMessage[contactId] && nextMessage[contactId] !== messageId) {

      const {
        content: replacementContent,
        messageId: replacementId,
        subject: replacementSubject
      } = nextMessage[contactId]
      messageContent = replacementContent
      messageId = replacementId
      messageSubject = replacementSubject

      // Use a template where specified by messageContent.

      if (messageContent.startsWith('template:')) messageContent = fs.readFileSync(`./assets/files/html/${messageContent.substring(9)}.html`, 'utf-8')

      // Insert the unsubscribe message.

      const placeholderRegex = new RegExp(`\\[UNSUB_MESSAGE\\]`, 'g')
      messageContent = replace(messageContent, placeholderRegex, `<p><a href="${unsubUrl}">Manage your subscription preferences here</a></p>`)

      // Dynamic values are inserted into the **replacement** messsage.

      Object.values(dynamicValues).map(row => { 
        
        const newValue = stringCleaner(row.newValue)
        const targetName = stringCleaner(row.targetName)

        // The target string is programmatic c/o ChatGPT 3.5

        const placeholderRegex = new RegExp(`\\[${targetName}\\]`, 'g')
        messageContent = replace(messageContent, placeholderRegex, newValue)

      })

    }

    // Perform all global replacements.

    messageContent = replace(messageContent, /\[CONTACT_NAME\]/g, contactName)

    // Send the mail now.

    const response = await sendMail (email, messageContent, messageSubject)
    const {
      body,
      statusCode
    } = response[0]

    let eventDetails

    if (statusCode == 200 || statusCode == 202) { // Record successful send event in message_tracking.

      queryText = `INSERT INTO message_tracking(campaign_id, contact_id, message_id, sent) VALUES('${campaignId}', '${contactId}', '${messageId}', '${+moment().format('X')}')`
      result = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

      if (!results.rows) { 

        const failure = 'database error when recording the send event'
        console.log(`${nowRunning}: ${failure}\n`)
        await recordError ({
          context: 'api: ' + nowRunning,
          details: queryText,
          errorMessage: failure,
          errorNumber,
          userId
        })
    
        return ({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })
    
      }
    
    } else {

      // Start with the basics of what's running right now.

      eventDetails = `Sendgrid reported statusCode: ${statusCode} and (${body?.errors.length}) error(s) while sending to ${contactName}, ${email}, ${contactId}:`

      // Append all error messages to the details.

      try {
        
        response.body.errors.map(row => {  eventDetails += `\nmessage: ${row.message}` })

      } catch(e) {} // No errors to append.

      // Record the errors on this send to the event log (not the errors API).

      recordEvent ({ apiTesting, event: 4, eventDetails, eventTarget: campaignId, userId })

    }
    
  })

  // Before exiting, update the dynamic values just used, so they flow to the end of the rotation.

  queryText = ''

  Object.keys(dynamicValues).map(value => { queryText += `UPDATE dynamic_values SET last_used = ${now} WHERE dynamic_id = '${value}';` })

  results = await db.transactionRequired(queryText, errorNumber, nowRunning, apiTesting)

  if (!results) { 

    const failure = 'database error when updating the last_run parameter on dynamic values used on this campaign run'
    console.log(`${nowRunning}: ${failure}\n`)
    await recordError ({
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })

    return ({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })

  }

  return ({ campaignsProcessedFailure: false, campaignsProcessedSuccess: true, })

}

router.post("/run", async (req, res) => { 

  const nowRunning = "/campaigns/run"
  console.log(`${nowRunning}: running`)
  const errorNumber = 41
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean(),
      masterKey: Joi.any()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    const { apiTesting } = req.body
    const userId = API_ACCESS_TOKEN // We need a user ID but this runs as a crontab job.

    // Get all campaigns that have a message that is eligible to run now.

    let queryText = `SELECT c.campaign_id, c.campaign_name, c.campaign_repeats, c.ends, c.interval, c.list_id, c.message_series, c.next_run, c.starts, c.unsub_url, cm.position, m.content, m.message_id, m.message_name, m.repeatable, m.subject FROM campaigns c, campaign_messages cm, messages m WHERE c.active = true AND (c.next_run <= ${moment().format('X')} OR c.next_run IS NULL) AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id AND m.active = true ORDER BY last_sent, position`
    let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when getting all campaigns'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    const eligibleCampaigns = results.rows
    const campaignLimiter = [] // This will be used below to prevent sending more than 1 eligible message per a campaign send cycle.

    const setNextRun = async({ apiTesting, campaignId, ends, interval, starts }) => {

      let nextRunTime

      // Convert starts to a Moment object and extract hour and minute
    
      const startsMoment = moment.unix(starts)
      const dayOfWeek = startsMoment.day()
      const hour = startsMoment.hour()
      const minute = startsMoment.minute()
      const nowMoment = moment()

      if (interval == 1) { // Set nextRunTime to the next weekday after now
        
        nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

        while (nextRunTime.isoWeekday() >= 6) { nextRunTime.add(1, 'days') }
   
      } else if (interval === 2) { // Set nextRunTime for the next day

        nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

      } else if (interval == 3) { // Set nextRunTime to one week

        nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

      } else if (interval == 4) { // Set nextRunTime to two weeks

        nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

      } else if (interval == 5) { // Set nextRunTime to one month

        nextRunTime = nowMoment.clone().add(1, 'months').day(dayOfWeek).hour(hour).minute(minute)

      } else if (interval == 6) { // Set nextRunTime to the first day of the next month
      
        nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').hour(hour).minute(minute)

      } else if (interval == 7) { // Set nextRunTime to the first weekday of the next month
      
        nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)
    
      } else if (interval == 8) { // Set nextRunTime to three months from now (quarterly)

        nextRunTime = nowMoment.clone().add(3, 'years').hour(hour).minute(minute)

      } else if (interval == 9) { // Set nextRunTime to the first day of the next quarter
      
        nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').hour(hour).minute(minute)

      } else if (interval == 10) { // Set nextRunTime to the first weekday of the next quarter
      
        nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').isoWeekday(1).hour(hour).minute(minute)
    
      } else if (interval == 11) { // Set nextRunTime to six months from now (semiannual)

        nextRunTime = nowMoment.clone().add(6, 'months').hour(hour).minute(minute)
    
      } else if (interval == 12) { // Set nextRunTime to the first day of the next semiannual

        nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').hour(hour).minute(minute)
    
      } else if (interval == 13) { // Set nextRunTime to the first weekday of the next semiannual

        nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

      } else if (interval == 14) { // Set nextRunTime to one year from now

        nextRunTime = nowMoment.clone().add(1, 'years').hour(hour).minute(minute)
    
      } else if (interval == 15) { // Set nextRunTime to the first day of the next year

        nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').hour(hour).minute(minute)
    
      } else if (interval == 16) { // Set nextRunTime to the first weekday of the next year

        nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').isoWeekday(1).hour(hour).minute(minute)

      }

      nextRunTime = +moment(nextRunTime).format('X')

      // If the campaign has already ended, we do NOT want to update the run time and have it trigger again next interval

      if (nextRunTime > ends) {

        const eventDetails = 'The next run time for this campaign exceeded the campaign end time, so it was not renewed.'
        recordEvent ({ apiTesting, event: 2, eventDetails, eventTarget: campaignId, userId })
        return { setNextRunFailure: failure, setNextRunSuccess: true }

      }

      // Set the next scheduled run time

      const queryText = `UPDATE campaigns SET next_run = ${nextRunTime} WHERE campaign_id = '${campaignId}'`
      const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

      if (!results.rows) {

        const failure = `database error when updating the next run time for campaign ${campaignId}`
        console.log(`${nowRunning}: ${failure}\n`)
        await recordError ({
          context: `api: ${nowRunning}`,
          details: queryText,
          errorMessage: failure,
          errorNumber,
          userId
        })
        return { setNextRunFailure: failure, setNextRunSuccess: false }
        
      }

      const eventDetails = `The next run time for this campaign was set to ${moment.unix(nextRunTime).format('YYYY.MM.DD HH.mm')}`
      recordEvent ({ apiTesting, event: 2, eventDetails, eventTarget: campaignId, userId })
      return { setNextRunSuccess: true }

    }

    // Get all blocked contacts and unsubscribes now because they will be used to filter the lists below.

    const {
      blockAll,
      getUnsubsFailure,
      getUnsubsSuccess,
      unsubs
    } = await getUnsubs({ errorNumber, nowRunning, userId })

    if (!getUnsubsSuccess) {

      console.log(`${nowRunning}: exiting due to failure in unSubs\n`)
      return res.status(200).send({ failure: getUnsubsFailure, success })

    }

    const processCampaignsPromises = eligibleCampaigns.map(async (row) => {
      
      try {        

        // Get the campaign parameters and the next message in line to send.

        let {
          campaign_id: campaignId,
          campaign_name: campaignName,
          campaign_repeats: campaignRepeats,
          content: messageContent,
          ends,
          interval,
          list_id: listId,
          message_id: messageId,
          repeatable,
          starts,
          subject: messageSubject,
          unsub_url: unsubUrl
        } = row

        console.log('campaignLimiter', campaignLimiter)
        console.log(`campaignId: ${campaignId}`)

        // Sometimes there will be N > 1 messages waiting to run on a campaign cycle, but we need to not send more than one per interval.

        if (campaignLimiter.includes(campaignId)) {

          console.log(`${nowRunning}: campaign ${campaignId} was limited to sending just one message per cycle`)
          return { campaignsProcessedSuccess: true } // Note that allCampaignsProcessedResults will only have this single value when the limiter is invoked.

        }

        campaignLimiter.push(campaignId) // prevents the campaign from sending any more emails on this run

        // Check for a valid unsubscribe URL.

        if (!isUrl(unsubUrl)) {

          const eventDetails = `campaign: <b>${campaignName}</b>, id: <b>${campaignId}</b>, unsub link: <b>${unsubUrl}</b>`
          recordEvent ({ apiTesting, event: 9, eventDetails, eventTarget: campaignId, userId })
          return {
            campaignId,
            messageId: row.message_id,
            campaignsProcessedFailure: 'the campaign does not have a valid unsubscribe link',
            campaignsProcessedSuccess: false
          }

        }

        // Use a template where specified by messageContent.

        if (messageContent.startsWith('template:')) messageContent = fs.readFileSync(`./assets/files/html/${messageContent.substring(9)}.html`, 'utf-8')

        // Check for a placeholder to insert the unsub link.

        if (!messageContent.includes('[UNSUB_MESSAGE]')) {

          const eventDetails = `campaign: <b>${campaignName}</b>, id: <b>${campaignId}</b>, message ID: <b>${messageId}</b>`
          recordEvent ({ apiTesting, event: 10, eventDetails, eventTarget: campaignId, userId })
          return {
            campaignId,
            messageId: row.message_id,
            campaignsProcessedFailure: 'the message content does not contain the [UNSUB_MESSAGE] placeholder',
            campaignsProcessedSuccess: false
          }

        }

        // Insert the unsubscribe message.

        const placeholderRegex = new RegExp(`\\[UNSUB_MESSAGE\\]`, 'g')
        messageContent = replace(messageContent, placeholderRegex, `<p><a href="${unsubUrl}">Manage your subscription preferences here</a></p>`)

        // Filter the mailing list and make sure there is at least one valid recipient.

        const eligibleRecipients = {}

        // Get all contacts on the mailing list that are active.

        queryText = `SELECT c.company_name, c.contact_id, c.contact_name, c.email FROM contacts c, list_contacts lc WHERE c.active = true AND c.contact_id = lc.contact_id AND lc.list_id = '${listId}' ORDER BY contact_name`
        results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

        if (!results) {

          const failure = `database error when list contacts for list ${listId}`
          console.log(`${nowRunning}: ${failure}\n`)
          await recordError ({
            context: `api: ${nowRunning}`,
            details: queryText,
            errorMessage: failure,
            errorNumber,
            userId
          })
          return res.status(200).send({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })

        }

        // Filter blocked and unsubscribed contacts.

        Object.values(results.rows).map(row => {

          let {
            company_name: companyName,
            contact_id: contactId,
            contact_name: contactName,
            email,
          } = row

          if (!blockAll.includes(contactId) && !unsubs[campaignId]?.contactId) {

            if (companyName) contactName += ': ' + companyName

            eligibleRecipients[contactId] = {
              email,
              contactName: stringCleaner(contactName)
            }

          }

        })

        // When the campaign is not repeating, we need to filter out contacts that have seen every message already and set a specific message (first unseen one).

        const nextMessage = {} // Will hold the next message to be sent to each recipient

        if (Object.keys(eligibleRecipients).length > 0 && !campaignRepeats) {

          const alreadySent = {} // Will hold messages already sent to each contact.
          const availableMessages = [] // Will hold all active messages in this campaign.
          const messageIds = [] // Will hold message ids in position order.

          // Get all campaign messages ordered by position and message tracking info for this campaign.

          queryText = `SELECT message_id FROM campaign_messages WHERE campaign_id = '${campaignId}' ORDER BY position; SELECT contact_id, message_id FROM message_tracking WHERE campaign_id = '${campaignId}'`
          results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

          if (!results) {

            const failure = `database error when getting messages and tracking info for campaign ${campaignId}`
            console.log(`${nowRunning}: ${failure}\n`)
            await recordError ({
              context: `api: ${nowRunning}`,
              details: queryText,
              errorMessage: failure,
              errorNumber,
              userId
            })
            return({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })

          }

          Object.values(results[0].rows).map(row => messageIds.push(row.message_id))

          Object.values(results[1].rows).map(row => {

            const {
              contact_id: contactId,
              message_id: messageId
            } = row

            if (!alreadySent[contactId]) alreadySent[contactId] = []

            alreadySent[contactId].push(messageId)

          })
        
          // Get every active message on the campaign and store in available messages (ordered by position).

          queryText = `SELECT m.content, m.message_id, m.message_name, m.subject FROM campaign_messages cm, messages m WHERE cm.campaign_id = '${campaignId}' AND cm.message_id = m.message_id AND m.active = true ORDER BY position`
          results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

          if (!results) {

            const failure = `database error when getting messages and tracking info for campaign ${campaignId}`
            console.log(`${nowRunning}: ${failure}\n`)
            await recordError ({
              context: `api: ${nowRunning}`,
              details: queryText,
              errorMessage: failure,
              errorNumber,
              userId
            })
            return({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })

          }

          Object.values(results.rows).map(row => {

            const {
              content,
              message_id: messageId,
              message_name: messageName,
              subject
            } = row

            availableMessages.push({
              content: stringCleaner(content),
              messageId,
              messageName: stringCleaner(messageName),
              subject: stringCleaner(subject)
            })

          })

          // Now check every member of the eligibleRecipients list to see if they have seen every available message.

          Object.keys(eligibleRecipients).map(contactId => {

            if (!alreadySent[contactId]) { // This contact has not seen anything, and is sent the first message.

              nextMessage[contactId] = availableMessages[0]
            
            } else { // Need to filter out what they have already seen.

              availableMessages.map(messageData => {

                if (nextMessage[contactId]) return // This contact has already been assigned a message for this run.

                if (alreadySent[contactId].includes(messageData.messageId)) return // This contact has already seen this message.
              
                nextMessage[contactId] = messageData // Assign this message because they've never seen it.
                
              })
            
            }

            if (!nextMessage[contactId]) delete eligibleRecipients[contactId] // This contact has no message available.

          })

        }

        // Exit now if there are no eligible recipients.

        if (Object.keys(eligibleRecipients).length === 0) {  

          const eventDetails = `${nowRunning}: campaign ${campaignId} was skipped, no eligible recipients`
          recordEvent ({ apiTesting, event: 1, eventDetails, eventTarget: campaignId, userId })
          return {
            campaignId,
            messageId,
            noEligibleRecipients: true,
            campaignsProcessedSuccess: true
          }
          
        }

        // The campaign message will be sent to the mailing list after additional processing, see processCampaigns.
    
        const {
          campaignsProcessedFailure,
          campaignsProcessedSuccess
        } = await processCampaigns({
          campaignId,
          eligibleRecipients,
          errorNumber,
          messageContent: stringCleaner(messageContent),
          messageId,
          messageSubject: stringCleaner(messageSubject),
          nextMessage, // only used when the campaign is not repeating
          unsubUrl,
          userId
        })
        
        // If the campaign is repeatable, setting last_sent moves the current message to the end of the eligible messages list.

        if (repeatable) { 

          queryText = `UPDATE campaign_messages SET last_sent = ${+moment().format('X')} WHERE message_id = '${messageId}' AND campaign_id = '${campaignId}';`
          results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

          if (!results) {

            const failure = `database error when moving the just sent message to the end of the list for this campaign`
            console.log(`${nowRunning}: ${failure}\n`)
            await recordError ({
              context: `api: ${nowRunning}`,
              details: queryText,
              errorMessage: failure,
              errorNumber,
              userId
            })
            return res.status(200).send({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })
            
          }

        }

        // Set the next run time for this campaign.

        const {
          setNextRunFailure,
          setNextRunSuccess
        } = await setNextRun({ apiTesting, campaignId, ends, interval, starts })

        if (!setNextRunSuccess) return { campaignsProcessedFailure: setNextRunFailure, campaignsProcessedSuccess: false }
    
        // Log or handle the successful campaign processing (to be replaced with history).

        const eventDetails = `${nowRunning}: campaign ${campaignId} processed successfully`
        recordEvent ({ apiTesting, event: 3, eventDetails, eventTarget: campaignId, userId })
    
        return {
          campaignId,
          messageId: row.message_id,
          campaignsProcessedFailure,
          campaignsProcessedSuccess
        }

      } catch (error) {

        console.error(`${nowRunning}: campaign ${row.campaign_id} processing failed:`, error)

        return {
          campaignId: row.campaign_id,
          messageId: row.message_id,
          campaignsProcessedFailure: error.message,
          campaignsProcessedSuccess: null
        }

      }

    })
    
    // Creates an array of the results of processing each eligible campaign.

    const allCampaignsProcessedResults = await Promise.all(processCampaignsPromises)

    // This returns true only if every campaign processed with no error.
  
    const allCampaignsProcessed = allCampaignsProcessedResults.every((result) => !result.campaignsProcessedFailure)
  
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ success: true, allCampaignsProcessed, allCampaignsProcessedResults })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e) 
    res.status(500).send(newException)

 }

})

router.post("/upcoming", async (req, res) => { 

  const nowRunning = "/scheduler/upcoming"
  console.log(`${nowRunning}: running`)

  const errorNumber = 45
  const success = false
  const { intervals } = require('../assets/static.json')

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { userId } = req.body
    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // Get unsubs first, because they are not counted as subscribers.

    const {
      getUnsubsFailure,
      getUnsubsSuccess,
      unsubs
    } = await getUnsubs({ errorNumber, nowRunning, userId })

    if (!getUnsubsSuccess) {

      console.log(`${nowRunning}: exiting due to failure in unSubs\n`)
      return res.status(200).send({ failure: getUnsubsFailure, success })

    }    
    
    const upcoming = {}
    let queryText = `SELECT c.campaign_id, c.campaign_name, c.ends, c.interval, c.next_run, c.starts, m.message_id, m.message_name FROM campaigns c, campaign_messages cm, lists l, messages m WHERE c.active = true AND c.ends > ${moment().format('X')} AND c.list_id = l.list_id AND l.active = true AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id ORDER BY next_run, campaign_name`
    let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when getting all upcoming campaigns'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    Object.values(results.rows).map(row => {

      let {
        campaign_id: campaignId,
        campaign_name: campaignName,
        ends,
        interval,
        message_id: messageId,
        message_name: messageName,
        next_run: nextRun,
        starts        
      } = row

      if (nextRun < 1) nextRun = calculateNextRun({ interval, starts })
      
      if (!upcoming[campaignId]) {

        upcoming[campaignId] = {
          campaignName,
          ends: +ends,
          ends2: moment.unix(ends).format('YYYY.MM.DD HH.mm'),
          interval: +interval,
          interval2: intervals[interval],
          messageId,
          messageName: stringCleaner(messageName),
          nextRun: +nextRun,
          nextRun2: moment.unix(nextRun).format('YYYY.MM.DD HH.mm'),
          starts: +starts,
          starts2: moment.unix(starts).format('YYYY.MM.DD HH.mm'),
          targets: 0
        }

      }

    })

    queryText = "SELECT c.campaign_id, lc.contact_id, lc.list_id FROM campaigns c, list_contacts lc WHERE c.active = true AND c.list_id = lc.list_id"
    results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when all list contacts'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    Object.values(results.rows).map(row => {

      const {
        campaign_id: campaignId,
        contact_id: contactId,
        list_id: listId
      } = row

      if (!unsubs[listId]) {

        upcoming[campaignId].targets += 1

      } else if (!unsubs[listId].includes(contactId)) {
        
        upcoming[campaignId].targets += 1

      }

    })

    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ upcoming, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e) 
    res.status(500).send(newException)

  }

})

module.exports = router
console.log('scheduler services loaded successfully!')