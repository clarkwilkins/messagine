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
  const dayOfWeek = startsMoment.day() // all weekly intervals start on the same day as the campaign start value

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

const checkSchedule = async({ campaignId, campaignRepeats, errorNumber, listId, nowRunning, userId }) => {

  const checkScheduleSuccess = false

  // Get all contacts on the campaign's mailing list that are actually eligible to receive a message from this campaign.

  let queryText = `SELECT contact_id FROM contacts WHERE active = true AND block_all = false AND contact_id NOT IN (SELECT contact_id FROM unsubs WHERE campaign_id = '${campaignId}') AND contact_id IN (SELECT contact_id FROM list_contacts WHERE list_id = '${listId}') ORDER BY contact_name, company_name`
  let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

  if (!results) {

    const failure = 'database error when getting unsub information'
    await recordError ({
      context: `api: ${nowRunning}.getUnsubs`,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })

    return({ checkScheduleFailure: failure, checkScheduleSuccess})
    
  }

  // Initially, we consider everyone on the list (active, not blocked, not unsubscribed) as eligible for the next message.
  // campaignMessages: the message content and name for each campaign-linked message.
  // messageTargets: the final list of all contacts that will get a message, along with all message parameters.
  // unseenMessages: used in non-repeating lists to determine if a linked contact has any eligible messages.

  const campaignMessages = {}
  const messageTargets = {}
  const unseenMessages = {}

  Object.values(results.rows).map(row => { messageTargets[row.contact_id] = { eligible: true } })

  // Get the campaign messages for this campaign. Position ordering allows us to end up with the next message to be sent (if any) in the first position.

  queryText = `SELECT m.content, m.message_id, m.message_name FROM campaign_messages cm, messages m WHERE cm.campaign_id = '${campaignId}' AND cm.message_id = m.message_id ORDER BY last_sent, cm.position`
  results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

  if (!results) {

    const failure = 'database error when getting the messages on this campaign'
    await recordError ({
      context: `api: ${nowRunning}.getUnsubs`,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })

  }

  Object.values(results.rows).map((row, key) => {

    const {
      content: messageContent,
      message_id: messageId,
      message_name: messageName
    } = row;
    campaignMessages[messageId] = {
      messageContent: stringCleaner(messageContent),
      messageName: stringCleaner(messageName)
    }

    // The sorting order above makes sure the first message is the next one that's going to be sent (assuming this is a repeating campaign).
    
    if (key < 1 && campaignRepeats) Object.keys(messageTargets).map(key => {
      
      messageTargets[key].messageContent = stringCleaner(messageContent)
      messageTargets[key].messageName = stringCleaner(messageName)
      messageTargets[key].nextMessage = messageId

    })

  })

  // However, if the campaign is not repeating, we need to check if there are *any* messages they have not seen and pick up the first one (yes) or make them ineligible (no)


  if (!campaignRepeats) {  

    const messageIds = Object.keys(campaignMessages)

    // Get the messages each member of the contact list has seen on this campaign.

    queryText = `SELECT contact_id, message_id FROM message_tracking WHERE campaign_id = '${campaignId}' ORDER BY contact_id`
    results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting all message tracking for this campaign'
      await recordError ({
        context: `api: ${nowRunning}.getUnsubs`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })

    }

    Object.values(results.rows).map(row => {

      const {
        contact_id: contactId,
        message_id: messageId
      } = row

      // To start, we set all messages in the campaign as unseen by this contact.

      if (!unseenMessages[contactId]) unseenMessages[contactId] = messageIds

      unseenMessages[contactId].map((thisMessageId, key) => {

        // Remove the messageId if this contact has already seen it.

        if (thisMessageId === messageId ) delete unseenMessages[contactId][key]

      })

    })

    Object.keys(unseenMessages).forEach(key => { 

      // If the object is empty, the contact has seen all available messages and can be removed from unseenMessages.
  
      if (unseenMessages[key].every(item => item === undefined)) delete messageTargets[key]
      
    })

  }

  return { checkScheduleSuccess: true, messageTargets }

}

const getUnsubs = async ({ errorNumber, nowRunning, userId }) => {

  const blockAll = []
  const getUnsubsSuccess = false
  const unsubs = {}

  let queryText = "SELECT contact_id FROM contacts WHERE block_all = true; SELECT contact_id, campaign_id FROM unsubs"
  let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

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

const processCampaigns = async ({ 
  apiTesting, 
  campaignId, 
  campaignRepeats, 
  dryRun, 
  eligibleRecipients, 
  errorNumber, 
  messageContent, 
  messageId, 
  messageSubject, 
  nextMessage, 
  unsubUrl, 
  userId 
}) => {

  const { 
    getDynamicMessageReplacements,
    recordError,
    sendMail,
    updateDynamicText
  } = require ('../functions')
  const nowRunning = 'scheduler.js:processCampaigns'

  const dryRunInformation = []; // This holds events when dryRun is set.

  try {

    const now = +moment().format('X')
    const success = false

    // In the case of a repeating campaign, all list contacts are going to get the same basic email so we only do dynamic updates once.

    const {
      dynamicValues: allDynamicValues,
      failure: getDynamicValuesFailure
    } = await getDynamicMessageReplacements({ 
      campaignId, 
      errorNumber, 
      userId
     });

     if (getDynamicValuesFailure) {

      console.log(`${nowRunning}: exited due to error on function getDynamicMessageReplacements`);
      return res.status(200).send({ 
        failure: getDynamicValuesFailure, 
        success 
      });

    }

    // Uncomment the next line to see what substitutions are going to be made.
    // console.log('dynamicValues', allDynamicValues[messageId])

    // This runs the dynamic replacements for the main message content.

    const { messageContent } = updateDynamicText({ dynamicValues: allDynamicValues[messageId], messageContent }) 
    
    Object.entries(eligibleRecipients).map(async row => {

      const contactId = row[0]
      const {
        contactName,
        email
      } = row[1]

      // IMPORTANT! right here is where we engage in message substitution if indicated. When this is running, we have to update messageContent for each user because it's NOT guaranteed to be the same on every iteration. campaignRepeats is added as a safety check to make sure this is not a repeating campaign where the dynamic values have already been replaced (see above).

      if (nextMessage[contactId] && !campaignRepeats) {

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

        // Update the content with any dynamic values associated with this particular message ID.
          
        const { messageContent } = updateDynamicText({ dynamicValues: allDynamicValues[messageId], messageContent })

      }

      // Add the unsubscribe URL.
      
      messageContent = replace(messageContent, /\[UNSUB_MESSAGE\]/g, `<p><a href="${unsubUrl}?ca=${campaignId}&co=${contactId}">Manage your subscription preferences here</a></p>`) 

      // Each message gets the individual contact name. This is done last because the contact name changes on every email.

      const thisMessage = replace(messageContent, /\[CONTACT_NAME\]/g, contactName) 

      // Send the mail now.

      if (!dryRun) {

        const response = await sendMail (email, thisMessage, messageSubject)
        const {
          body,
          statusCode
        } = response[0]

        let eventDetails

        if (statusCode == 200 || statusCode == 202) { 
          
          // Record successful send event in message_tracking.

          queryText = `INSERT INTO message_tracking(campaign_id, contact_id, message_id, sent) VALUES('${campaignId}', '${contactId}', '${messageId}', '${+moment().format('X')}')`
          results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

          if (!results) { 

            const failure = 'database error when recording the send event'
            console.log(`${nowRunning}: ${failure}\n`)
            await recordError ({
              context: `api:  ${nowRunning}`,
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

          recordEvent ({ 
            apiTesting, 
            event: 4, 
            eventDetails, 
            eventTarget: campaignId, 
            userId 
          });

        }

      } else { 

        // Process dry run information

        dryRunInformation.push({
          contactName,
          email,
          messageContent: thisMessage,
          messageId,
          messageSubject
        })

      }
      
    })

    // Before exiting, update the dynamic values just used, so they flow to the end of the rotation.

    try { 

      if (dryRun) apiTesting = true // The values should NOY be rotated if this is not an actual run.

      queryText = ''

      Object.keys(allDynamicValues[messageId]).map(value => { queryText += `UPDATE dynamic_values SET last_used = ${now} WHERE dynamic_id = '${value}';` })

      results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

      if (!results) { 

        const failure = 'database error when updating the last_run parameter on dynamic values used on this campaign run'
        console.log(`${nowRunning}: ${failure}\n`)
        await recordError ({
          context: `api:  ${nowRunning}`,
          details: queryText,
          errorMessage: failure,
          errorNumber,
          userId
        })

        return ({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })

      }

    } catch(e) {} // dynamicValues may be undefined

    // Everything worked.

    return ({ campaignsProcessedFailure: false, campaignsProcessedSuccess: true, dryRunInformation })

  } catch(e) {

    await recordError ({
      context: `api:  ${nowRunning}`,
      details: 'exception thrown',
      errorMessage: e.message,
      errorNumber,
      userId
    })
    console.log(`${nowRunning}: ${e.message}\n`)
    return ({ campaignsProcessedFailure: `exception thrown ${e.message}`, campaignsProcessedSuccess: false, })

  }

}

router.post("/run", async (req, res) => { 

  const nowRunning = "/campaigns/run"
  console.log(`${nowRunning}: running ${moment().format('YYYY.MM.DD HH.mm.ss')}`)
  const errorNumber = 41
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean(),
      dryRun: Joi.boolean(),
      masterKey: Joi.any(), // This would be coming in from React and is ignored.
      userId: Joi.any() // This would be coming in from React and is ignored.
    })
;

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}\n`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      apiTesting,
      dryRun
    } = req.body

    if (dryRun) apiTesting = true // If this is a dry run, we don't want to commit any changes.

    const userId = API_ACCESS_TOKEN // We need a user ID but this runs as a crontab job.

    // Get all campaigns that have a message that is eligible to run now.

    let queryText = "SELECT c.campaign_id, c.campaign_name, c.campaign_repeats, c.ends, c.interval, c.list_id, c.message_series, c.next_run, c.starts, c.unsub_url, cm.position, m.content, m.message_id, m.message_name, m.repeatable, m.subject FROM campaigns c, campaign_messages cm, messages m WHERE c.active = true" 
    
    if (!dryRun) queryText += ` AND (c.next_run <= ${moment().format('X')} OR c.next_run IS NULL)`
    
    queryText += " AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id AND m.active = true ORDER BY last_sent, position"
    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

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
        recordEvent ({ 
          apiTesting, 
          event: 2, 
          eventDetails, 
          eventTarget: campaignId, 
          userId 
        });
        return ({ 
          setNextRunFailure: failure, 
          setNextRunSuccess: true 
        });

      }

      // Set the next scheduled run time

      const queryText = `UPDATE campaigns SET next_run = ${nextRunTime} WHERE campaign_id = '${campaignId}'`
      const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

      if (!results) {

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
      recordEvent ({ 
        apiTesting, 
        event: 2, 
        eventDetails, 
        eventTarget: campaignId, 
        userId 
      });
      return ({ setNextRunSuccess: true });

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

        // Sometimes there will be N > 1 messages waiting to run on a campaign cycle, but we need to not send more than one per interval.

        if (campaignLimiter.includes(campaignId)) {

          console.log(`${nowRunning}: campaign ${campaignId} was limited to sending just one message per cycle`)
          return { campaignsProcessedSuccess: true } // Note that allCampaignsProcessedResults will only have this single value when the limiter is invoked.

        }

        campaignLimiter.push(campaignId) // prevents the campaign from sending any more emails on this run

        // Check for a valid unsubscribe URL.

        if (!isUrl(unsubUrl)) {

          const eventDetails = `campaign: <b>${campaignName}</b>, id: <b>${campaignId}</b>, unsub link: <b>${unsubUrl}</b>`
          recordEvent ({ 
            apiTesting, 
            event: 9, 
            eventDetails, 
            eventTarget: campaignId, 
            userId 
          });
          return ({
            campaignId,
            messageId: row.message_id,
            campaignsProcessedFailure: 'the campaign does not have a valid unsubscribe link',
            campaignsProcessedSuccess: false
          });

        }

        // Use a template where specified by messageContent.

        if (messageContent.startsWith('template:')) messageContent = fs.readFileSync(`./assets/files/html/${messageContent.substring(9)}.html`, 'utf-8')

        // Check for a placeholder to insert the unsub link.

        if (!messageContent.includes('[UNSUB_MESSAGE]')) {

          const eventDetails = `campaign: <b>${campaignName}</b>, id: <b>${campaignId}</b>, message ID: <b>${messageId}</b>`
          recordEvent ({ 
            apiTesting, 
            event: 10, 
            eventDetails, 
            eventTarget: campaignId, 
            userId 
          });
          return ({
            campaignId,
            messageId: row.message_id,
            campaignsProcessedFailure: 'the message content does not contain the [UNSUB_MESSAGE] placeholder',
            campaignsProcessedSuccess: false
          });

        }

        // Filter the mailing list and make sure there is at least one valid recipient.

        const eligibleRecipients = {}

        // Get all contacts on the mailing list that are active.

        queryText = `SELECT c.company_name, c.contact_id, c.contact_name, c.email FROM contacts c, list_contacts lc WHERE c.active = true AND c.contact_id = lc.contact_id AND lc.list_id = '${listId}' ORDER BY contact_name`
        results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

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
          results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

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
          results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

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
          recordEvent ({ 
            apiTesting, 
            event: 1, 
            eventDetails, 
            eventTarget: campaignId, 
            userId 
          });
          return ({
            campaignId,
            campaignName,
            messageId,
            noEligibleRecipients: true,
            campaignsProcessedSuccess: true
          });
          
        }

        // The campaign message will be sent to the mailing list after additional processing, see processCampaigns.
    
        const {
          campaignsProcessedFailure,
          campaignsProcessedSuccess,
          dryRunInformation
        } = await processCampaigns({
          campaignId,
          campaignRepeats,
          dryRun,
          eligibleRecipients,
          errorNumber,
          messageContent: stringCleaner(messageContent),
          messageId,
          messageSubject: stringCleaner(messageSubject),
          nextMessage, // only used when the campaign is not repeating
          unsubUrl,
          userId
        });
        
        // If the campaign is repeatable, setting last_sent moves the current message to the end of the eligible messages list.

        if (repeatable) { 

          queryText = `UPDATE campaign_messages SET last_sent = ${+moment().format('X')} WHERE message_id = '${messageId}' AND campaign_id = '${campaignId}';`
          results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

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
    
        // Log or handle the successful campaign processing

        const eventDetails = `${nowRunning}: campaign ${campaignId} processed successfully`
        recordEvent ({ 
          apiTesting, 
          event: 3, 
          eventDetails, 
          eventTarget: campaignId, 
          userId 
        });
    
        return ({
          campaignId,
          campaignName,
          campaignsProcessedFailure,
          campaignsProcessedSuccess,
          dryRunInformation,
          messageId: row.message_id
        });

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
  
    console.log(`${nowRunning}: finished\n`)
    return res.status(200).send({ success: true, allCampaignsProcessed, allCampaignsProcessedResults })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = `${nowRunning }: failed with an exception: ${e}`
    console.log (e) 
    res.status(500).send(newException)

 }

})

router.post("/upcoming", async (req, res) => { 

  const nowRunning = "/scheduler/upcoming"
  console.log(`${nowRunning}: running ${moment().format('YYYY.MM.DD HH.mm.ss')}`)

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
;

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}\n`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    const { userId } = req.body
    const { 
      failure: getUserLevelFailure,
      level: userLevel 
    } = await getUserLevel(userId);

    if (getUserLevelFailure) {

      console.log(`${nowRunning }: aborted`);
      return res.status(404).send({ 
        failure: getUserLevelFailure, 
        success 
      });

    } else if (userLevel < 1) {

      console.log(`${nowRunning}: aborted, invalid user ID`);
      return res.status(404).send({ 
        failure: 'invalid user ID',
        success 
      });

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
    let queryText = `SELECT c.campaign_id, c.campaign_name, c.campaign_repeats, c.ends, c.interval, c.list_id, c.next_run, c.starts, m.message_id, m.message_name FROM campaigns c, campaign_messages cm, lists l, messages m WHERE c.active = true AND c.ends > ${moment().format('X')} AND c.list_id = l.list_id AND l.active = true AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id ORDER BY next_run, campaign_name`
    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

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
        campaign_repeats: repeats,
        ends,
        interval,
        list_id: listId,
        message_id: messageId,
        message_name: messageName,
        next_run: nextRun,
        starts        
      } = row

      if (nextRun < 1) nextRun = calculateNextRun({ interval, starts })
      
      if (!upcoming[campaignId]) {

        upcoming[campaignId] = {
          campaignName,
          campaignTargets: null,
          ends: +ends,
          ends2: moment.unix(ends).format('YYYY.MM.DD HH.mm'),
          interval: +interval,
          interval2: intervals[interval],
          listId,
          messageId,
          messageName: stringCleaner(messageName),
          nextRun: +nextRun,
          nextRun2: moment.unix(nextRun).format('YYYY.MM.DD HH.mm'),
          repeats,
          starts: +starts,
          starts2: moment.unix(starts).format('YYYY.MM.DD HH.mm'),
          targets: 0
        }

      }      

    })

    // Prepare for Promise.all() to handle asynchronous checkSchedule calls

    const checkSchedulePromises = results.rows.map(row => {

      const { 
        campaign_id: campaignId,
        campaign_repeats: campaignRepeats,
        list_id: listId  
      } = row
      return checkSchedule({ campaignId, campaignRepeats, errorNumber, listId, nowRunning, userId }).then(scheduleCheckResult => ({
        campaignId,
        scheduleCheckResult,
      }))

    })

    // Wait for all checks to complete.

    const allScheduleChecks = await Promise.all(checkSchedulePromises)

    // Now put the campaign targets (what each contact will be sent) on the "upcoming" object that gets returned.

    allScheduleChecks.forEach(({ campaignId, scheduleCheckResult }) => upcoming[campaignId].campaignTargets = scheduleCheckResult.messageTargets )

    console.log(`${nowRunning}: finished\n`)
    return res.status(200).send({ upcoming, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = `${nowRunning }: failed with an exception: ${e}`
    console.log (e) 
    res.status(500).send(newException)

  }

})

module.exports = router
console.log('scheduler services loaded successfully!')