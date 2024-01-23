console.log( "loading utilities routes now..." );
const bcrypt = require( 'bcrypt' );
const db = require( '../db' );
const express = require( 'express' );
const fs = require( 'fs' );
const Joi = require( 'joi' );
const jwt = require ( 'jsonwebtoken' );
const moment = require( 'moment' );
const { replace } = require( 'lodash' );
const router = express.Router();
const { v4: uuidv4 } = require( 'uuid' );
router.use( express.json() );

const { API_ACCESS_TOKEN } = process.env;
const { 
  getUserLevel,
  recordError,
  stringCleaner,
  validateSchema
} = require( '../functions.js' );

router.post( "/hashtags/all", async ( req, res ) => {

  const nowRunning = "utilities/hashtags/all";
  console.log( nowRunning + ": running" );

  let success = false;
  const errorNumber = 9;
  
  try {

    const schema = Joi.object( { 
      active: Joi.boolean(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid().uuid()
    } );

    const errorMessage = validateSchema ( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    const {
      active,
      userId
    } = req.body

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    let queryText = " SELECT * FROM tags ";

    if ( typeof active === 'boolean' ) queryText += "WHERE active = " + active;

    queryText += " ORDER BY active DESC, tag_text; ";
    const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

    if ( !results.rows ) {

      const failure = 'database error when getting tags';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId: API_ACCESS_TOKEN
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    const tags = {};
    const tagsSelector = [];
    Object.values( results.rows ).map( row => {

      let {
        active,
        notes,
        tag_id: tagId,
        tag_text: tagText
      } = row;

      notes = stringCleaner( notes );
      tagText = stringCleaner( tagText );

      tags[tagId] = {
        active,
        notes,
        tagText
      }

      tagText = '#' + tagText;

      if ( !active ) tagText += '*';

      tagsSelector.push( {
        label: tagText,
        value: tagId
      })

    })

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true, tags, tagsSelector } );

  } catch (e) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner(  e.message ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: API_ACCESS_TOKEN
    } );
    const newException = nowRunning + ': failed with an exception: ' + e.message;
    console.log ( e );
    res.status( 500 ).send( newException );

  }

} );

router.post( "/hashtags/create", async ( req, res ) => {

  const nowRunning = "utilities/hashtags/create";
  console.log( nowRunning + ": running" );

  let success = false;
  const errorNumber = 7;
  
  try {

    const schema = Joi.object( { 
      apiTesting: Joi.boolean(),
      notes: Joi.string().optional().allow( '', null ),
      masterKey: Joi.any(),
      tagText: Joi.string().required().min( 3 ).max( 30 ),
      userId: Joi.string().required().uuid().uuid()
    } );

    const errorMessage = validateSchema ( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    const {
      apiTesting,
      notes,
      tagText,
      userId
    } = req.body

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const queryText = " INSERT INTO tags ( notes, tag_id, tag_text ) VALUES( '" + stringCleaner( notes, true ) + "', '" + uuidv4() + "', '" + stringCleaner( tagText, true ) + "' ); ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when creating a new tag record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId: API_ACCESS_TOKEN
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true } )

  } catch (e) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner(  e.message ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: API_ACCESS_TOKEN
    } );
    const newException = nowRunning + ': failed with an exception: ' + e.message;
    console.log ( e );
    res.status( 500 ).send( newException );

  }

} );

router.post( "/hashtags/delete", async ( req, res ) => {

  const nowRunning = "utilities/hashtags/delete";
  console.log( nowRunning + ": running" );

  let success = false;
  const errorNumber = 8;
  
  try {

    const schema = Joi.object( { 
      apiTesting: Joi.boolean(),
      masterKey: Joi.any(),
      tagId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid().uuid()
    } );

    const errorMessage = validateSchema ( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    const {
      apiTesting,
      tagId,
      userId
    } = req.body

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    const queryText = " DELETE FROM tags WHERE tag_id = '" + tagId + "'; DELETE FROM tag_connects WHERE tag_id = '" + tagId + "'; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when creating a new tag record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId: API_ACCESS_TOKEN
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true } )

  } catch (e) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner(  e.message ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: API_ACCESS_TOKEN
    } );
    const newException = nowRunning + ': failed with an exception: ' + e.message;
    console.log ( e );
    res.status( 500 ).send( newException );

  }

} );

router.post( "/hashtags/update", async ( req, res ) => {

  const nowRunning = "utilities/hashtags/update";
  console.log( nowRunning + ": running" );

  let success = false;
  const errorNumber = 10;
  
  try {

    const schema = Joi.object( { 
      apiTesting: Joi.boolean(),
      active: Joi.boolean().required(),
      notes: Joi.string().optional().allow( '', null ),
      masterKey: Joi.any(),
      tagId: Joi.string().required().uuid(),
      tagText: Joi.string().required().min( 3 ).max( 30 ),
      userId: Joi.string().required().uuid().uuid()
    } );

    const errorMessage = validateSchema ( nowRunning, recordError, req, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

    }

    const {
      active,
      apiTesting,
      notes,
      tagId,
      tagText,
      userId
    } = req.body

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 1 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    if ( !notes ) notes = ''; 

    const queryText = " UPDATE tags SET active = " + active + ", notes = '" + stringCleaner( notes, true ) + "', tag_text = '" + stringCleaner( tagText, true ) + "' WHERE tag_id = '" + tagId + "'; ";
    const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !results.rows ) {

      const failure = 'database error when updating the tag record';
      console.log( nowRunning + ": " + failure + "\n" );
      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId: API_ACCESS_TOKEN
      } );
      return res.status( 200 ).send( { failure, success } );
      
    }

    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { success: true } )

  } catch (e) {

    recordError ( {
      context: 'api: ' + nowRunning,
      details: stringCleaner(  e.message ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: API_ACCESS_TOKEN
    } );
    const newException = nowRunning + ': failed with an exception: ' + e.message;
    console.log ( e );
    res.status( 500 ).send( newException );

  }

} );

module.exports = router;
console.log( 'utilities routes loaded successfully!' );