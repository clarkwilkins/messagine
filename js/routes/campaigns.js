console.log("loading campaign services now...");
const db = require('../db');
const express = require('express');
const Joi = require('joi');
const moment = require('moment');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json())

const { API_ACCESS_TOKEN } = process.env;
const { 
  checkCampaigns,
  containsHTML,
  getUserLevel,
  recordError,
  recordEvent,
  stringCleaner,
  validateSchema
} = require('../functions.js')

router.post("/all", async (req, res) => { 

  const nowRunning = "/campaigns/all"
  console.log(`${nowRunning}: running`)

  const errorNumber = 31
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      active: Joi.boolean().optional().allow('', null),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      active,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // check/adjust campaigns first

    const { failure, success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }

    let queryText = " SELECT c.*, u.user_name  FROM campaigns c, users u WHERE c.updated_by = u.user_id";   

    if (typeof active === 'boolean') queryText += " AND c.active = " + active

    queryText += " ORDER BY active DESC, campaign_name"
    const results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when getting all campaigns'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    } 

    const campaigns = {}
    const campaignsSelector = []

    Object.values(results.rows).map(row => { 
      
      const {
        active,
        campaign_id: campaignId,
        campaign_name: campaignName,
        campaign_notes: campaignNotes,
        campaign_repeats: campaignRepeats,
        created,
        ends,
        interval,
        list_id: listId,
        locked,
        message_series: messageSeries,
        next_message: nextMessage,
        next_run: nextRun,
        starts,
        updated,
        updatedBy,
        user_name: updatedBy2
      } = row
      campaigns[campaignId] = {
        active,
        campaignName: stringCleaner(campaignName),
        campaignNotes: stringCleaner(campaignNotes, false, !containsHTML(campaignNotes)),
        campaignRepeats,
        created: +created,
        ends: +ends,
        interval: +interval,
        listId,
        locked: +locked,
        messageSeries,
        nextMessage,
        nextRun: +nextRun,
        starts: +starts,
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner(updatedBy2)
      }
      let label = stringCleaner(campaignName)

      if (active !== true) label += '*'

      campaignsSelector.push({ label, value: campaignId })

    })
    
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ campaigns, campaignsSelector, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

router.post("/delete", async (req, res) => { 

  const nowRunning = "/campaigns/delete"
  console.log(`${nowRunning}: running`)

  const errorNumber = 30
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().optional().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      apiTesting,
      campaignId,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 5) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // delete the campaign

    const queryText = " DELETE FROM campaigns WHERE campaign_id = '" + campaignId + "' AND locked <= '" + userLevel + "' RETURNING campaign_id; ";    
    const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

    if (!results.rows) {

      const failure = 'database error when deleting the campaign record'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    } else if (results.rowCount < 1) { // bad ID or the record is locked

      const failure = 'the campaign record was not deleted'
      return res.status(200).send({ failure, success })

    }

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }
    
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ campaignId, closedCampaigns, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

router.post("/load", async (req, res) => { 

  const nowRunning = "/campaigns/load"
  console.log(`${nowRunning}: running`)

  const errorNumber = 32
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      campaignId,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // check/adjust campaigns first

    const { failure, success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }

    const queryText = " SELECT c.*, u.user_name  FROM campaigns c, users u WHERE c.updated_by = u.user_id AND c.campaign_id = '" + campaignId + "'; "
    const results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when getting the campaign'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    } else if (!results.rows[0]?.campaign_id) {

      const failure = 'campaignId ' + campaignId + ' was not found'
      return res.status(200).send({ failure, success })
      
    }
      
    const {
      active,
      campaign_name: campaignName,
      campaign_notes: campaignNotes,
      campaign_repeats: campaignRepeats,
      created,
      ends,
      interval,
      list_id: listId,
      locked,
      message_series: messageSeries,
      next_message: nextMessage,
      next_run: nextRun,
      starts,
      updated,
      updatedBy,
      user_name: updatedBy2
    } = results.rows[0]
    
    console.log(nowRunning + ": finished\n"); const a = results.rows
    return res.status(200).send({ 
      active,
      campaignName: stringCleaner(campaignName),
      campaignNotes: stringCleaner(campaignNotes, false, !containsHTML(campaignNotes)),
      campaignRepeats,
      created: +created,
      ends: +ends,
      interval: +interval,
      listId,
      locked: +locked,
      messageSeries,
      nextMessage,
      nextRun: +nextRun,
      starts: +starts,
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner(updatedBy2)
    })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

router.post("/messages/add", async (req, res) => { 

  const nowRunning = "/campaigns/messages/add"
  console.log(`${nowRunning}: running`)

  const errorNumber = 39
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // doing some cleanup before we connect the message

    const { success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }

    // check for the next position

    let queryText = " SELECT max(position) FROM campaign_messages WHERE campaign_id = '" + campaignId + "'; "
    let results = await db.noTransaction(queryText, errorNumber, nowRunning, userId)

    if (!results.rows) {

      const failure = 'database error when checking current message position'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    let nextPosition = +results.rows[0]?.max + 1 || 1

    queryText = " INSERT INTO campaign_messages(campaign_id, message_id, position) VALUES ('" + campaignId + "', '" + messageId + "', " + nextPosition + ") RETURNING position; "
    results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

    if (!results.rows || results.rowCount != 1) {

      const failure = 'database error when adding a message to the campaign'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ nextPosition, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

router.post("/messages/remove", async (req, res) => { 

  const nowRunning = "/campaigns/messages/remove"
  console.log(`${nowRunning}: running`)

  const errorNumber = 40
  const success = false
  const { deleteCampaignMessage } = require('../functions.js')

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      position: Joi.number().optional().integer().positive(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
      position,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    const {
      deleteCampaignMessageFailure,
      deleteCampaignMessageSuccess
    } = await deleteCampaignMessage({ apiTesting, campaignId, errorNumber, messageId, position, userId })

    if (!deleteCampaignMessageSuccess) return res.status(200).send({ failure: deleteCampaignMessageFailure, success })

    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

  }

})

router.post("/new", async (req, res) => { 

  const nowRunning = "/campaigns/new"
  console.log(`${nowRunning}: running`)

  const errorNumber = 28
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignInterval: Joi.number().required().integer().min(1).max(16),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow('', null),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when('campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow('', null),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageSeries: Joi.boolean().optional(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      active,
      apiTesting,
      campaignStarts,
      campaignEnds,
      campaignInterval,
      campaignName,
      campaignNotes,
      campaignRepeats,
      listId,
      locked,
      messageSeries,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null
    !campaignNotes ? campaignNotes = '' : null
    !campaignRepeats ? campaignRepeats = false : null
    !campaignStarts ? campaignStarts = 0 : null
    locked ? locked = userLevel : locked = 0
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format('X')

    // create the campaign

    const queryText = " INSERT INTO campaigns(active, campaign_id, campaign_name, campaign_notes, campaign_repeats, created, ends, list_id, interval, locked, message_series, starts, updated, updated_by) VALUES (" + active + ", '" + uuidv4() + "', '" + stringCleaner(campaignName, true)  + "', '" + stringCleaner(campaignNotes, true) + "', " + campaignRepeats + ", " + now + ", " + campaignEnds + ", '" + listId + "', " + campaignInterval + ", " + locked + ", " + messageSeries + ", " + campaignStarts + ", " + now + ", '" + userId + "') RETURNING campaign_id; ";    
    const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

    if (!results.rows) {

      const failure = 'database error when creating a new campaign record'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    const campaignId = results.rows[0].campaign_id

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }
    
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ campaignId, closedCampaigns, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

router.post("/unsubscribe", async (req, res) => { 

  const nowRunning = "/campaigns/unsubscribe"
  console.log(`${nowRunning}: running`)

  const errorNumber = 46
  const success = false

  try {

    if (req.body.apiKey != process.env.EXTERNAL_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      apiKey: Joi.string().required().uuid(),
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      contactId: Joi.string().required().uuid(),
      preference: Joi.number().required().integer().min(1).max(2)
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      apiKey,
      apiTesting,
      campaignId,
      contactId,
      preference
    } = req.body

    const now = +moment().format('X')
    const userId = apiKey

    // default mode is to just unsubscribe from this campaign (hopefully). 2nd query is just padding so there are the same query positions.

    let queryText = `INSERT INTO unsubs(campaign_id, contact_id, created) VALUES('${campaignId}', '${contactId}', ${now}) ON CONFLICT DO NOTHING; SELECT contact_id FROM contacts LIMIT 1`
  
    // however, the contact might ask for a total block :-(

    if (preference === 2) queryText = `UPDATE contacts SET active = false, block_all = true, updated = ${now}, updated_by = '${contactId}' WHERE contact_id = '${contactId}'; DELETE FROM list_contacts WHERE contact_id = '${contactId}'`

    queryText += `; SELECT company_name, contact_name, email FROM contacts WHERE contact_id = '${contactId}'; SELECT campaign_name FROM campaigns WHERE campaign_id = '${campaignId}'; `

    const results = await db.transactionRequired(queryText, errorNumber, nowRunning, errorMessage, apiTesting)

    if (!results) {

      const failure = ' an error occurred when trying to set a full block for this contact ID'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }

    let {
      company_name: companyName, 
      contact_name: contactName,
      email
    } = results[2].rows[0]

    if (companyName) contactName += ': ' + companyName

    contactName += `, using email: ${email}`

    const { campaign_name: campaignName } = results[3].rows[0]

    if (preference === 1) {

      const eventDetails = `This contact unsubcribed from the campaign <b>${stringCleaner(campaignName)}</b>.`
      recordEvent ({ apiTesting, event: 7, eventDetails, eventTarget: contactId, userId: apiKey })

    } else {

      const eventDetails = 'This contact asked for a complete block.'
      recordEvent ({ apiTesting, event: 8, eventDetails, eventTarget: contactId, userId: apiKey })

    }
    
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ success: true })

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

router.post("/update", async (req, res) => { 

  const nowRunning = "/campaigns/update"
  console.log(`${nowRunning}: running`)

  const errorNumber = 29
  const success = false

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`)
      return res.status(403).send('unauthorized')

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignId: Joi.string().required().uuid(),
      campaignInterval: Joi.number().required().integer().min(1).max(16),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow('', null),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when('campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow('', null),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageSeries: Joi.boolean().optional(),
      userId: Joi.string().required().uuid()
    })

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`)
      return res.status(422).send({ failure: errorMessage, success })

    }

    let { 
      active,
      apiTesting,
      campaignEnds,
      campaignId,
      campaignInterval,
      campaignName,
      campaignNotes,
      campaignRepeats,
      campaignStarts,
      listId,
      locked,
      messageSeries,
      userId 
    } = req.body

    const { level: userLevel } = await getUserLevel(userId)

    if (userLevel < 1) {

      console.log(nowRunning + ": aborted, invalid user ID\n")
      return res.status(404).send({ failure: 'invalid user ID', success })

    } 

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null
    !campaignNotes ? campaignNotes = '' : null
    !campaignRepeats ? campaignRepeats = false : null
    !campaignStarts ? campaignStarts = 0 : null
    locked ? locked = userLevel : locked = 0
    !messageSeries ? messageSeries = false : null
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format('X')

    // update the campaign

    const queryText = " UPDATE campaigns SET active = " + active + ", campaign_name = '" + stringCleaner(campaignName, true) + "', campaign_notes = '" + stringCleaner(campaignNotes, true) + "', campaign_repeats = " + campaignRepeats + ", ends = " + campaignEnds + ", interval = " + campaignInterval + ", list_id = '" + listId + "', locked = " + locked + ", message_series = " + messageSeries + ", starts = " + campaignStarts + ", updated = " + now + ", updated_by = '" + userId + "' WHERE campaign_id = '" + campaignId + "' AND locked <= " + userLevel + " RETURNING campaign_id; "
    const results = await db.transactionRequired(queryText, errorNumber, nowRunning, userId, apiTesting)

    if (!results.rows) {

      const failure = 'database error when updating a  campaign record'
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })
      
    }

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns(errorNumber, nowRunning, userId)

    if (!campaignsChecked) {

      console.log(`${nowRunning}: ${failure}\n`)
      recordError ({
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      })
      return res.status(200).send({ failure, success })

    }
    
    console.log(nowRunning + ": finished\n")
    return res.status(200).send({ closedCampaigns, success: true })

  } catch (e) {

    recordError ({
      context: `api: ${nowRunning}`,
      details: stringCleaner(JSON.stringify(e.message), true),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    })
    const newException = nowRunning + ': failed with an exception: ' + e
    console.log (e); 
    res.status(500).send(newException)

 }

})

module.exports = router;
console.log('campaign services loaded successfully!');