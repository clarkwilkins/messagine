console.log("loading utilities routes now...");
const db = require('../db');
const express = require('express');
const handleError = require('../handleError');
const Joi = require('joi');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json());

const { 
  getUserLevel,
  recordEvent,
  stringCleaner,
  validateSchema
} = require('../functions.js');
const success = false;

router.post("/hashtags/all", async (req, res) => {

  const nowRunning = "utilities/hashtags/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 9;
  
  try {

    const schema = Joi.object({ 
      active: Joi.boolean(),
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

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ failure: errorMessage, success });

    }

    const {
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
        * 
      FROM 
        tags 
      ${typeof active === 'boolean' ? `WHERE active = ${active}` : ''} 
      ORDER BY 
        active DESC, 
        tag_text
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting tags';
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

    const tags = {};
    const tagsSelector = [];
    Object.values(results.rows).forEach(row => {

      let {
        active,
        notes,
        tag_id: tagId,
        tag_text: tagText
      } = row;
      notes = stringCleaner(notes);
      tagText = stringCleaner(tagText);
      tags[tagId] = {
        active,
        notes,
        tagText
      };
      tagText = '#' + tagText;

      if (!active) tagText += '*';

      tagsSelector.push({
        label: tagText,
        value: tagId
      });

    });

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ success: true, tags, tagsSelector });

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

router.post("/hashtags/create", async (req, res) => {

  const nowRunning = "utilities/hashtags/create";
  console.log(`${nowRunning}: running`);

  const errorNumber = 7;
  
  try {

    const schema = Joi.object({ 
      apiTesting: Joi.boolean(),
      notes: Joi.string().optional().allow('', null),
      masterKey: Joi.any(),
      tagText: Joi.string().required().min(3).max(30),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ failure: errorMessage, success });

    }

    const {
      apiTesting,
      notes,
      tagText,
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
      INSERT INTO 
        tags (
          notes, 
          tag_id, 
          tag_text
        ) 
      VALUES (
        '${stringCleaner(notes, true)}', 
        '${uuidv4()}', 
        '${stringCleaner(tagText, true)}'
      )
        ON CONFLICT
          DO NOTHING
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new tag record';
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

router.post("/hashtags/delete", async (req, res) => {

  const nowRunning = "utilities/hashtags/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 8;
  
  try {

    const schema = Joi.object({ 
      apiTesting: Joi.boolean(),
      masterKey: Joi.any(),
      tagId: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ failure: errorMessage, success });

    }

    const {
      apiTesting,
      tagId,
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
      DELETE FROM 
        tags 
      WHERE 
        tag_id = '${tagId}'
      ;
      DELETE FROM 
        tag_connects 
      WHERE 
        tag_id = '${tagId}';
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new tag record';
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

router.post("/hashtags/update", async (req, res) => {

  const nowRunning = "utilities/hashtags/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 10;
  
  try {

    const schema = Joi.object({ 
      apiTesting: Joi.boolean(),
      active: Joi.boolean().required(),
      notes: Joi.string().optional().allow('', null),
      masterKey: Joi.any(),
      tagId: Joi.string().required().uuid(),
      tagText: Joi.string().required().min(3).max(30),
      userId: Joi.string().required().uuid()
    });

    const errorMessage = await validateSchema({ 
      errorNumber, 
      nowRunning, 
      req,
      schema 
    });
  
    if (errorMessage) {

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ failure: errorMessage, success });

    }

    const {
      active,
      apiTesting,
      notes,
      tagId,
      tagText,
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

    if (!notes) notes = ''; 

    const queryText = `
      UPDATE 
        tags 
      SET 
        active = ${active}, 
        notes = '${stringCleaner(notes, true)}', 
        tag_text = '${stringCleaner(tagText, true)}' 
      WHERE 
        tag_id = '${tagId}'
      ;
    `;  
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating the tag record';
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

router.post("/record-event", async (req, res) => {

  const nowRunning = "utilities/record-event";
  console.log(`${nowRunning}: running`);

  const errorNumber = 59;
  
  try {

    const schema = Joi.object({ 
      apiTesting: Joi.boolean(),
      eventDetails: Joi.string().optional().allow('', null),
      eventNumber: Joi.number().required().integer().positive(),
      eventTarget: Joi.string().required().uuid(),
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

      console.log(`${nowRunning} aborted due to a validation error: ${errorMessage}`);
      return res.status(422).send({ failure: errorMessage, success });

    }

    const {
      apiTesting,
      eventDetails,
      eventNumber,
      eventTarget,
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

    await recordEvent ({ 
      apiTesting,
      event: eventNumber, 
      eventDetails, 
      eventTarget, 
      userId 
    });

    console.log(`${nowRunning}: finished`);
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

module.exports = router;
console.log('utilities routes loaded successfully!');