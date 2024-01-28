const _ = require( 'lodash' );
const fs = require ( 'fs' );
const moment = require( 'moment-timezone' );
const request = require( 'request' );
const {
  API_ACCESS_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_OFF,
  SENDGRID_SENDER
} = process.env;

// deactive all currently disqualified campaigns

exports.checkCampaigns = async ( errorNumber, userId ) => {

  const db = require( './db' );
  const now = moment().format( 'X' );
  const nowRunning = 'functions.js:checkCampaigns';
  const queryText = " UPDATE campaigns SET active = false WHERE ( list_id NOT IN ( SELECT list_id FROM lists WHERE active = true ) OR ends < " + now + " ) RETURNING campaign_id; ";
  const results = await db.transactionRequired( queryText, errorNumber, nowRunning, userId );

  if ( !results.rows ) {
    
    recordError ( {
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    } );
    return { failure: 'campaign testing failed due to a database error', success: false };

  }

  const closedCampaigns = [];

  Object.values( results.rows ).map( row => { closedCampaigns.push( row.campaign_id ) });

  return { closedCampaigns, success: true }

}

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

exports.getDynamicMessageReplacements = async ( { errorNumber, messageId, userId } ) => {

  const db = require( './db' );
  const nowRunning = 'functions.js:getDynamicMessageReplacements';
  const success = false;
  const { 
    containsHTML,
    recordError,
    stringCleaner
  } = require ( './functions' );

  const queryText = " SELECT DISTINCT ON ( target_name ) * FROM dynamic_values WHERE message_id = '" + messageId + "' ORDER BY target_name, last_used ";
  const results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

  if ( !results?.rows ) {

    const failure = 'database error when getting dynamic values records';
    console.log( nowRunning + ": " + failure + "\n" );
    recordError ( {
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    } );
    return ( { failure, success } );
    
  }

  const dynamicValues = {};

  Object.values( results.rows ).map( row => {

    const {
      dynamic_id: dynamicId,
      new_value: newValue,
      target_name: targetName
    } = row;
    dynamicValues[dynamicId] = { 
      newValue: stringCleaner( newValue, false, !containsHTML( newValue ) ),
      targetName: stringCleaner( targetName )
    }

  })

  return ( { dynamicValues, success: true } );

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

exports.processCampaigns = async ({ campaignId, errorNumber, listId, messageContent, messageId, messageName, messageSubject, userId }) => {

  const db = require( './db' );
  const now = moment().format( 'X' );
  const nowRunning = 'functions.js:processCampaigns';
  const success = false;
  const { 
    getDynamicMessageReplacements,
    recordError,
    sendMail,
    stringCleaner
  } = require ( './functions' );

  // get dynamic replacements (to be applied to messageContent)

  const {
    dynamicValues,
    failure: getDynamicValuesFailure,
    success: getDynamicValuesSuccess
  } = await getDynamicMessageReplacements( { errorNumber, messageId, userId } );

  if ( !getDynamicValuesSuccess ) {

    console.log( nowRunning + ": exited due to error on function getDynamicMessageReplacements\n" );
    return res.status( 200 ).send( { failure: getDynamicValuesFailure, success } );

  }

  console.log( 'dynamicValues', dynamicValues)

  // dynamic values are inserted into the message.

  Object.values( dynamicValues ).map( row => { 
    
     const newValue = stringCleaner( row.newValue );
     const targetName = stringCleaner( row.targetName );

     // the target string is programmatic c/o ChatGPT 3.5

     const placeholderRegex = new RegExp(`\\[${targetName}\\]`, 'g'); // 
     messageContent = _.replace(messageContent, placeholderRegex, newValue);

  });

  // get the email recipients

  let queryText = " SELECT c.company_name, c.contact_id, c.contact_name, c.email FROM contacts c, list_contacts lc WHERE lc.list_id = '" + listId + "' AND lc.contact_id = c.contact_id AND c.active = true AND c.block_all = false AND c.contact_id NOT IN ( SELECT contact_id FROM unsubs WHERE list_id = '" + listId + "' ); ";
  let results = await db.noTransaction( queryText, errorNumber, nowRunning, userId );

  if ( !results.rows ) { 

    const failure = 'database error when getting eligible recipients fot the campaign email';
    console.log( nowRunning + ": " + failure + "\n" );
    await recordError ( {
      context: 'api: ' + nowRunning,
      details: queryText,
      errorMessage: failure,
      errorNumber,
      userId
    } );

    return ({ campaignsProcessedFailure: failure, campaignsProcessedSuccess: false });

  }

  Object.values( results.rows ).map( async row => {

    let {
      company_name: companyName,
      contact_id: contactId,
      contact_name: contactName,
      email
    } = row;

    if ( companyName ) contactName += ", " + companyName;

    contactName = stringCleaner( contactName );
    messageContent = _.replace(messageContent, /\[CONTACT_NAME\]/g, contactName);

    const result = await sendMail ( email, messageContent, messageSubject );
    console.log( 'email result', result )

    
  });

  return ({ campaignsProcessedFailure: false, campaignsProcessedSuccess: true });

}

exports.randomString = () => { // c/o ChatGPT3.5

  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';

  const randomUppercase = uppercaseChars[Math.floor( Math.random() * uppercaseChars.length )];
  const randomLowercase = lowercaseChars[Math.floor( Math.random() * lowercaseChars.length )];
  const randomNumber = numberChars[Math.floor( Math.random() * numberChars.length )];

  const randomChars = uppercaseChars + lowercaseChars + numberChars;
  let randomString = randomUppercase + randomLowercase + randomNumber;

  for ( let i = 0; i < 5; i++ ) { // inser an additional five random characters

    const randomChar = randomChars[Math.floor( Math.random() * randomChars.length )];
    randomString += randomChar;

  }

  // shuffle the string to make it more random

  randomString = randomString.split('').sort( () => Math.random() - 0.5 ).join( '' );

  return randomString;

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

  const sgMail = require( '@sendgrid/mail' );
  sgMail.setApiKey(  SENDGRID_API_KEY );
  let emailResults = null;

  try {

    if ( SENDGRID_OFF && !testMode ) {
      
      emailResults = [ { statusCode: 200, status: 'Email is disabled by SENDGRID_OFF' } ];
      return emailResults;

   }

    testMode ? addressee = 'simplexable@gmail.com' : null;

    const text = 'Please read this email in a HTML-capable browser.';
    const sender = SENDGRID_SENDER;

    emailResults = await sgMail.send( { to: addressee, html, from: sender, subject, text } );

 } catch( e ) {

    console.log( 'e', e.response.body );
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

exports.validateSchema = ( nowRunning, recordError, req, schema ) => {

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