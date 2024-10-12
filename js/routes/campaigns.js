console.log("loading campaign services now...");
const db = require('../db');
const handleError = require('../handleError');
const express = require('express');
const Joi = require('joi');
const moment = require('moment');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json());

const { API_ACCESS_TOKEN } = process.env;
const { 
  checkCampaigns,
  containsHTML,
  deleteCampaignMessage,
  getUserLevel,
  getUsers,
  recordEvent,
  stringCleaner,
  validateSchema
} = require('../functions.js');
const success = false;

router.post("/all", async (req, res) => { 

  const nowRunning = "/campaigns/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 31;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional().allow('', null),
      masterKey: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

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

    // Check/adjust campaign list.

    const { failure: checkCampaignsFailure } = await checkCampaigns(userId);

    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }

    let queryText = `
      SELECT 
        c.*, 
        u.user_name 
      FROM 
        campaigns c
      JOIN 
        users u 
      ON 
        c.updated_by = u.user_id `;

    if (typeof active === 'boolean') queryText += ` 
      AND 
        c.active = ${active}`

    queryText += `
      ORDER BY 
        c.active DESC, 
        c.campaign_name
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the campaigns';
      console.log(`${nowRunning}: ${failure}`);
      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure, 
        nowRunning, 
        userId 
      });
      
    } 

    const campaigns = {};

    Object.values(results.rows).forEach(row => { 
      
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
        campaignName: `${stringCleaner(campaignName)}${active === true ? '' : '*'}`, 
        campaignNotes: stringCleaner(campaignNotes, false, !containsHTML(campaignNotes)),
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
        updatedBy2: stringCleaner(updatedBy2)
      };

    })
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      campaigns, 
      success: true
    });

  } catch (error) {

    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId: req.body.userId || API_ACCESS_TOKEN 
    });

  }

});

router.post("/delete", async (req, res) => { 

  const nowRunning = "/campaigns/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 30;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().optional().uuid(),
      masterKey: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      campaignId,
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

    // delete the campaign

    const queryText = `
      DELETE FROM 
        campaigns 
      WHERE 
        campaign_id = '${campaignId}' 
      AND 
        locked <= ${userLevel}
      RETURNING 
        campaign_id
      ;
    `;    
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when deleting the campaign';
      console.log(`${nowRunning}: ${failure}`);
      return await handleError({ 
        details: queryText,
        errorNumber, 
        failure, 
        nowRunning, 
        userId 
      });
      
    }

    // Check/adjust campaign list.

    const { 
      failure: checkCampaignsFailure,
      closedCampaigns 
    } = await checkCampaigns(userId);

    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }
    
    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ 
      campaignId, 
      closedCampaigns, 
      success: true 
    });

  } catch (error) {

    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId: req.body.userId || API_ACCESS_TOKEN 
    });

 }

});

router.post("/load", async (req, res) => { 

  const nowRunning = "/campaigns/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 32;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      campaignId,
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

    // Check/adjust campaign list.

    const { failure: checkCampaignsFailure } = await checkCampaigns(userId);

    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }

    let queryText = `
      SELECT 
        c.*, 
        u.user_name  
      FROM 
        campaigns c
      JOIN 
        users u 
      ON 
        c.updated_by = u.user_id
      WHERE 
        c.campaign_id = '${campaignId}'
      ;
    `;
    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the campaign';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    } else if (!results.rows[0]?.campaign_id) {

      const failure = 'campaignId ' + campaignId + ' was not found';
      return res.status(200).send({ 
        failure, 
        success 
      });
      
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
      unsub_url: unsubUrl,
      updated,
      updatedBy,
      user_name: updatedBy2
    } = results.rows[0];

    // now get linked messages including campaign specific settings

    queryText = `
      SELECT 
        cm.last_sent, 
        cm.position, 
        m.* 
      FROM 
        campaign_messages cm
      JOIN 
        messages m 
      ON 
        cm.message_id = m.message_id
      WHERE 
        cm.campaign_id = '${campaignId}'
      ORDER BY 
        cm.last_sent
      ;
    `;
    results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the campaign message details'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    const messages = {};

    Object.values(results.rows).forEach(row => {

      const {
        active,
        created,
        content,
        last_sent: lastSent,
        locked,
        message_id: messageId,
        message_name: messageName,
        notes,
        owner,
        position,
        repeatable,
        subject,
        updated,
        updated_by: updatedBy
      } = row;
      messages[messageId] = {
        active,
        created: +created,
        content,
        lastSent: +lastSent,
        locked,
        messageName: stringCleaner(messageName),
        notes: stringCleaner(notes),
        owner,
        position,
        repeatable,
        subject: stringCleaner(subject),
        updated,
        updated_by: updatedBy
      };

    })

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      active,
      campaignName: stringCleaner(campaignName),
      campaignNotes: stringCleaner(campaignNotes, false, !containsHTML(campaignNotes)),
      campaignRepeats,
      created: +created,
      ends: +ends,
      interval: +interval,
      listId,
      locked: +locked,
      messages,
      messageSeries,
      nextMessage,
      nextRun: +nextRun,
      starts: +starts,
      success: true,
      unsubUrl,
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner(updatedBy2)
    });

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN 
      })
    );
  
  }

});

router.post("/dynamic/all", async (req, res) => { 

  const nowRunning = "/campaigns/dynamic/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 43;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });;
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      messageId,
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

    const { 
      failure: getUsersFailure,
      userList 
    } = await getUsers(userId);

    if (getUserLevelFailure) {

      console.log(`${nowRunning }: aborted`);
      return res.status(404).send({ 
        failure: getUsersFailure, 
        success 
      });

    }

    const queryText = `
      SELECT 
        *
      FROM
        dynamic_values
      WHERE 
        message_id = '${messageId}'
      ORDER BY 
        target_name,
        last_used,
        updated DESC
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting all messages'
      console.log(`${nowRunning} : ${failure}`)
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId
        })
      );
      
    } 

    const dynamicValues = {};
    

    Object.values(results.rows).forEach(row => {

      const {
        dynamic_id: dynamicId,
        last_used: lastUsed,
        locked,
        message_id: messageId,
        new_value: newValue,
        target_name: targetName,
        updated,
        updated_by: updatedBy
      } = row;

      if (!dynamicValues[targetName]) { dynamicValues[targetName] = {}; }

      dynamicValues[targetName][dynamicId] = {
        lastUsed: moment.unix(lastUsed),
        locked: +locked,
        messageId,
        newValue: stringCleaner(newValue),
        targetName,
        updated: moment.unix(updated),
        updatedBy: userList[updatedBy]
      };

    });

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      dynamicValues, 
      success: true
    });

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/dynamic/delete", async (req, res) => { 

  const nowRunning = "/campaigns/dynamic/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 72;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      dynamicId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      dynamicId,
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

    // create the dynamic values record

    const queryText = `
      DELETE FROM
        dynamic_values
      WHERE
        dynamic_id = '${dynamicId}'
      AND 
        locked <= ${userLevel}
      ;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results?.rowCount) {

      const failure = 'database error when deleting the dynamic values record'
      console.log(`${nowRunning} : ${failure}`)
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ success: true })

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/dynamic/new", async (req, res) => { 

  const nowRunning = "/campaigns/dynamic/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 42;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
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
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      locked,
      messageId,
      newValue,
      target,
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

    // create the dynamic values record

    const now = moment().format('X');
    const queryText = `
      INSERT INTO dynamic_values (
        created, 
        created_by, 
        dynamic_id, 
        last_used, 
        ${locked !== undefined ? 'locked,' : ''} 
        message_id, 
        new_value, 
        target_name, 
        updated, 
        updated_by
      ) 
      VALUES (
        ${now}, 
        '${userId}', 
        '${uuidv4()}', 
        0, 
        ${locked ? userLevel : 0}, 
        '${messageId}', 
        '${stringCleaner(newValue, true)}', 
        '${stringCleaner(target, true)}', 
        ${now}, 
        '${userId}'
      ) 
      RETURNING created;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results?.rowCount) {

      const failure = 'database error when creating the dynamic values record'
      console.log(`${nowRunning} : ${failure}`)
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ success: true })

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/dynamic/update", async (req, res) => { 

  const nowRunning = "/campaigns/dynamic/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 71;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      dynamicId: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      newValue: Joi.alternatives().required().try(
        Joi.number(),
        Joi.string()
      ),
      target: Joi.string().required(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      dynamicId,
      newValue,
      target,
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

    // create the dynamic values record

    const now = moment().format('X');
    const queryText = `
      UPDATE
        dynamic_values
      SET
        new_value = '${stringCleaner(newValue, true)}',
        target_name = '${stringCleaner(target, true)}',
        updated = ${now},
        updated_by = '${userId}'
      WHERE
        dynamic_id = '${dynamicId}'
      AND 
        locked <= ${userLevel}
      ;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results?.rowCount) {

      const failure = 'database error when creating the dynamic values record'
      console.log(`${nowRunning} : ${failure}`)
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ success: true })

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/messages/add", async (req, res) => { 

  const nowRunning = "/campaigns/messages/add";
  console.log(`${nowRunning}: running`);

  const errorNumber = 39;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.string().required().uuid(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
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

     // Check/adjust campaign list.

    const { failure: checkCampaignsFailure } = await checkCampaigns(userId);

    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }

    // check for the next position

    let queryText = `
      SELECT 
        MAX(position) 
      FROM 
        campaign_messages 
      WHERE 
        campaign_id = '${campaignId}'
      ;
    `;
    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when checking current message position'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    const nextPosition = +results.rows[0]?.max + 1 || 1;

    queryText = `
      INSERT INTO 
        campaign_messages (
          campaign_id, 
          last_sent, 
          message_id, 
          position
        ) 
      VALUES (
        '${campaignId}', 
        0, 
        '${messageId}', 
        ${nextPosition}
      ) 
      RETURNING 
        position
      ;
    `;
    results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when adding a message to the campaign'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      nextPosition, 
      success: true 
    });

  } catch (error) {

    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/messages/remove", async (req, res) => { 

  const nowRunning = "/campaigns/messages/remove";
  console.log(`${nowRunning}: running`);

  const errorNumber = 40;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      masterKey: Joi.string().required().uuid(),
      messageId: Joi.string().required().uuid(),
      position: Joi.number().optional().integer().positive(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiTesting,
      campaignId,
      messageId,
      position,
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

    const { deleteCampaignMessageFailure } = await deleteCampaignMessage({ 
      apiTesting,
      campaignId,
      messageId, 
      position, 
      userId 
    });

    if (deleteCampaignMessageFailure) {
      
      console.log(`${nowRunning }: aborted`);
      return res.status(200).send({ 
        failure: deleteCampaignMessageFailure, 
        success 
      });

    }

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ success: true });

  } catch (error) {

    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/templates/update", async (req, res) => { 

  const nowRunning = "/campaigns/templates/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 55;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      content: Joi.string().required(),
      front: Joi.boolean().required(),
      locked: Joi.boolean().required(),
      masterKey: Joi.string().required().uuid(),
      messageId: Joi.string().required().uuid(),
      messageName: Joi.string().required(),
      notes: Joi.string().required().allow('', null),
      repeatable: Joi.boolean().required(),
      subject: Joi.string().required(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      active,
      apiTesting,
      campaignId,
      content,
      front,
      locked,
      messageName,
      messageId,
      notes,
      repeatable,
      subject,
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

    const now = +moment().format('X');
    locked ? locked = userLevel : locked = 1;
    let queryText = `
      UPDATE 
        messages 
      SET 
        active = ${active}, 
        content = '${stringCleaner(content, true)}', 
        message_name = '${stringCleaner(messageName, true)}', 
        notes = '${stringCleaner(notes, true)}', 
        repeatable = ${repeatable}, 
        subject = '${stringCleaner(subject, true)}', 
        updated = ${now}, 
        updated_by = '${userId}'
      WHERE 
        message_id = '${messageId}'
      ;
    `;

    
    // move the message to the front of the rotation?
    
    if (front) queryText += ` 
      UPDATE 
        campaign_messages 
      SET 
        last_sent = -1 
      WHERE 
        campaign_id = '${campaignId}' 
      AND 
        message_id = '${messageId}'
      ;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating the campaign message'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    let eventDetails = 'The message was updated from the scheduler.';

    if (front) eventDetails += ` It was moved to the front of the rotation on campaign ID <b>${campaignId}</b>.`

    recordEvent ({ 
      apiTesting, 
      event: 12, 
      eventDetails, 
      eventTarget: messageId, 
      userId 
    });
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ success: true });

  } catch (error) {

    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );

  }

});

router.post("/new", async (req, res) => { 

  const nowRunning = "/campaigns/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 28;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignInterval: Joi.number().required().integer().min(1).max(16),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow('', null),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when('campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow('', null),
      locked: Joi.boolean().optional(),
      masterKey: Joi.string().required().uuid(),
      messageSeries: Joi.boolean().optional(),
      unsubUrl: Joi.string().required(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });

    console.log(errorMessage)
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(200).send({ 
        failure: errorMessage, 
        success 
      });

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
      unsubUrl,
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

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null;
    !campaignNotes ? campaignNotes = '' : null;
    !campaignRepeats ? campaignRepeats = false : null;
    !campaignStarts ? campaignStarts = 0 : null;
    locked ? locked = userLevel : locked = 0;
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format('X');

    // create the campaign

    const queryText = `
      INSERT INTO 
        campaigns (
          active, 
          campaign_id, 
          campaign_name, 
          campaign_notes, 
          campaign_repeats, 
          created, 
          ends, 
          list_id, 
          interval, 
          locked, 
          message_series, 
          starts, 
          unsub_url, 
          updated, 
          updated_by
        ) 
      VALUES (
        ${active}, 
        '${uuidv4()}', 
        '${stringCleaner(campaignName, true)}', 
        '${stringCleaner(campaignNotes, true)}', 
        ${campaignRepeats}, 
        ${now}, 
        ${campaignEnds}, 
        '${listId}', 
        ${campaignInterval}, 
        ${locked}, 
        ${messageSeries}, 
        ${campaignStarts}, 
        '${unsubUrl}', 
        ${now}, 
        '${userId}'
      ) 
      RETURNING 
        campaign_id
      ;
    `; 
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new campaign record'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    const campaignId = results.rows[0].campaign_id

    // Check/adjust campaign list.

    const { 
      closedCampaigns,
      failure: checkCampaignsFailure
    } = await checkCampaigns({ userId });

    
    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }
    
    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ 
      campaignId, 
      closedCampaigns, 
      success: true 
    })

  } catch (error) {
    
    return await handleError({ 
      error, 
      errorNumber, 
      nowRunning, 
      userId: req.body.userId || API_ACCESS_TOKEN
    });
  
  }

});

router.post("/unsubscribe", async (req, res) => { 

  const nowRunning = "/campaigns/unsubscribe";
  console.log(`${nowRunning}: running`);

  const errorNumber = 46;
  const success = false;

  try {

    if (req.body.apiKey != process.env.EXTERNAL_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiKey: Joi.string().required().uuid(),
      apiTesting: Joi.boolean().optional(),
      campaignId: Joi.string().required().uuid(),
      contactId: Joi.string().required().uuid(),
      preference: Joi.number().required().integer().min(1).max(2)
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

    }

    let { 
      apiKey,
      apiTesting,
      campaignId,
      contactId,
      preference
    } = req.body;

    const now = +moment().format('X');
    const userId = apiKey;

    // default mode is to just unsubscribe from this campaign (hopefully). 2nd query is just padding so there are the same query positions.

    let queryText = `
      INSERT INTO 
        unsubs (
          campaign_id, 
          contact_id, 
          created
        ) 
      VALUES (
        '${campaignId}', 
        '${contactId}', 
        ${now}
      ) 
      ON CONFLICT DO NOTHING
      ;      
      SELECT 
        contact_id 
      FROM 
        contacts 
      LIMIT 1
      ;
    `;
  
    // however, the contact might ask for a total block :-(

    if (preference === 2) {
      
      queryText = `
        UPDATE 
          contacts 
        SET 
          active = false, 
          block_all = true, 
          updated = ${now}, 
          updated_by = '${contactId}' 
        WHERE 
          contact_id = '${contactId}'
        ;        
        DELETE FROM 
          list_contacts 
        WHERE 
          contact_id = '${contactId}'
        ;
      `;

    }

    queryText += `
      SELECT 
        company_name, 
        contact_name, 
        email 
      FROM 
        contacts 
      WHERE 
        contact_id = '${contactId}'
      ;
      SELECT 
        campaign_name 
      FROM 
        campaigns 
      WHERE 
        campaign_id = '${campaignId}'
      ;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = ' an error occurred when trying to set a full block for this contact ID'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );

    }

    let {
      company_name: companyName, 
      contact_name: contactName,
      email
    } = results[2].rows[0];

    if (companyName) contactName += ': ' + companyName;

    contactName += `, using email: ${email}`;

    const { campaign_name: campaignName } = results[3].rows[0];

    if (preference === 1) {

      const eventDetails = `This contact unsubcribed from the campaign <b>${stringCleaner(campaignName)}</b>.`;
      recordEvent ({ 
        apiTesting, 
        event: 7, 
        eventDetails, 
        eventTarget: contactId, 
        userId: apiKey 
      });

    } else {

      const eventDetails = 'This contact asked for a complete block.';
      recordEvent ({ 
        apiTesting, 
        event: 8, 
        eventDetails, 
        eventTarget: contactId, 
        userId: apiKey 
      });

    }
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ success: true });

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );
  
  }

});

router.post("/update", async (req, res) => { 

  const nowRunning = "/campaigns/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 29;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      campaignEnds: Joi.number().integer().optional(),
      campaignId: Joi.string().required().uuid(),
      campaignInterval: Joi.number().required().integer().min(1).max(16),
      campaignName: Joi.string().required(),
      campaignNotes: Joi.string().optional().allow('', null),
      campaignRepeats: Joi.boolean().required(),
      campaignStarts: Joi.number().integer().optional().when('campaignEnds', {
        is: Joi.exist(),
        then: Joi.number().required(),
        otherwise: Joi.forbidden()
      }),
      listId: Joi.string().optional().uuid().allow('', null),
      locked: Joi.boolean().optional(),
      masterKey: Joi.string().required().uuid(),
      messageSeries: Joi.boolean().optional(),
      unsubUrl: Joi.string().required(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} exited due to a validation error: ${errorMessage}`);
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

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

    // safety checks + setup

    !campaignEnds ? campaignEnds = 0 : null;
    !campaignNotes ? campaignNotes = '' : null;
    !campaignRepeats ? campaignRepeats = false : null;
    !campaignStarts ? campaignStarts = 0 : null;
    locked ? locked = userLevel : locked = 0;
    !messageSeries ? messageSeries = false : null;
    !campaignStarts || !listId ? active = false : null; // this list is not ready
    const now = moment().format('X');

    // update the campaign

    const queryText = `
      UPDATE 
        campaigns 
      SET 
        active = ${active}, 
        campaign_name = '${stringCleaner(campaignName, true)}', 
        campaign_notes = '${stringCleaner(campaignNotes, true)}', 
        campaign_repeats = ${campaignRepeats}, 
        ends = ${campaignEnds}, 
        interval = ${campaignInterval}, 
        list_id = '${listId}', 
        locked = ${locked}, 
        message_series = ${messageSeries}, 
        starts = ${campaignStarts}, 
        updated = ${now}, 
        updated_by = '${userId}' 
      WHERE 
        campaign_id = '${campaignId}' 
      AND 
        locked <= ${userLevel} 
      RETURNING 
        campaign_id
      ;
    `;  
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating a  campaign record'
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      );
      
    }

    // normally what we're doing here is making sure campaign.active is not true if the list ID that was selected is now inactive

    const { 
      closedCampaigns,
      failure: checkCampaignsFailure 
    } = await checkCampaigns(userId);

    if (checkCampaignsFailure) {
      
      console.log(`${nowRunning}: aborted, ${checkCampaignsFailure}`);
      return res.status(200).send(`failure: ${checkCampaignsFailure}`);

    }
    
    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ 
      closedCampaigns, 
      success: true 
    });

  } catch (error) {
    
    return res.status(200).send(
      await handleError({ 
        error,
        errorNumber, 
        nowRunning, 
        userId: req.body.userId || API_ACCESS_TOKEN
      })
    );
  
  }

})

module.exports = router;
console.log('campaign services loaded successfully!');