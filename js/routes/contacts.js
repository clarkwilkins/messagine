console.log( "loading contacts services now..." );
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
  getUserLevel,
  recordError,
  stringCleaner,
  validateSchema
} = require( '../functions.js' );

router.post( "/all", async ( req, res ) => { 

  const nowRunning = "/contacts/all";
  console.log( nowRunning + ": running" );

  const errorNumber = 20;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      stringFilter: Joi.string().optional().allow( '', null ),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      active,
      stringFilter,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 
    
    if ( !stringFilter ) stringFilter = '';

    if ( stringFilter.length > 2 ) stringFilter = stringCleaner( stringFilter, true );

    let queryText = " SELECT c.*, u.user_name FROM contacts c, users u WHERE c.updated_by = u.user_id ";

    if ( typeof active === 'boolean' ) queryText += " AND c.active = " + active;

    if ( stringFilter.length > 2 ) queryText += " AND ( c.company_name ILIKE '%" + stringFilter + "%' OR c.contact_name ILIKE '%" + stringFilter + "%' OR c.email ILIKE '%" + stringFilter + "%' ) ";

    queryText += " ORDER BY block_all, active DESC, contact_name; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting contact records';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const contacts = {};
    const contactsSelector = [];

    Object.values( results.rows ).map( row => {

      let {
        active,
        block_all: blockAll,
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        created,
        email,
        locked,
        sms,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;
      let fullName = contactName;

      if ( companyName ) fullName += ', ' + companyName;

      fullName = stringCleaner( fullName );

      contacts[contactId] = {
        active,
        blockAll,
        companyName: stringCleaner( companyName ),
        contactName: stringCleaner( contactName ),
        contactNotes: stringCleaner( contactNotes, false, !containsHTML( contactNotes ) ),
        created: +created,
        email: stringCleaner( email ),
        fullName,
        locked: +locked,
        sms: stringCleaner( sms ),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner( updatedBy2 )
      }
      contactsSelector.push({
        label: fullName,
        value: contactId
      })

    });
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { contacts, contactsSelector, success: true } );

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
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

  const nowRunning = "/contacts/load";
  console.log( nowRunning + ": running" );

  const errorNumber = 21;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      contactId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      contactId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const queryText = " SELECT c.*, u.user_name FROM contacts c, users u WHERE c.contact_id = '" + contactId + "' AND c.updated_by = u.user_id; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting contact records';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( !results.rowCount ) {

      const failure = 'contact ID was not found';
      return res.status( 200 ).send( { failure, success } );

    }

    let {
      active,
      block_all: blockAll,
      company_name: companyName,
      contact_name: contactName,
      contact_notes: contactNotes,
      created,
      email,
      locked,
      sms,
      updated,
      updated_by: updatedBy,
      user_name: updatedBy2
    } = results.rows[0];

    let fullName = contactName;

    if ( companyName ) fullName += ', ' + companyName;

    fullName = stringCleaner( fullName );
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { 
      active,
      blockAll,
      companyName: stringCleaner( companyName ),
      contactName: stringCleaner( contactName ),
      contactNotes: stringCleaner( contactNotes, false, !containsHTML( contactNotes ) ),
      created: +created,
      email: stringCleaner( email ),
      fullName,
      locked: +locked,
      sms: stringCleaner( sms ),
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner( updatedBy2 ),
      success: true 
    } );

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
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

  const nowRunning = "/contacts/new";
  console.log( nowRunning + ": running" );

  const errorNumber = 18;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      companyName: Joi.string().optional().allow( '', null ),
      contactName: Joi.string().required(),
      contactNotes: Joi.string().optional().allow( '', null ),
      email: Joi.string().required(),
      locked: Joi.boolean(),
      masterKey: Joi.any(),
      sms: Joi.string().optional().allow( '', null ),
      url: Joi.string().optional().allow( '', null ),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let { 
      apiTesting,
      companyName,
      contactName,
      contactNotes,
      email,
      locked,
      sms,
      url,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const contactId = uuidv4();
    companyName ? companyName = stringCleaner( companyName, true ) : companyName = '';
    contactName = stringCleaner( contactName, true );
    contactNotes ? contactNotes = stringCleaner( contactNotes, true ) : contactNotes = '';
    email = stringCleaner( email, true );
    locked ? locked = +userLevel : locked = 0;
    const now = moment().format( 'X' );
    sms ? sms = stringCleaner( sms, true ) : sms = '';
    url ? url = stringCleaner( url, true ) : url = '';

    const queryText = " INSERT INTO contacts( company_name, contact_id, contact_name, contact_notes, created, email, locked, sms, updated, updated_by ) VALUES( '" + companyName + "', '" + contactId + "', '" + contactName + "', '" + contactNotes + "', " + now + ", '" + email + "', " + locked + ", '" + sms + "', " + now + ", '" + userId + "' ) ON CONFLICT DO NOTHING RETURNING contact_id; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when creating a new contact record';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount === 0 ) {

      const failure = 'attempt to create a duplicate contact name/email pair was blocked';
      console.log( `${nowRunning}: ${failure}\n` )
      return res.status( 200 ).send( { failure, success } );

    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { contactId, success: true } );

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
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

router.post( "/search", async ( req, res ) => { 

  const nowRunning = "/contacts/search";
  console.log( nowRunning + ": running" );

  const errorNumber = 22;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional().allow( '', null ),
      blockAll: Joi.boolean().optional().allow( '', null ),
      companyName: Joi.string().optional().min( 3 ).allow( '', null ),
      contactName: Joi.string().optional().min( 3 ).allow( '', null ),
      contactNotes: Joi.string().optional().min( 3 ).allow( '', null ),
      email: Joi.string().optional().min( 5 ).allow( '', null ),
      masterKey: Joi.any(),
      sms: Joi.string().optional().min( 3 ).allow( '', null ),
      url: Joi.string().optional().min( 7 ).allow( '', null )
    } )
    .or( 'active', 'blockAll', 'companyName', 'contactName', 'contactNotes', 'sms', 'url');

    const errorMessage = validateSchema( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    let {
      active,
      apiTesting,
      blockAll,
      companyName,
      contactName,
      contactNotes,
      email,
      sms,
      url,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    let queryText = " SELECT c.*, u.user_name FROM contacts c, users u WHERE c.updated_by = u.user_id";

    if ( typeof active === 'boolean' ) queryText += " AND active = " + active;

    if ( typeof blockAll === 'boolean' ) queryText += " AND block_all = " + blockAll;

    if ( companyName ) queryText += " AND company_name ILIKE '%" + stringCleaner( companyName ) + "%'";

    if ( contactName ) queryText += " AND contact_name ILIKE '%" + stringCleaner( contactName ) + "%'";

    if ( contactNotes ) queryText += " AND contact_notes ILIKE '%" + stringCleaner( contactNotes ) + "%'";

    if ( email ) queryText += " AND email ILIKE '%" + stringCleaner( email ) + "%'";

    if ( sms ) queryText += " AND sms ILIKE '%" + stringCleaner( sms ) + "%'";

    if ( url ) queryText += " AND url ILIKE '%" + stringCleaner( url ) + "%'";

    queryText += " ORDER BY active DESC, block_all, contact_name, company_name; ";

    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when searching contact records';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const contacts = {};
    const contactsSelector = [];

    Object.values( results.rows ).map( row => {

      let {
        active,
        block_all: blockAll,
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        created,
        email,
        locked,
        sms,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;
      let fullName = contactName;

      if ( companyName ) fullName += ', ' + companyName;

      fullName = stringCleaner( fullName );

      contacts[contactId] = {
        active,
        blockAll,
        companyName: stringCleaner( companyName ),
        contactName: stringCleaner( contactName ),
        contactNotes: stringCleaner( contactNotes, false, !containsHTML( contactNotes ) ),
        created: +created,
        email: stringCleaner( email ),
        fullName,
        locked: +locked,
        sms: stringCleaner( sms ),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner( updatedBy2 )
      }
      contactsSelector.push({
        label: fullName,
        value: contactId
      })

    });
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { contacts, contactsSelector, success: true } );

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
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

  const nowRunning = "/contacts/update";
  console.log( nowRunning + ": running" );

  const errorNumber = 19;
  const success = false;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional(),
      apiTesting: Joi.boolean().optional(),
      blockAll: Joi.boolean().optional(),
      contactId: Joi.string().required().uuid(),
      companyName: Joi.string().optional().allow( '', null ),
      contactName: Joi.string().required(),
      contactNotes: Joi.string().optional().allow( '', null ),
      email: Joi.string().required(),
      locked: Joi.boolean(),
      masterKey: Joi.any(),
      sms: Joi.string().optional().allow( '', null ),
      url: Joi.string().optional().allow( '', null ),
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
      blockAll,
      contactId,
      companyName,
      contactName,
      contactNotes,
      email,
      locked,
      sms,
      url,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // test the contact ID before trying to update (this also gets the current lock)

    let queryText = " SELECT locked FROM contacts WHERE contact_id = '" + contactId + "'; ";
    let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when checking the contact ID';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount !== 1 ) { // invalid contact ID

      const failure = 'the contact ID is not valid';
      console.log( `${nowRunning}: ${failure}\n` )
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( +results.rows[0].locked > userLevel ) { // the record is locked

      const failure = 'the contact record is locked to ' + level + '+';
      console.log( `${nowRunning}: ${failure}\n` )
      return res.status( 200 ).send( { failure, success } );

    }

    companyName ? companyName = stringCleaner( companyName, true ) : companyName = '';
    contactName = stringCleaner( contactName, true );
    contactNotes ? contactNotes = stringCleaner( contactNotes, true ) : contactNotes = '';
    email = stringCleaner( email, true );
    const now = moment().format( 'X' );
    sms ? sms = stringCleaner( sms, true ) : sms = '';
    url ? url = stringCleaner( url, true ) : url = '';

    queryText = " UPDATE contacts SET company_name = '" + companyName + "', contact_name = '" + contactName + "', contact_notes = '" + contactNotes + "', email = '" + email + "', sms = '" + sms + "', updated = " + now + ", updated_by = '" + userId + "', url = '" + url + "'"; 

    if ( typeof active === 'boolean' ) queryText += " , active = " + active ;

    if ( typeof blockAll === 'boolean' && +userLevel > 6 ) queryText += " , block_all = " + blockAll ; // note this requires level 7+

    if ( locked && locked === true  ) { 
      
      queryText += ", locked = " + userLevel + " "; 
    
    } else if ( locked === false ) { 

      queryText += ", locked = 0 ";

    } else {
      
      queryText += ", locked = locked "; 
  
    }
        
    queryText += " WHERE contact_id = '" + contactId + "' AND locked <= " + userLevel + " RETURNING contact_id; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when updating contact record';
      console.log( `${nowRunning}: ${failure}\n` )
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status( 200 ).send( { failure, success } );
      
    } else if ( results.rowCount === 0 ) {

      const failure = 'attempt to create a duplicate contact name/email pair was blocked';
      console.log( `${nowRunning}: ${failure}\n` )
      return res.status( 200 ).send( { failure, success } );
    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true } );

  } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
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
console.log( 'contact services loaded successfully!' );