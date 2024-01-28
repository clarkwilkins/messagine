console.log( "loading messages services now..." );
const db = require( '../db' );
const express = require( 'express' );
const Joi = require( 'joi' );
const moment = require( 'moment' );
const router = express.Router();
const { v4: uuidv4 } = require( 'uuid' );
router.use( express.json() );

const { API_ACCESS_TOKEN } = process.env;
const { 
  containsHTML,
  getDynamicMessageReplacements,
  getUserLevel,
  recordError,
  stringCleaner,
  validateSchema
} = require( '../functions.js' );

router.post( "/all", async ( req, res ) => { 

  const nowRunning = "/messages/all";
  console.log( nowRunning + ": running" );

  const errorNumber = 37;
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

    let queryText = " SELECT m.*, u.user_name  FROM messages m, users u WHERE m.updated_by = u.user_id";   

    if ( typeof active === 'boolean' ) queryText += " AND m.active = " + active;

    queryText += " ORDER BY active DESC, message_name"
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting all messages';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } 

    const messages = {};
    const messagesSelector = [];

    Object.values( results.rows ).map( row => { 
      
      const {
        active,
        content,
        created,
        locked,
        message_id: messageId,
        message_name: messageName,
        notes,
        owner,
        repeatable,
        subject,
        updated,
        updatedBy,
        user_name: updatedBy2
      } = row;
      messages[messageId] = {
        active,
        content: stringCleaner( content ),
        created: +created,
        locked: +locked,
        messageName: stringCleaner( messageName ),
        notes: stringCleaner( notes ),
        owner,
        repeatable,
        subject: stringCleaner( subject ),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner( updatedBy2 )
      }
      let label = stringCleaner( messageName );

      if ( active !== true ) label += '*';

      messagesSelector.push( { label, value: messageId } );

    })
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { messages, messagesSelector, success: true } );

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

  const nowRunning = "/messages/delete";
  console.log( nowRunning + ": running" );

  const errorNumber = 36;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
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
      messageId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // delete the message only if it's not involved in ANY active campaigns

    let queryText = " DELETE FROM messages WHERE message_id = '" + messageId + "' AND locked <= " + userLevel + " AND message_id NOT IN ( SELECT cm.message_id FROM campaigns c, campaign_messages cm WHERE c.active = true AND c.campaign_id = cm.campaign_id AND cm.message_id = '" + messageId + "' ); ";
    let results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when deleting the message record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount < 1 ) {

      const failure = 'the message record was not deleted due to a bad ID or because it\'s linked to a running campaign';
      console.log( nowRunning + ": " + failure + "\n" );
      return res.status( 200 ).send( { failure, success: false } );

    }

    // delete the message ID from campaign links ONLY if the first part succeeded

    queryText = " DELETE FROM campaign_messages WHERE message_id = '" + messageId + "'; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when deleting the message from all linked campaigns';
      console.log( nowRunning + ": " + failure + "\n" );
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

router.post( "/dynamic/all", async ( req, res ) => { 

  const nowRunning = "/messages/dynamic/all";
  console.log( nowRunning + ": running" );

  const errorNumber = 43;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
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
      messageId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const {
      dynamicValues,
      failure: getDynamicValuesFailure,
      success: getDynamicValuesSuccess
    } = await getDynamicMessageReplacements( { errorNumber, messageId, userId } );

    if ( !getDynamicValuesSuccess ) {

      console.log( nowRunning + ": exited due to error on function getDynamicMessageReplacements\n" );
      return res.status( 200 ).send( { failure: getDynamicValuesFailure, success } );

    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { dynamicValues, success: true } );

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

router.post( "/dynamic/new", async ( req, res ) => { 

  const nowRunning = "/messages/dynamic/new";
  console.log( nowRunning + ": running" );

  const errorNumber = 42;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().required(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      newValue: Joi.alternatives().required().try(
        Joi.number(),
        Joi.string()
      ),
      target: Joi.string().required(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      locked,
      messageId,
      newValue,
      target,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    locked ? locked = userLevel: locked = 0;

    // create the dynamic values record

    const now = moment().format( 'X' );
    const queryText = " INSERT INTO dynamic_values( created, created_by, dynamic_id, locked, message_id, new_value, target_name, updated, updated_by ) VALUES( " + now + ", '" + userId + "', '" + uuidv4() + "', " + locked + ", '" + messageId + "', '" + stringCleaner( newValue, true ) + "', '" + stringCleaner( target, true ) + "', " + now + ", '" + userId + "' ) RETURNING created; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results?.rowCount ) {

      const failure = 'database error when creating the dynamic values record';
      console.log( nowRunning + ": " + failure + "\n" );
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

router.post( "/duplicate", async ( req, res ) => { 

  const nowRunning = "/messages/duplicate";
  console.log( nowRunning + ": running" );

  const errorNumber = 35;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageName: Joi.string().optional().allow( '', null ),
      sourceId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      locked,
      messageName,
      sourceId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // get the source message

    let queryText = " SELECT * FROM messages WHERE message_id = '" + sourceId + "'; ";
    let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when creating a new message record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount < 1 ) {

      const failure = 'source message not found';
      return res.status( 200 ).send( { failure, success } );

    }

    const {
      content,
      message_name: originalName,
      notes,
      repeatable,
      subject
    } = results.rows[0];

    locked ? locked = userLevel : locked = 0;
    !messageName ? messageName = 'copy of ' + originalName: messageName = stringCleaner( messageName, true );
    const now = moment().format( 'X' );
    queryText = " INSERT INTO messages ( content, created, locked, message_id, message_name, notes, owner, repeatable, subject, updated, updated_by ) VALUES( '" + content + "', " + now + ", " + locked + ", '" + uuidv4() + "', '" + messageName + "', '" + notes + "', '" + userId + "', " + repeatable + ", '" + subject + "', " + now + ", '" + userId + "' ) ON CONFLICT DO NOTHING RETURNING message_id; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when duplicating the message record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount < 1 ) {

      const failure = 'the duplicate was not created, please make sure you are not trying to use the same message name';
      console.log( nowRunning + ": " + failure + "\n" );
      return res.status( 200 ).send( { failure, success: false } );

    }

    const messageId = results.rows[0].message_id;    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { messageId, success: true } );

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

  const nowRunning = "/messages/load";
  console.log( nowRunning + ": running" );

  const errorNumber = 38;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
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
      messageId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const queryText = " SELECT m.*, u.user_name  FROM messages m, users u WHERE m.updated_by = u.user_id AND m.message_id = '" + messageId + "'; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting the message';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( !results.rows[0]?.message_id ) {

      const failure = 'messageId ' + messageId + ' was not found';
      return res.status( 200 ).send( { failure, success } );
      
    }
      
    const {
      active,
      content,
      created,
      locked,
      message_name: messageName,
      notes,
      owner,
      repeatable,
      subject,
      updated,
      updatedBy,
      user_name: updatedBy2
    } = results.rows[0];
    
    console.log( nowRunning + ": finished\n" ); const a = results.rows;
    return res.status( 200 ).send( { 
      active,
      content: stringCleaner( content ),
      created: +created,
      locked: +locked,
      messageName: stringCleaner( messageName ),
      notes: stringCleaner( notes ),
      owner,
      repeatable,
      subject: stringCleaner( subject ),
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

router.post( "/new", async ( req, res ) => { 

  const nowRunning = "/messages/new";
  console.log( nowRunning + ": running" );

  const errorNumber = 33;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageContent: Joi.string().required(),
      messageName: Joi.string().required(),
      messageNotes: Joi.string().optional().allow( '', null ),
      messageSubject: Joi.string().required(),
      repeatable: Joi.boolean().required(),
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
      locked,
      messageContent,
      messageName,
      messageNotes,
      messageSubject,
      repeatable,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    locked ? locked = userLevel : locked = 0;
    messageNotes ? messageNotes = stringCleaner( messageNotes, true ) : messageNotes = ''; 
    const now = moment().format( 'X' );

    // create the message

    const queryText = " INSERT INTO messages( active, created, content, locked, message_id, message_name, notes, owner, repeatable, subject, updated, updated_by ) VALUES ( " + active + ", " + now + ", '" + stringCleaner( messageContent, true ) + "', " + locked + ", '" + uuidv4() + "', '" + stringCleaner( messageName, true ) + "', '" + messageNotes + "', '" + userId + "', " + repeatable + ", '" + stringCleaner( messageSubject, true ) + "', " + now + ", '" + userId + "' ) RETURNING message_id; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when creating a new message record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const messageId = results.rows[0].message_id;
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { messageId, success: true } );

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

  const nowRunning = "/messages/update";
  console.log( nowRunning + ": running" );

  const errorNumber = 34;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageContent: Joi.string().required(),
      messageId: Joi.string().required().uuid(),
      messageName: Joi.string().required(),
      messageNotes: Joi.string().optional().allow( '', null ),
      messageSubject: Joi.string().required(),
      repeatable: Joi.boolean().required(),
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
      locked,
      messageContent,
      messageId,
      messageName,
      messageNotes,
      messageSubject,
      repeatable,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    messageNotes ? messageNotes = stringCleaner( messageNotes, true ) : messageNotes = ''; 
    const now = moment().format( 'X' );

    // update the message

    let queryText = " UPDATE messages SET active = " + active + ", locked = ";
    locked ? queryText += userLevel : queryText += locked;
    queryText += ", content = '" + stringCleaner( messageContent, true ) + "', message_name = '" + stringCleaner( messageName, true ) +  "', notes = '";
    messageNotes ? queryText += stringCleaner( messageNotes, true ) : queryText += "";
    queryText += "', repeatable = " + repeatable + ", subject = '" + stringCleaner( messageSubject, true ) + "', updated = " + moment().format( 'X' ) + ", updated_by = '" + userId + "' WHERE message_id = '" + messageId + "' AND locked <= " + userLevel + "; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when updating the message record';
      console.log( nowRunning + ": " + failure + "\n" );
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

module.exports = router;
console.log( 'messages services loaded successfully!' );