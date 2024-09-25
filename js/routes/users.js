console.log("loading user services now...");
const bcrypt = require('bcrypt');
const db = require('../db');
const handleError = require('../handleError');
const express = require('express');
const fs = require('fs');
const Joi = require('joi');
const jwt = require ('jsonwebtoken');
const moment = require('moment');
const { replace } = require('lodash');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
router.use(express.json());

const { 
  API_ACCESS_TOKEN,
  JWT_KEY
} = process.env;
const { 
  getUserLevel,
  randomString,
  sendMail,
  stringCleaner,
  validateSchema
} = require('../functions.js');

const success = false;

router.post("/all", async (req, res) => { 

  const nowRunning = "/users/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 1;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

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
      return res.status(422).send({ 
        failure: errorMessage, 
        success 
      });

   }

    const { 
      active,
      userId 
    } = req.body;

    // comment out level check if creating the first user and do not supply userId in the JSON

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
        users 
      ${typeof active === 'boolean' ? `WHERE active = ${active}` : ''} 
      ORDER BY 
        active DESC, 
        user_name
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting users';
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

    const users = {};
    const usersSelector = [];

    Object.values(results.rows).forEach(row => {

      let {
        active,
        email,
        level,
        user_id: userId,
        user_name: userName
      } = row;

      userName = stringCleaner(userName);

      users[userId] = {
        active,
        email,
        level: +level,
        userName
      };

      if (!active) userName += '*';

      usersSelector.push({
        label: userName,
        value: userId
      });

    })

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      success: true, 
      users, 
      usersSelector 
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

  const nowRunning = "/users/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 12;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      masterKey: Joi.any(),
      thisUser: Joi.string().required().uuid(),
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

    const { 
      thisUser,
      userId 
    } = req.body;

    // Comment out level check if creating the first user and do not supply userId in the JSON!!

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
        users 
      WHERE 
        user_id = '${thisUser}' 
        AND level <= ${userLevel}
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the user record';
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
      
    } else if (results.rowCount !== 1) {

      return res.status(200).send({ 
        failure: 'user info restricted or not found', 
        success: true 
      });

    }

    const {
      active,
      email,
      level,
      user_name: userName
    } = results.rows[0];    

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      active,
      email,
      level: +level,
      success: true, 
      thisUser,
      userName: stringCleaner(userName)
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

router.post("/login-key", async (req, res) => {

  const nowRunning = "users/login-key";
  console.log(`${nowRunning}: running`);

  const errorNumber = 3;
  const userId = API_ACCESS_TOKEN;
  
  try {

    const schema = Joi.object({ 
      key: Joi.string().required().uuid(),
      masterKey: Joi.any(),
      userId: Joi.any() // this is ignored if present
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

    const { key } = req.body;
    const queryText = `
      SELECT 
        * 
      FROM 
        users 
      WHERE 
        active = true 
      AND 
        token = '${key}'
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText });

    if (!results) {

      const failure = 'database error when checking for an active user with this login key';
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

    let userRecord;
    
    if (results.rowCount > 0) {

      userRecord = results.rows[0];
      userRecord.token = jwt.sign ({ userRecord }, JWT_KEY, { expiresIn: "1h" });

    } else {

      console.log (nowRunning + ": failed");
      return res.status(400).send({ failure: 'token not found' });

    }

    console.log(`${nowRunning}: finished`);
    return res.status(200).send({
      success: true,
      userRecord,
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

router.post("/login-standard", async (req, res) => { 

  const nowRunning = "/users/login-standard";
  console.log(`${nowRunning}: running`);

  const errorNumber = 2;
  const userId = API_ACCESS_TOKEN;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      email: Joi.string().required().email(),
      masterKey: Joi.any(),
      passphrase: Joi.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
        .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
      userId: Joi.any().optional() // ignored
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

    const { 
      email,
      passphrase
    } = req.body; 

    const queryText = `
      SELECT 
        * 
      FROM 
        users 
      WHERE 
        active = true 
        AND email ILIKE '${stringCleaner(email, true)}'
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when checking for an active user with this email address';
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
  
    } else if (results.rowCount < 1) {

      const failure = 'invalid email'
      console.log (`nowRunning : ${failure}`);
      return res.status(200).send({ 
        failure, 
        success
      });
    }

    const userRecord = results.rows[0];
    const passwordCheck = await bcrypt.compare(email + passphrase, userRecord.login_hash);
    
    if (!passwordCheck) { // this is not logged as an error

      const failure = 'invalid password'
      console.log (`nowRunning : ${failure}`);
      return res.status(200).send({ 
        failure, 
        success
      });

    }

    token = jwt.sign ({ userRecord }, JWT_KEY, { expiresIn: "1h" });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      success: true,
      token
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

router.post("/new", async (req, res) => { 

  const nowRunning = "/users/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 1;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional().default(false),
      email: Joi.string().required().email(),
      level: Joi.number().optional().min(1).max(9).default(1),
      masterKey: Joi.any(),
      passphrase: Joi.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
        .message('Password must contain at least 1 uppercase character, 1 lowercase character, and 1 number'),
      userId: Joi.string().required().uuid(),
      userName: Joi.string().required()
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

    const { 
      apiTesting,
      email,
      level,
      passphrase,
      userId,
      userName 
    } = req.body;

    // Comment out level check if creating the first user and do not supply userId in the JSON!!

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

    // Don't allow current user to add a new one at a higher level.
    
    if (level > userLevel) level = userLevel;

    // Create the user.

    const loginHash = await bcrypt.hash(email + passphrase, 10);
    const queryText = `
      INSERT INTO 
        users (
          active, 
          email, 
          level, 
          login_hash, 
          token, 
          user_id, 
          user_name
        ) 
      VALUES (
        true, 
        '${stringCleaner(email, true)}', 
        ${level}, 
        '${loginHash}', 
        '${uuidv4()}', 
        '${uuidv4()}', 
        '${stringCleaner(userName, true)}'
      ) 
      RETURNING 
        *
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new user record';
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
      newId: results?.rows[0]?.user_id,
      success: true, 
      token: results?.rows[0]?.token 
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

router.post("/reset-password/part-1", async (req, res) => {

  const nowRunning = "/users/reset-password/part-1";
  console.log(`${nowRunning}: running`);

  const errorNumber = 4;
    
  try {

    const schema = Joi.object({
      apiTesting: Joi.boolean(),
      email: Joi.string().required().email(),
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

    const { 
      apiTesting,
      email 
    } = req.body;

    let queryText = `
      SELECT 
        user_id 
      FROM 
        users 
      WHERE 
        active = true 
        AND email ILIKE '${stringCleaner(email, true)}'
      ;
    `;

    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId: API_ACCESS_TOKEN });

    if (!results) {

      const failure = 'database error when checking if the email address belongs to an active user';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId: API_ACCESS_TOKEN
        })
      );
  
    } else if (results.rowCount < 1) {

      console.log (nowRunning + ": failed");
      return res.status(200).send({ failure: 'unregistered email address', success: true });

    }

    const { user_id: userId } = results.rows[0];

    const resetCode = randomString();
    queryText = `
      DELETE FROM 
        resets 
      WHERE 
        target = (SELECT user_id FROM users WHERE email = '${stringCleaner(email, true)}') 
        OR expires < ${moment().format('X')}
      ;
      
      INSERT INTO 
        resets (code, expires, target) 
      VALUES (
        '${resetCode}', 
        ${moment().add(1, 'hours').format('X')}, 
        '${userId}'
      ) 
      RETURNING *;
    `;

    results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when setting up a new reset record';
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
    
    let html = fs.readFileSync("./assets/files/html/password-reset.html", 'utf-8');
    html = replace(html, '[RESET-CODE]', resetCode);
    html = replace(html, '[YEAR]', moment().format('YYYY'));

    // sendMail won't work from localhost unless you can get past IP-whitelisting restrictions

    if (apiTesting !== true) await sendMail(email, html, 'Your reset code for access to Messagine');

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

router.post("/reset-password/part-2", async (req, res) => {

  const nowRunning = "/users/reset-password/part-2";
  console.log(`${nowRunning}: running`);

  const errorNumber = 5;
  const userId = API_ACCESS_TOKEN;
  
  try {

    const schema = Joi.object({
      apiTesting: Joi.boolean(),
      resetCode: Joi.string().required().min(8).max(8)
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

    const { 
      apiTesting,
      resetCode
    } = req.body;

    // verify this is a valid reset code

    const queryText = `
      SELECT 
        * 
      FROM 
        resets 
      WHERE 
        code = '${resetCode}' 
        AND expires >= ${moment().format('X')} -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
      ;
    `;

    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });
    
    if (!results) {

      const failure = 'database error when checking if the email address belongs to an active user';
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
  
    } else if (results.rowCount < 1) {

      console.log (nowRunning + ": failed");
      return res.status(200).send({ 
        codeOk: false, 
        success: true
      });

    }

    // get the user's registered email from the reset code record

    queryText = `
      SELECT 
        email 
      FROM 
        users 
      WHERE 
        user_id = '${results.rows[0].target}'
      ;
    `;
    results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the user\'s email address';
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
    
    const { email } = results.rows[0];

    if (!email) {

      const failure = 'the email address was not properly retrieved';
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

    // now update the user record so the reset code can be used as a login passphrase until it's further updated.

    const loginHash = await bcrypt.hash(email + resetCode, 10);
    queryText = `
      UPDATE 
        users 
      SET 
        login_hash = '${loginHash}' 
      WHERE 
        user_id = '${userId}' 
      RETURNING *
      ;      
      DELETE FROM 
        resets 
      WHERE 
        code = '${resetCode}'
      ;
    `;

    results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results || results[0].rowCount != 1) {

      const failure = 'database error when resetting the user\'s passphrase';
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

    const userRecord = results[0].rows[0];
    token = jwt.sign ({ userRecord }, JWT_KEY, { expiresIn: "1h" });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ token, success: true });

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

  const nowRunning = "/users/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 6;
  
  try {

    const schema = Joi.object({
      apiTesting: Joi.boolean(),
      active: Joi.boolean().required(),
      email: Joi.string().required().email(),
      masterKey: Joi.any(),
      passphrase: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .optional()
        .allow('', null)
        .messages({
          'string.pattern.base': 'Password must contain at least 1 upper-case character, 1 lower-case character, and 1 number.',
        }),
      thisUser: Joi.string().required().uuid(),
      userId: Joi.string().required().uuid(),
      userName: Joi.string().required()
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

    const { 
      apiTesting,
      active,
      email,
      passphrase,
      thisUser,
      userId,
      userName
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
      UPDATE 
        users 
      SET 
        ${typeof active === 'boolean' ? `active = ${active}, ` : ''} 
        ${email && passphrase ? `email = '${email}', login_hash = '${await bcrypt.hash(email + passphrase, 10)}', ` : ''} 
        user_name = '${stringCleaner(userName, true)}' 
      WHERE 
        user_id = '${thisUser}' 
      RETURNING 
        *
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating the user record';
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

    const userRecord = results.rows[0];
    token = jwt.sign ({ userRecord }, JWT_KEY, { expiresIn: "1h" });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      success: true,
      token}
    );

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
console.log('user services loaded successfully!');