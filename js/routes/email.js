console.log("loading email services now...");
const db = require('../db');
const handleError = require('../handleError');
const express = require('express');
const Joi = require('joi');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json());

const { API_ACCESS_TOKEN } = process.env;
const success = false;
const { 
  getUserLevel,
  stringCleaner,
  validateSchema
} = require('../functions.js');

router.post("/signatures/all", async (req, res) => { 

  const nowRunning = "/email/signatures/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 16;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional(),
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

    let queryText = `
      SELECT 
        * 
      FROM 
        email_signatures 
      ${active && typeof active === 'boolean' ? `WHERE active = ${active}` : ''}
      ORDER BY 
        active DESC, 
        signature_name;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when removing a signature record';
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
    
    const signatures = {};
    const signaturesSelector = [];

    Object.values(results.rows).forEach(row => {

      let {
        active,
        owner,
        private,
        signature_id: signatureId,
        signature_name: signatureName,
        signature_text: signatureText
      } = row;

      if (!active) signatureName += '*';

      signatureName = stringCleaner(signatureName);

      signatures[signatureId] = {
        active,
        owner,
        private,
        signatureName,
        signatureText: stringCleaner(signatureText)
      }
      signaturesSelector.push({
        label: signatureName,
        value: signatureId
      });

    });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ signatures, signaturesSelector, success: true });

 } catch (e) {

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

router.post("/signatures/delete", async (req, res) => { 

  const nowRunning = "/email/signatures/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 14;
  
  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      masterKey: Joi.any(),
      signatureId: Joi.string().required().uuid(),
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
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

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

    const queryText = `
      DELETE FROM 
        email_signatures 
      WHERE 
        signature_id = '${signatureId}' 
      AND 
        (
          owner = '${userId}' 
          OR 
          owner IN (
            SELECT 
              user_id 
            FROM 
              users 
            WHERE 
              active = false OR level < ${userLevel}
          )
        )
      RETURNING *
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when removing a signature record';
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
    return res.status(200).send({ success: true });

 } catch (e) {

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

router.post("/signatures/load", async (req, res) => { 

  const nowRunning = "/email/signatures/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 17;
  
  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      masterKey: Joi.any(),
      signatureId: Joi.string().required().uuid(),
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
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

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

    const queryText = `
      SELECT 
        e.*, 
        u.user_name 
      FROM 
        email_signatures e
      JOIN 
        users u 
      ON 
        e.owner = u.user_id 
      WHERE 
        e.signature_id = '${signatureId}'
      ;
    `;

    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting a signature record';
      console.log(`${nowRunning}: ${failure}`);
      rrecordError
      
    } else if (!results.rowCount) { // this is not an API failure

      const failure = 'signature record not found';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send({ 
        failure, 
        success 
      });

    }
    
    const {
      active,
      owner,
      private: privateSignature,
      signature_name: signatureName,
      signature_text: signatureText,
      user_name: signatureOwner
    } = results.rows[0];    
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      active,
      owner,
      privateSignature,
      signatureName: stringCleaner(signatureName),
      signatureOwner: stringCleaner(signatureOwner),
      signatureText: stringCleaner(signatureText),
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

router.post("/signatures/new", async (req, res) => { 

  const nowRunning = "/email/signatures/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 13;
  
  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      masterKey: Joi.any(),
      private: Joi.boolean().optional(),
      signatureName: Joi.string().required(),
      signatureText: Joi.string().required(),
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
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

   }

    let { 
      apiTesting,
      private,
      signatureName,
      signatureText,
      userId 
    } = req.body;

    if (!private) private = true;

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
    const queryText = `
      INSERT INTO email_signatures (
        owner, 
        ${private !== undefined ? 'private,' : ''} 
        signature_id, 
        signature_name, 
        signature_text
      ) 
      VALUES (
        '${userId}', 
        ${private !== undefined ? private + ',' : ''} 
        '${uuidv4()}', 
        '${stringCleaner(signatureName, true)}', 
        '${stringCleaner(signatureText, true)}'
      ) 
      ON CONFLICT 
        DO NOTHING 
      RETURNING 
        *
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new signature record';
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
      signatureId, 
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

router.post("/signatures/update", async (req, res) => { 

  const nowRunning = "/email/signatures/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 15;
  
  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      private: Joi.boolean().optional(),
      signatureName: Joi.string().required(),
      signatureText: Joi.string().required(),
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
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

   }

    let { 
      active,
      apiTesting,
      private,
      signatureName,
      signatureText,
      userId 
    } = req.body;

    if (!private) private = true;

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
      UPDATE email_signatures 
      SET 
        signature_name = '${stringCleaner(signatureName, true)}', 
        signature_text = '${stringCleaner(signatureText, true)}' 
        ${active !== undefined ? `, active = ${active}` : ''} 
        ${private !== undefined ? `, private = ${private}` : ''}
      WHERE 
        owner = '${userId}' 
        OR owner IN (
          SELECT user_id 
          FROM users 
          WHERE active = false 
          OR level < ${userLevel}
        )
      RETURNING *;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new signature record';
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

module.exports = router;
console.log('email services loaded successfully!');