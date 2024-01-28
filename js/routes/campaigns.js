console.log( "loading campaign services now..." );
const db = require( '../db' );
const express = require( 'express' );
const Joi = require( 'joi' );
const moment = require( 'moment' );
const router = express.Router();
const { v4: uuidv4 } = require( 'uuid' );
router.use( express.json() );

const { API_ACCESS_TOKEN } = process.env;
const { 
  checkCampaigns,
  containsHTML,
  getUserLevel,
  processCampaigns,
  recordError,
  stringCleaner,
  validateSchema
} = require( '../functions.js' );

router.post( "/all", async ( req, res ) => { 

  const nowRunning = "/campaigns/all";
  console.log( nowRunning + ": running" );

  const errorNumber = 31;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional().allow( '', null ),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      active,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // check/adjust campaigns first

    const { failure, success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }

    let queryText = " SELECT c.*, u.user_name  FROM campaigns c, users u WHERE c.updated_by = u.user_id";   

    if ( typeof active === 'boolean' ) queryText += " AND c.active = " + active;

    queryText += " ORDER BY active DESC, campaign_name"
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting all campaigns';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } 

    const campaigns = {};
    const campaignsSelector = [];

    Object.values( results.rows ).map( row => { 
      
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
      } = row;
      campaigns[campaignId] = {
        active,
        campaignName: stringCleaner( campaignName ),
        campaignNotes: stringCleaner( campaignNotes, false, !containsHTML( campaignNotes ) ),
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
        updatedBy2: stringCleaner( updatedBy2 )
      }
      let label = stringCleaner( campaignName );

      if ( active !== true ) label += '*';

      campaignsSelector.push( { label, value: campaignId } );

    })
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { campaigns, campaignsSelector, success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/delete", async ( req, res ) => { 

  const nowRunning = "/campaigns/delete";
  console.log( nowRunning + ": running" );

  const errorNumber = 30;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().optional().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      campaignId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 5 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // delete the campaign

    const queryText = " DELETE FROM campaigns WHERE campaign_id = '" + campaignId + "' AND locked <= '" + userLevel + "' RETURNING campaign_id; ";    
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when deleting the campaign record';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount < 1 ) { // bad ID or the record is locked

      const failure = 'the campaign record was not deleted';
      return res.status( 200 ).send( { failure, success } );

    }

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { campaignId, closedCampaigns, success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/load", async ( req, res ) => { 

  const nowRunning = "/campaigns/load";
  console.log( nowRunning + ": running" );

  const errorNumber = 32;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      campaignId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // check/adjust campaigns first

    const { failure, success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }

    const queryText = " SELECT c.*, u.user_name  FROM campaigns c, users u WHERE c.updated_by = u.user_id AND c.campaign_id = '" + campaignId + "'; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting the campaign';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( !results.rows[0]?.campaign_id ) {

      const failure = 'campaignId ' + campaignId + ' was not found';
      return res.status( 200 ).send( { failure, success } );
      
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
    } = results.rows[0];
    
    console.log( nowRunning + ": finished\n" ); const a = results.rows;
    return res.status( 200 ).send( { 
      active,
      campaignName: stringCleaner( campaignName ),
      campaignNotes: stringCleaner( campaignNotes, false, !containsHTML( campaignNotes ) ),
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
      updatedBy2: stringCleaner( updatedBy2 )
    } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/messages/add", async ( req, res ) => { 

  const nowRunning = "/campaigns/messages/add";
  console.log( nowRunning + ": running" );

  const errorNumber = 39;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // doing some cleanup before we connect the message

    const { success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }

    // check for the next position

    let queryText = " SELECT max( position ) FROM campaign_messages WHERE campaign_id = '" + campaignId + "'; ";
    let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when checking current message position';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    let nextPosition = +results.rows[0]?.max + 1 || 1;

    queryText = " INSERT INTO campaign_messages( campaign_id, message_id, position ) VALUES ( '" + campaignId + "', '" + messageId + "', " + nextPosition + " ) RETURNING position; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows || results.rowCount != 1 ) {

      const failure = 'database error when adding a message to the campaign';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { nextPosition, success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/messages/remove", async ( req, res ) => { 

  const nowRunning = "/campaigns/messages/remove";
  console.log( nowRunning + ": running" );

  const errorNumber = 40;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      position: Joi.number().optional().integer().positive(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
      position,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    let queryText = " DELETE FROM campaign_messages WHERE campaign_id = '" + campaignId + "' AND message_id = '" + messageId + "' ";

    // this is just in case we have N > 1 of the same message for some reason and want to remove a specific instance

    if ( +position ) queryText += " AND position = " + position; 

    // the second part will get what's left so we can do repositioning

    queryText += "; SELECT * FROM campaign_messages WHERE campaign_id = '" + campaignId + "' ORDER BY position; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results[0].rows ) {

      const failure = 'database error when removing a message from the campaign';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    // if there are any remaining messages, they are now renumbered

    if ( results[1].rowCount > 0 ) {

      queryText = " DELETE FROM campaign_messages WHERE campaign_id = '" + campaignId + "'; ";

      Object.values( results[1].rows ).map( ( row, key ) => {

        const {
          campaign_id: campaignId,
          message_id: messageId,
          last_sent: lastSent
        } = row;
        const position = +key + 1;
        queryText += " INSERT INTO campaign_messages( campaign_id, message_id, last_sent, position ) VALUES( '" + campaignId + "', '" + messageId + "', " + +lastSent + ", " + position + " ); "

      });

      results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

      if ( !results ) {

        const failure = 'database error when repositiong remaining messages in the campaign';
        console.log( `${nowRunning}: ${failure}\n` )
        recordError ( {
          context: 'api: ' + nowRunning,
          details: queryText,
          errorMessage: failure,
          errorNumber,
          userId
        } );
        return res.status( 200 ).send( { failure, success } );
        
      }

    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/new", async ( req, res ) => { 

  const nowRunning = "/campaigns/new";
  console.log( nowRunning + ": running" );

  const errorNumber = 28;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignInterval: Joi.number().required().integer().min( 1 ).max( 16 ),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow( '', null ),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when( 'campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow( '', null ),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageSeries: Joi.boolean().optional(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

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
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null;
    !campaignNotes ? campaignNotes = '' : null;
    !campaignRepeats ? campaignRepeats = false : null;
    !campaignStarts ? campaignStarts = 0 : null;
    locked ? locked = userLevel : locked = 0;
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format( 'X' );

    // create the campaign

    const queryText = " INSERT INTO campaigns( active, campaign_id, campaign_name, campaign_notes, campaign_repeats, created, ends, list_id, interval, locked, message_series, starts, updated, updated_by ) VALUES ( " + active + ", '" + uuidv4() + "', '" + stringCleaner( campaignName, true )  + "', '" + stringCleaner( campaignNotes, true ) + "', " + campaignRepeats + ", " + now + ", " + campaignEnds + ", '" + listId + "', " + campaignInterval + ", " + locked + ", " + messageSeries + ", " + campaignStarts + ", " + now + ", '" + userId + "' ) RETURNING campaign_id; ";    
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when creating a new campaign record';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const campaignId = results.rows[0].campaign_id;

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { campaignId, closedCampaigns, success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/run", async ( req, res ) => { 

  const nowRunning = "/campaigns/run";
  console.log( nowRunning + ": running" );

  const errorNumber = 41;
  const success = false;
  console.log( req.body )

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      masterKey: Joi.any()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    const userId = API_ACCESS_TOKEN; // we need a user ID but this runs as a crontab job

    // get all campaigns that have a message that is eligible to run now

    const queryText = " SELECT c.campaign_id, c.campaign_name, c.campaign_repeats, c.ends, c.interval, c.list_id, c.message_series, c.next_run, m.content, m.message_id, m.message_name, m.subject FROM campaigns c, campaign_messages cm, messages m WHERE c.active = true AND ( c.next_run <= " + moment().format( 'X' ) + " OR c.next_run IS NULL ) AND c.campaign_id = cm.campaign_id AND cm.message_id = m.message_id AND m.active = true ORDER BY last_sent, position; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting all campaigns';
      console.log( `${nowRunning}: ${failure}\n` )
      await recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const eligibleCampaigns = results.rows;
    const campaignLimiter = [];

    const processCampaignsPromises = eligibleCampaigns.map(async (row) => {
      
      try {

        // get the campaign parameters and the next message in line to send

        const {
          campaign_id: campaignId,
          content: messageContent,
          list_id: listId,
          message_id: messageId,
          message_name: messageName,
          subject: messageSubject
        } = row;

        // sometimes there will be N > 1 messages waiting to run on a campaign cycle, but we need to not send more than one per interval

        if ( campaignLimiter.includes( campaignId ) ) {

          console.log(`campaign ${campaignId} was limited to sending just one message per cycle` );
          return { campaignsProcessedSuccess: true }; // note that allCampaignsProcessedResults will only have this single value when the limiter is invoked.

        }

        campaignLimiter.push( campaignId ); // prevents the campaign from sending any more emails on this run

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
        });
    
        // log or handle the successful campaign processing (to be replaced with history)

        console.log(`campaign ${campaignId} processed successfully`);
    
        return {
          campaignId,
          messageId: row.message_id,
          campaignsProcessedFailure,
          campaignsProcessedSuccess
        };

      } catch (error) {

        // log or handle the failed campaign processing (to be replaced with history)

        console.error(`Campaign ${row.campaign_id} processing failed:`, error);

        return {
          campaignId: row.campaign_id,
          messageId: row.message_id,
          campaignsProcessedFailure: error.message,
          campaignsProcessedSuccess: null
        };

      }

    });
    
    // creates an array of the results of processing each eligible campaign

    const allCampaignsProcessedResults = await Promise.all(processCampaignsPromises);

    // this returns true only if every campaign processed with no error
  
    const allCampaignsProcessed = allCampaignsProcessedResults.every( (result) => !result.campaignsProcessedFailure );
  
    console.log(nowRunning + ": finished\n");
    return res.status(200).send({ success: true, allCampaignsProcessed, allCampaignsProcessedResults });

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/update", async ( req, res ) => { 

  const nowRunning = "/campaigns/update";
  console.log( nowRunning + ": running" );

  const errorNumber = 29;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignId: Joi.string().required().uuid(),
      campaignInterval: Joi.number().required().integer().min( 1 ).max( 16 ),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow( '', null ),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when( 'campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow( '', null ),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageSeries: Joi.boolean().optional(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

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
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null;
    !campaignNotes ? campaignNotes = '' : null;
    !campaignRepeats ? campaignRepeats = false : null;
    !campaignStarts ? campaignStarts = 0 : null;
    locked ? locked = userLevel : locked = 0;
    !messageSeries ? messageSeries = false : null;
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format( 'X' );

    // update the campaign

    const queryText = " UPDATE campaigns SET active = " + active + ", campaign_name = '" + stringCleaner( campaignName, true ) + "', campaign_notes = '" + stringCleaner( campaignNotes, true ) + "', campaign_repeats = " + campaignRepeats + ", ends = " + campaignEnds + ", interval = " + campaignInterval + ", list_id = '" + listId + "', locked = " + locked + ", message_series = " + messageSeries + ", starts = " + campaignStarts + ", updated = " + now + ", updated_by = '" + userId + "' WHERE campaign_id = '" + campaignId + "' AND locked <= " + userLevel + " RETURNING campaign_id; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when updating a  campaign record';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { closedCampaigns, failure, success: campaignsChecked } = await checkCampaigns( errorNumber, nowRunning, userId );

    if ( !campaignsChecked ) {

      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );

    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { closedCampaigns, success: true } );

  } catch ( e ) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
    } );
    const newException = nowRunning + ': failed with an exception: ' + e;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

module.exports = router;
console.log( 'campaign services loaded successfully!' );