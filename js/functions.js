const { replace } = require('lodash');
const moment = require('moment-timezone');
const request = require('request');
const {
  API_ACCESS_TOKEN,
  SENDGRID_API_KEY,
  SENDGRID_OFF,
  SENDGRID_SENDER
} = process.env
const db = require('./db');
const handleError = require('./handleError');
const now = moment().format('X');

// Deactive all currently disqualified campaigns.

const checkCampaigns = async (userId) => {

  const nowRunning = 'functions.js:checkCampaigns';
  console.log(`${nowRunning}: running`);
  const errorNumber = 61;

  try {

    const queryText = `
      UPDATE 
        campaigns 
      SET 
        active = false 
      WHERE 
        (list_id NOT IN (
          SELECT 
            l.list_id 
          FROM 
            lists l 
          WHERE 
            l.active = true
        ) 
        OR 
        ends < ${now}) -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
      RETURNING 
        campaign_id
      ;
    `;

    const results = await db.transactionRequired({ errorNumber, nowRunning, queryText, userId });

    if (!results) {
      
      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure: 'database error when deactivating disqualified campaigns', 
        nowRunning, 
        userId 
      });

    }

    const closedCampaigns = [];

    Object.values(results.rows).forEach(row => { closedCampaigns.push(row.campaign_id) });

    console.log(`${nowRunning}: finished`);
    return ({ 
      closedCampaigns, 
      success: true 
    });

  } catch (e) { 

    return await handleError({ error, errorNumber, nowRunning, userId });

  }

}

const containsHTML = string => { // c/o ChatGPT 3.5

  const htmlRegex = /<[^>]+>/g;
  return htmlRegex.test(string);

}

const dateToTimestamp = date => {

  date = replace(date, /GMT/, '');
  date = date.substring(0, 30); // remove everything after the timezone
  date = +moment(date, 'DDD MMM YYYY HH:mm:ss Z').format('X');
  return date;
  
}

const deleteCampaignMessage = async({ 
  apiTesting,
  campaignId, 
  messageId, 
  position, 
  userId 
}) => {

  const nowRunning = 'functions.js:deleteCampaignMessage';
  console.log(`${nowRunning}: running`);
  const errorNumber = 62;

  try {

    const { 
      recordEvent,
      stringCleaner
    } = require ('./functions')

    let queryText = `
      DELETE FROM 
        campaign_messages 
      WHERE 
        campaign_id = '${campaignId}' 
      AND 
        message_id = '${messageId}' `;
  
    // This is just in case we have N > 1 of the same message for some reason and want to remove a specific instance.

    if (+position) {
      
      queryText += ` 
      AND 
        position = ${position}`;

    }

    queryText += ` 
      RETURNING *
      ; 
      SELECT 
        message_name 
      FROM 
        messages 
      WHERE 
        message_id = '${messageId}'
      ;
      SELECT 
        * 
      FROM 
        campaign_messages 
      WHERE 
        campaign_id = '${campaignId}' 
      ORDER BY 
        position
      ;
    `;
    let results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when deleting a campaign message link'
      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure, 
        nowRunning, 
        userId 
      });

    }

    const eventDetails = `The message ${stringCleaner(results[1].rows[0].message_name, true)} was removed.`;
    await recordEvent({ 
      apiTesting, 
      event: 6, 
      eventDetails, 
      eventTarget: campaignId, 
      userId 
    });

    // If there are any remaining messages, they are now renumbered.

    if (results[2].rowCount > 0) {

      queryText = `
        DELETE FROM 
          campaign_messages 
        WHERE 
          campaign_id = '${campaignId}'
        ;
      `;

      Object.values(results[2].rows).forEach((row, key) => {

        const {
          campaign_id: campaignId,
          message_id: messageId,
          last_sent: lastSent
        } = row;
        const position = +key + 1;
        queryText += `
          INSERT INTO 
            campaign_messages(
              campaign_id, 
              message_id, 
              last_sent, 
              position
            )
          VALUES(
            '${campaignId}',
            '${messageId}',
            ${+lastSent},
            ${position}
          )
          ;
        `;

      });

      results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

      if (!results) {

        const failure = 'database error when repositioning remaining messages in the campaign';
        return await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        });
        
      }

    }

    return({ success: true });

  } catch (error) {
    
    return await handleError({ error, errorNumber, nowRunning, userId });

  }

}

const getDynamicMessageReplacements = async ({ 
  campaignId, 
  errorNumber, 
  userId 
}) => {

  try {

    const nowRunning = 'functions.js:getDynamicMessageReplacements';
    const { 
      containsHTML,
      stringCleaner
    } = require ('./functions');

    const queryText = `
      SELECT 
        DISTINCT ON (dv.target_name) dv.* 
      FROM 
        dynamic_values dv
      JOIN 
        campaign_messages cm ON dv.message_id = cm.message_id
      WHERE 
        cm.campaign_id = '${campaignId}'
      ORDER BY 
        dv.target_name, 
        dv.last_used
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure: 'database error when getting dynamic values records', 
        nowRunning, 
        userId 
      });
      
    }

    const dynamicValues = {};

    Object.values(results.rows).forEach(row => {

      const {
        dynamic_id: dynamicId,
        message_id: messageId,
        new_value: newValue,
        target_name: targetName
      } = row;

      // This object has to account for multiple sets of dynamic values based on each specific message ID. The use-case is a non-repeating campaign where some users may get one message, and others, another. In this, different sets of dynamic values are possible.

      if (!dynamicValues[messageId]) dynamicValues[messageId] = {};
      
      dynamicValues[messageId][dynamicId] = { 
        newValue: stringCleaner(newValue, false, !containsHTML(newValue)),
        targetName: stringCleaner(targetName)
      };

    });

    return ({ 
      dynamicValues, 
      success: true 
    });

  } catch (error) {
    
    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId 
    });
  
  }

}

const getUserLevel = (() => {

  const throttledUsers = {}; // Store throttled users and their last execution time

  return async (userId) => {

    const db = require('./db');
    const nowRunning = "functions/getUserLevel";
    const currentTime = Date.now();
    const errorNumber = 63;

    if (throttledUsers[userId] && currentTime - throttledUsers[userId].lastExecutionTime < 60000) {

      console.log(nowRunning + ": throttled for user " + userId);
      return { level: throttledUsers[userId].cachedLevel };
    }

    console.log(`${nowRunning}: started`);
  
    try {

      const queryText = `
        SELECT 
          level 
        FROM 
          users 
        WHERE 
          user_id = '${userId}' 
        AND 
          active = true
        ;
      `;
      const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

      if (!results) {

        return await handleError({ 
          details: queryText,
          errorNumber, 
          failure: 'database error when checking the user record', 
          nowRunning, 
          userId 
        });
      
      }

      const {
        rowCount,
        rows
       } = results;

      if (rowCount === 0) {

        console.log(`${nowRunning}: user ${userId} not found or inactive`);
        return { level: throttledUsers[userId] ? throttledUsers[userId].cachedLevel : 0 }

      }

      const level = rows[0].level;

      throttledUsers[userId] = {
        lastExecutionTime: currentTime,
        cachedLevel: level
      };

      console.log(`${nowRunning}: finished`);
      return { level }

    } catch (error) {
    
      return await handleError({ 
        error, 
        errorNumber, 
        nowRunning, 
        userId 
      });
    
    }

  }

})();

const getUsers = async () => {

  const nowRunning = "functions/getUsers";
  console.log(`${nowRunning}: started`);
  const errorNumber = 64;

  try {
  
    const { stringCleaner } = require("./functions")
    const queryText = `
      SELECT
        user_id,
        user_name
      FROM
        users
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure: 'database error when getting all users', 
        nowRunning, 
        userId 
      });
    
    }

    let userList = {};

    Object.values(rows).forEach(theRow => { userList[theRow.user_id] = stringCleaner(theRow.user_name); })

    console.log(nowRunning + ": finished"); 
    return ({ userList });

  } catch (error) {
    
    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId 
    });
  
  }

}

const isUrl = string => {

  var urlRegex = /^(https?|ftp):\/\/(-\.)?([^\s\/?\.#-]+\.?)+(\/[^\s]*)?$/i;
  return urlRegex.test(string);

}

const randomString = () => { // c/o ChatGPT3.5

  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';

  const randomUppercase = uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
  const randomLowercase = lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
  const randomNumber = numberChars[Math.floor(Math.random() * numberChars.length)];

  const randomChars = uppercaseChars + lowercaseChars + numberChars;
  let randomString = randomUppercase + randomLowercase + randomNumber;

  for (let i = 0; i < 5; i++) { // Insert an additional five random characters.

    const randomChar = randomChars[Math.floor(Math.random() * randomChars.length)];
    randomString += randomChar;

  }

  // Shuffle the string to make it more random.

  randomString = randomString.split('').sort(() => Math.random() - 0.5).join('');

  return randomString;

}

const recordError = async data => { // data should be { context, details, errorMessage, errorNumber, userId }

  const nowRunning = 'functions/recordError';
  console.log (`${nowRunning}: started`);

  try {

    const {
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

    console.log (`${nowRunning}: finished`);

  } catch(e) {

    console.log (`${nowRunning}: failed with an exception: `, e)

  }

}

const recordEvent = async({ 
  apiTesting, 
  event, 
  eventDetails, 
  eventTarget, 
  userId 
}) => {

  const errorNumber = 44;
  const nowRunning = 'functions.js:recordEvent';
  const { stringCleaner } = require ('./functions');

  try { 

    const queryText = `
      INSERT INTO 
        events (
          event_details, 
          event_target, 
          event_time, 
          event_type, 
          user_id
        ) 
      VALUES (
        '${stringCleaner(eventDetails, true)}', 
        '${eventTarget}', 
        ${now}, 
        ${event}, 
        '${userId}'
      )
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure: 'database error when recording an event', 
        nowRunning, 
        userId 
      });
    
    }

  } catch (error) {
    
    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId 
    });
  
  }

}

const sendMail = async (addressee, html, subject, testMode) => { 

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(SENDGRID_API_KEY);
  let emailResults = null;

  try {

    if (SENDGRID_OFF && !testMode) {
      
      emailResults = [{ statusCode: 200, status: 'Email is disabled by SENDGRID_OFF' }]
      return emailResults;

   }

    testMode ? addressee = 'simplexable@gmail.com' : null;

    const text = 'Please read this email in a HTML-capable browser.';
    const sender = SENDGRID_SENDER;
    console.log(`Sending ${subject} to ${addressee} @ ${moment().format('YYYY.MM.DD HH.mm.ss')}`);
    emailResults = await sgMail.send({ to: addressee, html, from: sender, subject, text });

    // The next line is useful if we want to comment out the Sendgrid API above for test purposes.

    // emailResults = [{ statusCode: 200, status: 'Sendmail bypassed' }];

  } catch(e) {

    console.log('Sendgrid errors', e.response.body.errors);
    console.log('e', e);
    emailResults = [{ statusCode: 200, status: 'Sendmail threw a local exception: ' + e.message }];

  }

  return emailResults;
  
}

const stringCleaner = (string, toDb, nl2br) => {

  if (!toDb) string = replace(replace(string, /""/g, '"'), /''/g, "'").trim();

  if (toDb) string = replace(replace(string, /"/g, '""'), /'/g, "''").trim();

  if (nl2br) string = replace(string, /\n/g, '<br />');

  return string;

}

const updateDynamicText = async ({ 
  dynamicValues, 
  messageContent 
}) => {

  try {

    // Exit now if this was called for no reason.
    
    if (!dynamicValues || Object.keys(dynamicValues).length < 1) return ({messageContent });

    const { stringCleaner } = require ('./functions');

    Object.values(dynamicValues).forEach(row => { 
          
      const newValue = stringCleaner(row.newValue);
      const targetName = stringCleaner(row.targetName);

      // The target string is programmatic c/o ChatGPT 3.5.

      const placeholderRegex = new RegExp(`\\[${targetName}\\]`, 'g');
      messageContent = replace(messageContent, placeholderRegex, newValue);

    });

    return ({ messageContent });  

  } catch (error) {
    
    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId 
    });
  
  }

}

const validateSchema = async ({ 
  errorNumber, 
  nowRunning, 
  req,
  schema 
}) => {

  try {

    var { error } = schema.validate (req.body);

    if (error) {

      const errorMessage = `validation error: ${error.details[0].message}`
      await handleError({ 
        details: errorMessage,
        errorNumber, 
        failure: 'error when validating inputs', 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN 
      });
      return errorMessage
      
    }

  } catch (error) {

    return await handleError({ 
      details: null,
      errorNumber, 
      failure: 'error when validating inputs', 
      nowRunning, 
      userId: req.body.userId || API_ACCESS_TOKEN
    });
  
  }

}

const validateUUID = (string) => {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi

  return regexExp.test(string)

}

module.exports = {
  checkCampaigns,
  containsHTML,
  dateToTimestamp,
  deleteCampaignMessage,
  getDynamicMessageReplacements,
  getUserLevel,
  getUsers,
  isUrl,
  randomString,
  recordError,
  recordEvent,
  sendMail,
  stringCleaner,
  updateDynamicText,
  validateSchema,
  validateUUID
}