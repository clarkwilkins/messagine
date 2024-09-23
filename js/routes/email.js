console.log( "loading email services now..." );
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

const { 
  API_ACCESS_TOKEN,
  JWT_KEY
} = process.env;
const { 
  getUserLevel,
  randomString,
  recordError,
  sendMail,
  stringCleaner,
  validateSchema
} = require( '../functions.js' );

router.post( "/signatures/all", async ( req, res ) => { 

  const nowRunning = "/email/signatures/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 16;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

   }

    let { 
      active,
      userId 
    } = req.body;

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

    let queryText = " SELECT * FROM email_signatures ";

    if ( active && typeof active === 'boolean' ) queryText += "WHERE active = " + active;

    queryText += " ORDER BY active DESC, signature_name; ";

    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when removing a signature record';
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
    
    const signatures = {};
    const signaturesSelector = [];

    Object.values( results.rows ).map( row => {

      let {
        active,
        owner,
        private,
        signature_id: signatureId,
        signature_name: signatureName,
        signature_text: signatureText
      } = row;

      if ( !active ) signatureName += '*';

      signatureName = stringCleaner( signatureName );

      signatures[signatureId] = {
        active,
        owner,
        private,
        signatureName,
        signatureText: stringCleaner( signatureText )
      }
      signaturesSelector.push({
        label: signatureName,
        value: signatureId
      });

    })
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { signatures, signaturesSelector, success: true } );

 } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
   } );
    const newException = `${nowRunning }: failed with an exception: ${e}`;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/signatures/delete", async ( req, res ) => { 

  const nowRunning = "/email/signatures/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 14;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      masterKey: Joi.any(),
      signatureId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

   }

    let { 
      apiTesting,
      signatureId,
      userId 
    } = req.body;

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

    const queryText = " DELETE FROM email_signatures WHERE signature_id = '" + signatureId + "' AND ( owner = '" + userId + "' OR owner IN ( SELECT user_id FROM users WHERE active = false OR level < " + userLevel + " ) ) RETURNING *; ";
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when removing a signature record';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( !results.rowCount ) { // this is not a messagine error

      const failure = 'update denied due to bad signature ID or ownership level conflict';
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
    const newException = `${nowRunning }: failed with an exception: ${e}`;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/signatures/load", async ( req, res ) => { 

  const nowRunning = "/email/signatures/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 17;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      masterKey: Joi.any(),
      signatureId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

   }

    let { 
      signatureId,
      userId 
    } = req.body;

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

    const queryText = " SELECT e.*, u.user_name FROM email_signatures e, users u WHERE e.signature_id = '" + signatureId + "' AND e.owner = u.user_id; ";
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });;

    if (!results) {

      const failure = 'database error when getting a signature record';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( !results.rowCount ) { // this is not an API failure

      const failure = 'signature record not found';
      console.log(`${nowRunning}: ${failure}\n`)
      return res.status(200).send({ failure, success })

    }
    
    const {
      active,
      owner,
      private: privateSignature,
      signature_name: signatureName,
      signature_text: signatureText,
      user_name: signatureOwner
    } = results.rows[0];    
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { 
      active,
      owner,
      privateSignature,
      signatureName: stringCleaner( signatureName ),
      signatureOwner: stringCleaner( signatureOwner ),
      signatureText: stringCleaner( signatureText ),
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
    const newException = `${nowRunning }: failed with an exception: ${e}`;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/signatures/new", async ( req, res ) => { 

  const nowRunning = "/email/signatures/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 13;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      masterKey: Joi.any(),
      private: Joi.boolean().optional(),
      signatureName: Joi.string().required(),
      signatureText: Joi.string().required(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

   }

    let { 
      apiTesting,
      private,
      signatureName,
      signatureText,
      userId 
    } = req.body;

    if ( !private ) private = true;

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

    const signatureId = uuidv4();
    const queryText = " INSERT INTO email_signatures( owner, private, signature_id, signature_name, signature_text ) VALUES( '" + userId + "', " + private + ", '" + signatureId + "', '" + stringCleaner( signatureName, true ) + "', '" + stringCleaner( signatureText, true ) + "' ); ";
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new signature record';
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
    return res.status( 200 ).send( { signatureId, success: true } );

 } catch ( e ) {

    recordError ( {
      context: `api: ${nowRunning}`,
      details: stringCleaner( JSON.stringify( e.message ), true ),
      errorMessage: 'exception thrown',
      errorNumber,
      userId: req.body.userId
   } );
    const newException = `${nowRunning }: failed with an exception: ${e}`;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

router.post( "/signatures/update", async ( req, res ) => { 

  const nowRunning = "/email/signatures/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 15;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional(),
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      private: Joi.boolean().optional(),
      signatureName: Joi.string().required(),
      signatureText: Joi.string().required(),
      userId: Joi.string().required().uuid()
    } );

    const errorMessage = validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status( 422 ).send({ failure: errorMessage, success });

   }

    let { 
      active,
      apiTesting,
      private,
      signatureName,
      signatureText,
      userId 
    } = req.body;

    if ( !private ) private = true;

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

    let queryText = " UPDATE email_signatures SET signature_name = '" + stringCleaner( signatureName, true ) + "', signature_text = '" + stringCleaner( signatureText, true ) + "' ";

    if ( active && typeof active === 'boolean' ) queryText += ",  active = " + active;

    if ( private && typeof private === 'boolean' ) queryText += ", private = " + private;

    queryText += " WHERE ( owner = '" + userId + "' OR owner IN ( SELECT user_id FROM users WHERE active = false OR level < " + userLevel + " ) ) RETURNING *; ";

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new signature record';
      console.log(`${nowRunning}: ${failure}\n`)
      recordError ( {
        context: `api: ${nowRunning}`,
        details: queryText,
        errorMessage: failure,
        errorNumber,
        userId
      } );
      return res.status(200).send({ failure, success })
      
    } else if ( !results.rowCount ) { // this is not a messagine error

      const failure = 'update denied due to bad signature ID or ownership level conflict';
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
    const newException = `${nowRunning }: failed with an exception: ${e}`;
    console.log ( e ); 
    res.status( 500 ).send( newException );

 }

} );

module.exports = router;
console.log( 'email services loaded successfully!' );