console.log( "loading scheduler services now..." )
const db = require( '../db' )
const express = require( 'express' )
const Joi = require( 'joi' )
const moment = require( 'moment' )
const router = express.Router()
const { v4: uuidv4 } = require( 'uuid' )
router.use( express.json() )

const { API_ACCESS_TOKEN } = process.env
const { 
  getUserLevel,
  recordError,
  recordEvent,
  stringCleaner,
  validateSchema
} = require( '../functions.js' )

const calculateNextRun = ({ interval, starts }) => {

  const startsMoment = moment.unix(starts)
  const hour = startsMoment.hour()
  const minute = startsMoment.minute()
  const nowMoment = moment()

  if (interval == 1) { // set nextRunTime to the next weekday after now
    
    const nowMomentX = +moment().format('X')
    nextRunTime = nowMoment.clone().hour(hour).minute(minute).second(0)

    while (nextRunTime.isoWeekday() >= 6 && +nextRunTime.format('X') < nowMomentX) { nextRunTime.add(1, 'days') }

  } else if (interval === 2) { // set nextRunTime for the next day

    nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

  } else if ( interval == 3 ) { // set nextRunTime to one week

    nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

  } else if ( interval == 4 ) { // set nextRunTime to two weeks

    nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

  } else if ( interval == 5 ) { // set nextRunTime to one month

    nextRunTime = nowMoment.clone().add(1, 'months').day(dayOfWeek).hour(hour).minute(minute)

  } else if ( interval == 6 ) { // set nextRunTime to the first day of the next month
  
    nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').hour(hour).minute(minute)

  } else if ( interval == 7 ) { // set nextRunTime to the first weekday of the next month
  
    nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  } else if ( interval == 8 ) { // set nextRunTime to three months from now (quarterly)

    nextRunTime = nowMoment.clone().add(3, 'years').hour(hour).minute(minute)

  } else if ( interval == 9 ) { // set nextRunTime to the first day of the next quarter
  
    nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').hour(hour).minute(minute)

  } else if ( interval == 10 ) { // set nextRunTime to the first weekday of the next quarter
  
    nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').isoWeekday(1).hour(hour).minute(minute)

  } else if ( interval == 11 ) { // set nextRunTime to six months from now (semiannual)

    nextRunTime = nowMoment.clone().add(6, 'months').hour(hour).minute(minute)

  } else if ( interval == 12 ) { // set nextRunTime to the first day of the next semiannual

    nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').hour(hour).minute(minute)

  } else if ( interval == 13 ) { // set nextRunTime to the first weekday of the next semiannual

    nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  } else if ( interval == 14 ) { // set nextRunTime to one year from now

    nextRunTime = nowMoment.clone().add(1, 'years').hour(hour).minute(minute)

  } else if ( interval == 15 ) { // set nextRunTime to the first day of the next year

    nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').hour(hour).minute(minute)

  } else if ( interval == 16 ) { // set nextRunTime to the first weekday of the next year

    nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').isoWeekday(1).hour(hour).minute(minute)

  } console.log(`nextRunTime: ${nextRunTime}`)
  
  return +nextRunTime.format('X')

}

const getUnsubs = async ({ errorNumber, nowRunning, userId }) => {

  const blockAll = []
  const getUnsubsSuccess = false
  const unsubs = {}

  let queryText = "SELECT contact_id FROM contacts WHERE block_all = true SELECT contact_id, list_id FROM unsubs"
  let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

  if (!results) {

    const failure = 'database error when getting unsub information'
    await recordError ( {
      context: `api: ${nowRunning}.getUnsubs`,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    })
    return({ getUnsubsFailure: failure, getUnsubsSuccess})
    
  }

  Object.values(results[0].rows).map( row => { blockAll.push( row.contact_id ) }) // contains all completely blocked contact IDs

  Object.values(results[1].rows).map( row => {

    const {
      contact_id: contactId,
      list_id: listId
    } = row

    if (!unsubs[listId]) {

      unsubs[listId] = [contactId]
      blockAll.map( contactId => unsubs[listId].push(contactId) )

    } else {

      unsubs[listId].push(contactId)

    }

  })

  return ({ getUnsubsSuccess: true, unsubs }) 

}

router.post( "/run", async ( req, res ) => { 

  const nowRunning = "/campaigns/run"
  console.log(`${nowRunning}: running`)

  const errorNumber = 41
  const success = false
  const {
    deleteCampaignMessage,
    processCampaigns
  } = require('../functions.js')
  const fs = require('fs')

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
      return res.status( 422 ).send({ failure: errorMessage, success })

    }

    const { apiTesting } = req.body
    const userId = API_ACCESS_TOKEN // we need a user ID but this runs as a crontab job

    // get all campaigns that have a message that is eligible to run now

    let queryText = " SELECT c.campaign_id, c.campaign_name, c.campaign_repeats, c.ends, c.interval, c.list_id, c.message_series, c.next_run, c.starts, cm.position, m.content, m.message_id, m.message_name, m.repeatable, m.subject FROM campaigns c, campaign_messages cm, messages m WHERE c.active = true AND ( c.next_run <= " + moment().format( 'X' ) + " OR c.next_run IS NULL ) AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id AND m.active = true ORDER BY last_sent, position "
    let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId )

    if (!results.rows) {

      const failure = 'database error when getting all campaigns'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    const eligibleCampaigns = results.rows
    const campaignLimiter = []

    const setNextRun = async({ apiTesting, campaignId, ends, interval, starts }) => {

      let nextRunTime

      // convert starts to a Moment object and extract hour and minute
    
      const startsMoment = moment.unix(starts)
      const dayOfWeek = startsMoment.day()
      const hour = startsMoment.hour()
      const minute = startsMoment.minute()
      const nowMoment = moment()

      if (interval == 1) { // set nextRunTime to the next weekday after now
        
        nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

        while (nextRunTime.isoWeekday() >= 6) { nextRunTime.add(1, 'days') }
   
      } else if (interval === 2) { // set nextRunTime for the next day

        nextRunTime = nowMoment.clone().add(1, 'days').hour(hour).minute(minute)

      } else if ( interval == 3 ) { // set nextRunTime to one week

        nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

      } else if ( interval == 4 ) { // set nextRunTime to two weeks

        nextRunTime = nowMoment.clone().add(1, 'weeks').day(dayOfWeek).hour(hour).minute(minute)

      } else if ( interval == 5 ) { // set nextRunTime to one month

        nextRunTime = nowMoment.clone().add(1, 'months').day(dayOfWeek).hour(hour).minute(minute)

      } else if ( interval == 6 ) { // set nextRunTime to the first day of the next month
      
        nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').hour(hour).minute(minute)

      } else if ( interval == 7 ) { // set nextRunTime to the first weekday of the next month
      
        nextRunTime = nowMoment.clone().add(1, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)
    
      } else if ( interval == 8 ) { // set nextRunTime to three months from now (quarterly)

        nextRunTime = nowMoment.clone().add(3, 'years').hour(hour).minute(minute)

      } else if ( interval == 9 ) { // set nextRunTime to the first day of the next quarter
      
        nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').hour(hour).minute(minute)

      } else if ( interval == 10 ) { // set nextRunTime to the first weekday of the next quarter
      
        nextRunTime = nowMoment.clone().add(1, 'quarters').startOf('quarter').isoWeekday(1).hour(hour).minute(minute)
    
      } else if ( interval == 11 ) { // set nextRunTime to six months from now (semiannual)

        nextRunTime = nowMoment.clone().add(6, 'months').hour(hour).minute(minute)
    
      } else if ( interval == 12 ) { // set nextRunTime to the first day of the next semiannual

        nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').hour(hour).minute(minute)
    
      } else if ( interval == 13 ) { // set nextRunTime to the first weekday of the next semiannual

        nextRunTime = nowMoment.clone().add(6, 'months').startOf('month').isoWeekday(1).hour(hour).minute(minute)

      } else if ( interval == 14 ) { // set nextRunTime to one year from now

        nextRunTime = nowMoment.clone().add(1, 'years').hour(hour).minute(minute)
    
      } else if ( interval == 15 ) { // set nextRunTime to the first day of the next year

        nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').hour(hour).minute(minute)
    
      } else if ( interval == 16 ) { // set nextRunTime to the first weekday of the next year

        nextRunTime = nowMoment.clone().add(1, 'years').startOf('month').isoWeekday(1).hour(hour).minute(minute)

      }

      nextRunTime = +moment(nextRunTime).format('X')

      if ( nextRunTime > ends ) {

        const eventDetails = 'The next run time for this campaign exceeded the campaign end time, so it was not renewed.'
        recordEvent ({ apiTesting, event: 2, eventDetails, eventTarget: campaignId, userId })
        return { setNextRunFailure: failure, setNextRunSuccess: true }

      }

      console.log( `${nowRunning}: setting nextRunTime to ${moment.unix(nextRunTime).format('YYYY.MM.DD HH.mm')}`)

      const queryText = `UPDATE campaigns SET next_run = ${nextRunTime} WHERE campaign_id = '${campaignId}'`
      const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting )

      if (!results.rows) {

        const failure = `database error when updating the next run time for campaign ${campaignId}`
        console.log(`${nowRunning}: ${failure}\n`)
        await recordError ( {
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

    const processCampaignsPromises = eligibleCampaigns.map(async (row) => {
      
      try {

        // get the campaign parameters and the next message in line to send

        let {
          campaign_id: campaignId,
          campaign_repeats: campaignRepeats,
          content: messageContent,
          ends,
          interval,
          list_id: listId,
          message_id: messageId,
          message_name: messageName,
          position,
          repeatable,
          starts,
          subject: messageSubject
        } = row
        console.log(messageContent.startsWith('template:'))
        if (messageContent.startsWith('template:')) messageContent = fs.readFileSync( `./html/${messageContent.substring(9)}.html`, 'utf-8' )
        console.log(`messageContent: ${messageContent}`)
        // return null;


        // if the message is not repeatable, we immediate 

        // if the campaign is non-repeating, check if there are any unsent messages

        if (!campaignRepeats) { // check if any linked messages have not been sent yet

          queryText = `SELECT count( message_id ) FROM campaign_messages WHERE campaign_id = '${campaignId}' AND ( last_sent < 1 OR last_sent IS NULL )`
          results = await db.noTransaction( queryText, errorNumber, nowRunning, userId )

          if (!results.rows) {

            const failure = `database error when getting unsent messages count for campaign ${campaignId}`
            console.log(`${nowRunning}: ${failure}\n`)
            await recordError ( {
              context: `api: ${nowRunning}`,
              details: queryText,
              errorMessage: failure,
              errorNumber,
              userId
            })
            return res.status( 200 ).send( { campaignsProcessedFailure: failure, campaignsProcessedSuccess: false })
            
          }

          // if there are no unsent messages on a non-repeating email, we need to set the next run time and then exit

          if ( +results.rows[0].count < 1 ) {
            
            console.log(`campaign ${campaignId} is non-repeating and has no unsent messages` )
            const {
              setNextRunFailure,
              setNextRunSuccess
            } = await setNextRun({ apiTesting, campaignId, ends, interval, starts })

            if ( !setNextRunSuccess) return { campaignsProcessedFailure: setNextRunFailure, campaignsProcessedSuccess: false }

            return { noUnsentMessages: true, campaignsProcessedSuccess: true }

          }

        }

        // sometimes there will be N > 1 messages waiting to run on a campaign cycle, but we need to not send more than one per interval

        if (campaignLimiter.includes( campaignId) ) {

          console.log(`${nowRunning}: campaign ${campaignId} was limited to sending just one message per cycle` )
          return { campaignsProcessedSuccess: true } // note that allCampaignsProcessedResults will only have this single value when the limiter is invoked.

        }

        campaignLimiter.push( campaignId ) // prevents the campaign from sending any more emails on this run

        // the campaign message will be sent to the mailing list after additional processing, see processCampaigns
    
        const {
          campaignsProcessedFailure,
          campaignsProcessedSuccess
        } = await processCampaigns({
          campaignId,
          errorNumber,
          listId,
          messageContent: stringCleaner(messageContent),
          messageId,
          messageName: stringCleaner(messageName),
          messageSubject: stringCleaner(messageSubject),
          userId
        })        

        // if the message is defined as not repeatable, the link to this campaign has to be removed
        // position is used if the message appears more than once in the list, so only the current message is removed

        if (!repeatable){ 
          const {
            deleteCampaignMessageFailure,
            deleteCampaignMessageSuccess
          } = await deleteCampaignMessage({ apiTesting, campaignId, errorNumber, messageId, position, userId })
      
          if (!deleteCampaignMessageSuccess) return res.status(200).send({ failure: deleteCampaignMessageFailure, success })

        } 

        // set the next run time for this campaign

        const {
          setNextRunFailure,
          setNextRunSuccess
        } = await setNextRun({ apiTesting, campaignId, ends, interval, starts })

        if (!setNextRunSuccess) return { campaignsProcessedFailure: setNextRunFailure, campaignsProcessedSuccess: false }
    
        // log or handle the successful campaign processing (to be replaced with history)

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
    
    // creates an array of the results of processing each eligible campaign

    const allCampaignsProcessedResults = await Promise.all(processCampaignsPromises)

    // this returns true only if every campaign processed with no error
  
    const allCampaignsProcessed = allCampaignsProcessedResults.every((result) => !result.campaignsProcessedFailure)
  
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ success: true, allCampaignsProcessed, allCampaignsProcessedResults })

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log ( e ) 
    res.status( 500 ).send( newException )

 }

})

router.post( "/upcoming", async ( req, res ) => { 

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

    const schema = Joi.object( {
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } )

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status( 422 ).send({ failure: errorMessage, success })

    }

    let { userId } = req.body
    const { level: userLevel } = await getUserLevel( userId )

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" )
      return res.status( 404 ).send( { failure: 'invalid user ID', success } )

    } 

    // get unsubs first, because they are not counted as subscribers

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
    let queryText = `SELECT c.campaign_id, c.campaign_name, c.ends, c.interval, c.next_run, c.starts, m.message_name FROM campaigns c, campaign_messages cm, lists l, messages m WHERE c.active = true AND c.ends > ${moment().format('X')} AND c.list_id = l.list_id AND l.active = true AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id ORDER BY next_run, campaign_name`
    let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when getting all upcoming campaigns'
      console.log(`${nowRunning}: ${failure}\n`)
      await recordError ( {
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
        message_name: messageName,
        next_run: nextRun,
        starts,
        
      } = row

      if (nextRun < 1) nextRun = calculateNextRun({ interval, starts })
      
      if (!upcoming[campaignId]) {

        upcoming[campaignId] = {
          campaignName,
          ends: +ends,
          ends2: moment.unix(ends).format('YYYY.MM.DD HH.mm'),
          interval: +interval,
          interval2: intervals[interval],
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
      await recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    Object.values(results.rows).map( row => {

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

    console.log( nowRunning + ": finished\n" )
    return res.status( 200 ).send( { upcoming, success: true } )

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } )
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log ( e ) 
    res.status( 500 ).send( newException )

  }

} )

module.exports = router
console.log( 'scheduler services loaded successfully!' )