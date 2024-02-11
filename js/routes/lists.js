console.log( "loading lists services now..." );
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

  const nowRunning = "/lists/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 25;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      stringFilter: Joi.string().optional().allow( '', null ),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

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

    let queryText = " SELECT l.*, u.user_name FROM lists l, users u WHERE l.updated_by = u.user_id ";

    if ( typeof active === 'boolean' ) queryText += " AND l.active = " + active;

    if ( stringFilter.length > 2 ) queryText += " AND l.list_name ILIKE '%" + stringFilter + "%' ";

    queryText += " ORDER BY active DESC, list_name; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if (!results.rows) {

      const failure = 'database error when getting list records';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    }

    const lists = {};
    const listsSelector = [];

    Object.values( results.rows ).map( row => {

      let {
        accept_contacts: acceptContacts,
        active,
        created,
        list_id: listId,
        list_name: listName,
        list_notes: listNotes,
        locked,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;

      lists[listId] = {
        acceptContacts,
        active,
        created: +created,
        listName: stringCleaner( listName ),
        listNotes: stringCleaner( listNotes, false, !containsHTML( listNotes ) ),
        locked: +locked,
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner( updatedBy2 )
      }
      listsSelector.push({
        label: listName,
        value: listId
      })

    });
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { lists, listsSelector, success: true } );

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

router.post( "/contact-linking", async ( req, res ) => { 

  const nowRunning = "/lists/contact-linking";
  console.log(`${nowRunning}: running`);

  const errorNumber = 27;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      contactId: Joi.string().required().uuid(),
      link: Joi.boolean().required(),
      listId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

    }

    let { 
      apiTesting,
      contactId,
      link,
      listId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 
    
    let queryText;

    if ( link === false ) {

      queryText = " DELETE FROM list_contacts WHERE contact_id = '" + contactId + "' AND list_id = '" + listId + "'; ";

    } else {

      const now = moment().format( 'X' );
      queryText = " INSERT INTO list_contacts ( contact_id, created, list_id, updated, updated_by ) VALUES ( '" + contactId + "', " + now + ", '" + listId + "', " + now + ", '" + userId + "' ); "

    }

    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if (!results.rows) {

      const failure = 'database error when getting list records';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
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

router.post( "/load", async ( req, res ) => { 

  const nowRunning = "/lists/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 26;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      listId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

    }

    let { 
      listId,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    let queryText = " SELECT l.*, u.user_name FROM lists l, users u WHERE l.list_id = '" + listId + "' AND l.updated_by = u.user_id; ";
    let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if (!results.rows) {

      const failure = 'database error when getting the list metadata';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( !results.rowCount ) {

      const failure = 'list ID was not found';
      return res.status(200).send({ failure, success })

    }

    let {
      accept_contacts: acceptContacts,
      active,
      created,
      list_name: listName,
      list_notes: listNotes,
      locked,
      updated,
      updated_by: updatedBy,
      user_name: updatedBy2
    } = results.rows[0];

    // now get contacts on this list

    const linkedContacts = {};

    queryText = " SELECT c.* FROM contacts c, list_contacts lc WHERE c.contact_id = lc.contact_id AND lc.list_id = '" + listId + "' AND c.active = true AND c.block_all = false ORDER BY c.contact_name, c.company_name, c.email; "
    results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if (!results.rows) {

      const failure = 'database error when getting the linked contacts';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    }

    Object.values( results.rows ).map( row=> {

      const {
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        email,
        updated
      } = row;

      fullName = contactName;

      if ( companyName ) fullName += ',' + companyName;

      linkedContacts[contactId] = {
        contactNotes: stringCleaner( contactNotes, false, !containsHTML( contactNotes ) ),
        email,
        fullName: stringCleaner( fullName ),
        updated: moment.unix( updated ).format( 'YYYY.MM.DD' )
      }

    })

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { 
      acceptContacts,
      active,
      created: +created,
      linkedContacts,
      listName: stringCleaner( listName ),
      listNotes: stringCleaner( listNotes, false, !containsHTML( listNotes ) ),
      locked: +locked,
      success: true,
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner( updatedBy2 )
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

  const nowRunning = "/lists/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 23;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      listName: Joi.string().required(),
      listNotes: Joi.string().optional().allow( '', null ),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

    }

    let { 
      apiTesting,
      listName,
      listNotes,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const listId = uuidv4();
    listName = stringCleaner( listName, true );
    listNotes ? listNotes = stringCleaner( listNotes, true ) : listNotes = '';
    const now = moment().format( 'X' );

    const queryText = " INSERT INTO lists( created, list_id, list_name, list_notes, locked, updated, updated_by ) VALUES( " + now + ", '" + listId + "', '" + listName + "', '" + listNotes + "', 0, " + now + ", '" + userId + "' ) ON CONFLICT DO NOTHING RETURNING list_id; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if (!results.rows) {

      const failure = 'database error when creating a new list record';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( results.rowCount === 0 ) {

      const failure = 'attempt to create a duplicate list was blocked';
      console.log(`${nowRunning}: ${failure}\n`)
      return res.status(200).send({ failure, success })

    }
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { listId, success: true } );

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

  const nowRunning = "/lists/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 24;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      acceptContacts: Joi.boolean().optional(),
      active: Joi.boolean().optional(),
      apiTesting: Joi.boolean().optional(),
      listId: Joi.string().required().uuid(),
      listName: Joi.string().required(),
      listNotes: Joi.string().optional().allow( '', null ),
      locked: Joi.boolean().optional().allow( '', null ),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema(nowRunning, recordError, req, schema)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

    }

    let { 
      acceptContacts,
      active,
      apiTesting,
      listId,
      listName,
      listNotes,
      locked,
      userId 
    } = req.body;

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    }

    listName = stringCleaner( listName, true );
    listNotes ? listNotes = stringCleaner( listNotes, true ) : listNotes = '';

    queryText = " UPDATE lists SET list_name = '" + listName + "', list_notes = '" + listNotes + "', updated = " + moment().format( 'X' ) + ", updated_by = '" + userId + "'";
    
    if ( acceptContacts && typeof acceptContacts === 'boolean' ) queryText += ", accept_contacts = " + acceptContacts ;

    if ( active && typeof active === 'boolean' ) queryText += ", active = " + active ;

    if ( locked && locked === true  ) { 
      
      queryText += ", locked = " + userLevel + " "; 
    
    } else if ( locked === false ) { 

      queryText += ", locked = 0 ";

    } else {
      
      queryText += ", locked = locked "; 
  
    }
    
    queryText += " WHERE list_id = '" + listId + "' AND locked <= " + userLevel + " RETURNING list_id; ";
    results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if (!results.rows) {

      const failure = 'database error when updating contact record';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( results.rowCount === 0 ) {

      const failure = 'attempt to create a duplicate contact name/email pair was blocked';
      console.log(`${nowRunning}: ${failure}\n`)
      return res.status(200).send({ failure, success })
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
console.log( 'lists services loaded successfully!' );