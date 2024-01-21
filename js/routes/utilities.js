console.log( "loading utilities routes now..." );
const bcrypt = require( 'bcrypt' );
const db = require( '../db' );
const express = require( 'express' );
const Joi = require( 'joi' );
const jwt = require ( 'jsonwebtoken' );
const moment = require( 'moment' );
const router = express.Router();
const { v4: uuidv4 } = require( 'uuid' );
router.use( express.json() );

const { 
  API_ACCESS_TOKEN,
  JWT_KEY
} = process.env;
const { 
  containsHTML,
  getLinkedGlobals,
  getUserLevel,
  recordError,
  recordEvent,
  stringCleaner,
  validateSchema,
  validateUUID
} = require( '../functions.js' );

router.post( "/users/login-standard", async ( req, res ) => { 

  const nowRunning = "utilities/users/login-standard";
  console.log( nowRunning + ": running" );
  let success = false;
  const errorNumber = 2;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      email: Joi.string().required().email(),
      masterKey: Joi.string().required().uuid(),
      passPhrase: Joi.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
        .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
      userId: Joi.any() // ignored
    } );

    const errorMessage = validateSchema ( nowRunning, req, res, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

   }

    const { 
      email,
      masterKey,
      passPhrase
    } = req.body; 

    const queryText = " SELECT * FROM users WHERE active = true AND email ILIKE '" + email + "' ";
    const { rowCount, rows } = await db.noTransaction( queryText, errorNumber, nowRunning, masterKey );

    if ( !rows ) {

      console.log( nowRunning + ": failed\n" );
      return res.status( 200 ).send( { failure: 'database error when getting the user via a login key', success } );
  
    } else if ( rowCount < 1 ) {

      recordError ( {
        context: 'api: ' + nowRunning,
        details: queryText,
        errorMessage: 'invalid email for user login: ' + email,
        errorNumber,
        userId: API_ACCESS_TOKEN
      } );
      console.log ( nowRunning + ": invalid email" );
      return res.status( 200 ).send( { failure: 'invalid email', success } );

    }

    const userRecord = rows[0];
    const passwordCheck = await bcrypt.compare( email + passPhrase, userRecord.login_hash );
    
    if ( !passwordCheck ) { // this is not logged as an error

      console.log ( nowRunning + ': password check failed' );
      return res.status( 400 ).send( { failure: 'password check failed' });

    }

    token = jwt.sign ( { userRecord }, JWT_KEY, { expiresIn: "1h" } );
    
    console.log( nowRunning + ": finished\n" );
    return res.status( 200 ).send( { token, success: true } );

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

router.post( "/users/new", async ( req, res ) => { 

  const nowRunning = "utilities/users/new";
  console.log( nowRunning + ": running" );
  let success = false;
  const errorNumber = 1;

  try {

    if ( req.body.masterKey != API_ACCESS_TOKEN ) {

      console.log( nowRunning + ": bad token\n" );
      return res.status( 403 ).send( 'unauthorized' );

    }

    const schema = Joi.object( {
      apiTesting: Joi.boolean().optional().default( false ),
      email: Joi.string().required().email(),
      level: Joi.number().optional().min( 1 ).max( 9 ).default( 1 ),
      masterKey: Joi.string().required().uuid(),
      passPhrase: Joi.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
        .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
      userId: Joi.string().required().uuid(),
      userName: Joi.string().required()
    } );

    const errorMessage = validateSchema ( nowRunning, req, res, schema );
  
    if ( errorMessage ) {

      console.log( nowRunning + ' exited due to a validation error: ' + errorMessage );
      return res.status( 422 ).send( { failure: errorMessage, success } );

   }

    const { 
      apiTesting,
      email,
      level,
      passPhrase,
      userId,
      userName 
    } = req.body;

    // comment out level check if creating the first user and do not supply userId in the JSON

    const { level: userLevel } = await getUserLevel( userId );

    if ( userLevel < 7 ) {

      console.log( nowRunning + ": aborted, invalid user ID\n" );
      return res.status( 404 ).send( { failure: 'invalid user ID', success } );

    } 

    // don't allow current user to add a new one at a higher level
    
    if ( level > userLevel ) level = userLevel;

    // create the user

    const loginHash = await bcrypt.hash( email + passPhrase, 10 );
    const newId = uuidv4();
    const token = uuidv4();
    const queryText = " INSERT INTO users ( active, email, level, login_hash, token, user_id, user_name ) VALUES ( true, '" + email + "', " + level + ", '" + loginHash + "', '" + newId + "', '" + token + "', '" + stringCleaner( userName, true ) + "' ) RETURNING * ";
    const { rowCount } = await db.transactionRequired( queryText, errorNumber, nowRunning, userId, apiTesting );

    if ( !rowCount ) {

      const failure = 'database error when registering a new user';
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
    return res.status( 200 ).send( { newId, success: true, token } );

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
console.log( 'utilities routes loaded successfully!' );