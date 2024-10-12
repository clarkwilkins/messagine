console.log("loading template services now...");
const db = require('../db');
const handleError = require('../handleError');
const express = require('express');
const Joi = require('joi');
const moment = require('moment');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json())

const { API_ACCESS_TOKEN } = process.env;
const { 
  getUserLevel,
  stringCleaner,
  validateSchema
} = require('../functions.js');

const success = false;

router.post("/all", async (req, res) => { 

  const nowRunning = "/templates/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 37;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional().allow('', null),
      masterKey: Joi.any(),
      userId: Joi.string().required().uuid()
    })
;

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

    const queryText = `
      SELECT 
        m.*, 
        u.user_name  
      FROM 
        messages m
      JOIN 
        users u 
      ON 
        m.updated_by = u.user_id
      ${typeof active === 'boolean' ? `WHERE m.active = ${active}` : ''}
      ORDER BY 
        active DESC, 
        message_name
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

    const messages = {};
    const messageList = {};

    Object.values(results.rows).forEach(row => { 
      
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
        content: stringCleaner(content),
        created: +created,
        locked: +locked,
        messageName: stringCleaner(messageName),
        notes: stringCleaner(notes),
        owner,
        repeatable,
        subject: stringCleaner(subject),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner(updatedBy2)
      };
      messageList[messageId] = `${messageName}${active ? '' : '*'}`;

    });
    
    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ 
      messageList,
      messages, 
      success: true 
    })

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

router.post("/delete", async (req, res) => { 

  const nowRunning = "/templates/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 36;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    })
;

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

    // delete the message only if it's not involved in ANY active campaigns

    const queryText = `
      DELETE FROM 
        messages 
      WHERE 
        message_id = '${messageId}' 
        AND locked <= ${userLevel} 
        AND message_id NOT IN (
          SELECT 
            cm.message_id 
          FROM 
            campaigns c
          JOIN 
            campaign_messages cm 
          ON 
            c.campaign_id = cm.campaign_id 
          WHERE 
            c.active = true 
            AND cm.message_id = '${messageId}'
        )
      ;
    `;
    let results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when deleting the message record'
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
      
    } else if (results.rowCount < 1) {

      const failure = 'the message record was not deleted due to a bad ID or because it\'s linked to a running campaign'
      console.log(`${nowRunning} : ${failure}`)
      return res.status(200).send({ 
        failure, 
        success: false 
      })

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

router.post("/duplicate", async (req, res) => { 

  const nowRunning = "/templates/duplicate";
  console.log(`${nowRunning}: running`);

  const errorNumber = 35;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageName: Joi.string().optional().allow('', null),
      sourceId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    })
;

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
      messageName,
      sourceId,
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

    // Get the source message.

    let queryText = `
      SELECT 
        * 
      FROM 
        messages 
      WHERE 
        message_id = '${sourceId}'
      ;
    `;

    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new message record'
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
      
    } else if (results.rowCount < 1) {

      const failure = 'source message not found'
      return res.status(200).send({ 
        failure, 
        success 
      });

    }

    const {
      content,
      message_name: originalName,
      notes,
      repeatable,
      subject
    } = results.rows[0]

    const now = moment().format('X');
    queryText = `
      INSERT INTO 
        messages(
          content, 
          created, 
          locked, 
          message_id, 
          message_name, 
          notes, 
          owner, 
          repeatable, 
          subject, 
          updated, 
          updated_by
        ) 
      VALUES (
        '${content}', 
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        ${locked ? userLevel : 0}, 
        '${uuidv4()}', 
        '${messageName ? stringCleaner(messageName, true) : 'copy of ' + originalName}', 
        '${notes}', 
        '${userId}', 
        ${repeatable}, 
        '${subject}', 
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        '${userId}'
      ) 
      ON CONFLICT 
        DO NOTHING 
      RETURNING 
        message_id
      ;
    `;
    results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when duplicating the message record'
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

    const messageId = results.rows[0].message_id;    
    console.log(`${nowRunning}: finished`)
    return res.status(200).send({ 
      messageId, 
      success: true 
    })

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

router.post("/load", async (req, res) => { 

  const nowRunning = "/templates/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 38;
  const success = false;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      masterKey: Joi.any(),
      messageId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    })
;

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

    const queryText = " SELECT m.*, u.user_name  FROM messages m, users u WHERE m.updated_by = u.user_id AND m.message_id = '" + messageId + "'; "
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the message'
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
      
    } else if (!results.rows[0]?.message_id) {

      const failure = 'messageId ' + messageId + ' was not found'
      return res.status(200).send({ 
        failure, 
        success 
      });
      
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
    
    console.log(`${nowRunning}: finished`); const a = results.rows
    return res.status(200).send({ 
      active,
      content: stringCleaner(content),
      created: +created,
      locked: +locked,
      messageName: stringCleaner(messageName),
      notes: stringCleaner(notes),
      owner,
      repeatable,
      subject: stringCleaner(subject),
      success: true,
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner(updatedBy2)
    })

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

  const nowRunning = "/templates/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 33;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageContent: Joi.string().required(),
      messageName: Joi.string().required(),
      messageNotes: Joi.string().optional().allow('', null),
      messageSubject: Joi.string().required(),
      repeatable: Joi.boolean().required(),
      userId: Joi.string().required().uuid()
    })
;

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
      locked,
      messageContent,
      messageName,
      messageNotes,
      messageSubject,
      repeatable,
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

    const messageId = uuidv4();
    const now = moment().format('X')

    // Create the message.

    const queryText = `
      INSERT INTO messages (
        active,
        created,
        content,
        locked, 
        message_id,
        message_name,
        notes,
        owner,
        repeatable, 
        subject, 
        updated, 
        updated_by
      ) 
      VALUES (
        ${active ? 'true' : 'false'},
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        '${stringCleaner(messageContent, true)}',
        ${locked ? userLevel : 0},
        '${messageId}',
        '${stringCleaner(messageName, true)}',
        '${stringCleaner(messageNotes, true)}',
        '${userId}',
        ${repeatable ? 'true' : 'false'},
        '${stringCleaner(messageSubject, true)}',
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        '${userId}'
      ) 
      ON CONFLICT DO NOTHING 
      RETURNING message_id;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new message record'
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
    return res.status(200).send({ 
      messageId, 
      success: true 
    })

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

  const nowRunning = "/templates/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 34;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().required(),
      apiTesting: Joi.boolean().optional(),
      locked: Joi.boolean().optional(),
      masterKey: Joi.any(),
      messageContent: Joi.string().required(),
      messageId: Joi.string().required().uuid(),
      messageName: Joi.string().required(),
      messageNotes: Joi.string().optional().allow('', null),
      messageSubject: Joi.string().required(),
      repeatable: Joi.boolean().required(),
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
      locked,
      messageContent,
      messageId,
      messageName,
      messageNotes,
      messageSubject,
      repeatable,
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

    // Update the message.

    const queryText = `
      UPDATE messages 
      SET 
        content = '${stringCleaner(messageContent, true)}',
        ${active !== undefined ? `active = ${active},` : ''}
        ${locked !== undefined ? `locked = ${userLevel},` : ''}
        message_name = '${stringCleaner(messageName, true)}',
        ${messageNotes ? `notes = '${stringCleaner(messageNotes, true)}',` : ''}
        repeatable = ${repeatable},
        subject = '${stringCleaner(messageSubject, true)}',
        updated = ${moment().format('X')},
        updated_by = '${userId}'
      WHERE 
        message_id = '${messageId}' 
        AND locked <= ${userLevel};
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating the message record'
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

})

module.exports = router;
console.log('template services loaded successfully!');