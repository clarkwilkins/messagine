const _ = require( 'lodash' );
const fs = require ( 'fs' );
const moment = require( 'moment-timezone' );
const request = require( 'request' );
const sgMail = require( '@sendgrid/mail' );
const {
  API_ACCESS_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_OFF
} = process.env;

exports.containsHTML = string => { // c/o ChatGPT 3.5

  const htmlRegex = /<[^>]+>/g;
  return htmlRegex.test(string);

}

exports.dateToTimestamp = date => {

  date = _.replace( date, /GMT/, '' );
  date = date.substring( 0, 30 ); // remove everything after the timezone
  date = +moment( date, 'DDD MMM YYYY HH:mm:ss Z' ).format( 'X' );
  return date;
  
}

// getUserLevel was rewritten by ChatGPT 3.5 to throttle it and add better error handling.

exports.getUserLevel = (() => {

  const throttledUsers = {}; // Store throttled users and their last execution time

  return async (userId) => {

    const nowRunning = "functions/getUserLevel";
    const currentTime = Date.now();

    if ( throttledUsers[userId] && currentTime - throttledUsers[userId].lastExecutionTime < 60000 ) {

      console.log( nowRunning + ": throttled for user " + userId );
      return { level: throttledUsers[userId].cachedLevel };
    }

    console.log( nowRunning + ": started");

    const db = require('./db');

    try {

      const query = {
        text: "SELECT level FROM users WHERE user_id = $1 AND active = true",
        values: [userId]
      };

      const { rows } = await db.noTransaction( query );

      if (rows.length === 0) {

        console.log(nowRunning + ": user " + userId + " not found or inactive");
        return { level: throttledUsers[userId] ? throttledUsers[userId].cachedLevel : 0 };

      }

      const level = rows[0].level;

      throttledUsers[userId] = {
        lastExecutionTime: currentTime,
        cachedLevel: level
      };

      console.log( nowRunning + ": finished" );
      return { level };

    } catch (error) {

      console.error( nowRunning + ": error", error );
      return { level: throttledUsers[userId] ? throttledUsers[userId].cachedLevel : 0 };

    }

  };

} )();

exports.getUsers = async () => {

  const nowRunning = "functions/getUsers";
  console.log( nowRunning + ": started" );
  
  const db = require( './db' );
  const { stringCleaner } = require( "./functions" );

  let { rows } = await db.noTransaction( " SELECT user_id, user_name FROM users " );
  let userList = {};

  Object.values( rows ).map( theRow => { userList[theRow.user_id] = stringCleaner( theRow.user_name ); } );

  console.log( nowRunning + ": finished" );  
  return ( { userList } );

}

exports.recordError = async data => { // data should be { context, details, errorMessage, errorNumber, userId }

  const nowRunning = 'functions/recordError';
  console.log ( nowRunning + ': started' );

  try {

    const {
      SANDBOX: sandbox,
      SIMPLEXABLE_API: host,
      SIMPLEXABLE_API_TOKEN: masterKey,
      SIMPLEXABLE_PLATFORM: platform
    } = process.env;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // avoids having node crash when we make the request

    request.post(
      {
        url: host + '/errors/record',
        json: {
          ...data,
          masterKey,
          platform,
       },
        headers: {
          'Content-Type': 'application/json',
       },
     }

    );

    console.log ( nowRunning + ': finished' );
    return( { success: true } );    

 } catch( e ) {

    console.log ( nowRunning + ': failed with an exception: ', e );
    return ( { success: false } );

 }

}

exports.sendMail = async ( addressee, html, subject, testMode ) => { 

  let emailResults = null;

  try {

    if ( SENDGRID_OFF && !testMode ) {
      
      emailResults = [ { statusCode: 200, status: 'Email is disabled by SENDGRID_OFF' } ];
      return emailResults;

   }

    testMode ? addressee = 'simplexable@gmail.com' : null;

    const text = 'Please read this email in a HTML-capable browser.';
    const sender = 'noreply@healthica.com';

    emailResults = await sgMail.send( { to: addressee, html, from: sender, subject, text } );

 } catch( e ) {

    console.log( e );
    emailResults = [ { statusCode: 200, status: 'Sendmail threw a local exception' } ];

 }

  return emailResults;
  
}

exports.stringCleaner = ( string, toDb, nl2br ) => {

  if ( !toDb ) string = _.replace( _.replace( string, /""/g, '"' ), /''/g, "'" ).trim();

  if ( toDb ) string = _.replace( _.replace( string, /"/g, '""' ), /'/g, "''" ).trim();

  if ( nl2br ) string = _.replace( string, /\n/g, '<br />' );

  return string;

}

exports.validateSchema = ( nowRunning, recordError, req, schema) => {

  try {

    var { error } = schema.validate (req.body);

    if (error) {

      const errorMessage = 'validation error: ' + error.details[0].message
      recordError ( {
        context: 'api: ' + nowRunning,
        details: null,
        errorMessage,
        errorNumber: -1,
        userId: req.body.userId
     } );
      return errorMessage;
    
   }
    

 } catch (e) { console.log ( nowRunning + ': failed with an exception: ', e ); }  
  
}

exports.validateUUID = ( string ) => {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

  return regexExp.test( string );

}