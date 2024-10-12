console.log("loading contacts services now...");
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
  containsHTML,
  getUserLevel,
  stringCleaner,
  validateSchema
} = require('../functions.js');
const success = false;

router.post("/all", async (req, res) => { 

  const nowRunning = "/contacts/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 20;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional(),
      masterKey: Joi.any(),
      stringFilter: Joi.string().optional().allow('', null),
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
      stringFilter,
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
    
    if (!stringFilter) stringFilter = '';

    if (stringFilter.length > 2) stringFilter = stringCleaner(stringFilter, true);

    let queryText = `
      SELECT 
        c.*, 
        u.user_name 
      FROM 
        contacts c
      JOIN 
        users u 
      ON 
        c.updated_by = u.user_id 
    `;

    if (typeof active === 'boolean') {
      queryText += `
      AND 
        c.active = ${active}
      `;
    }

    if (stringFilter.length > 2) {
      queryText += `
      AND (
        c.company_name ILIKE '%${stringFilter}%' 
        OR c.contact_name ILIKE '%${stringFilter}%' 
        OR c.email ILIKE '%${stringFilter}%'
      )
      `;
    }

    queryText += `
      ORDER BY 
        block_all, 
        active DESC, 
        contact_name
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting contact records';
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

    const availableContacts = {};
    const contacts = {};
    const contactsSelector = [];

    Object.values(results.rows).forEach(row => {

      let {
        active,
        block_all: blockAll,
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        created,
        email,
        locked,
        sms,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;
      let fullName = contactName;

      if (companyName) fullName += ', ' + companyName;

      fullName = stringCleaner(fullName);
      const contactData = {
        active,
        blockAll,
        companyName: stringCleaner(companyName),
        contactName: stringCleaner(contactName),
        contactNotes: stringCleaner(contactNotes, false, !containsHTML(contactNotes)),
        created: +created,
        email: stringCleaner(email),
        fullName,
        locked: +locked,
        sms: stringCleaner(sms),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner(updatedBy2)
      }
      
      if (active && !blockAll) { availableContacts[contactId] = contactData; }

      contacts[contactId] = contactData;
      contactsSelector.push({
        label: fullName,
        value: contactId
      })

    });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      availableContacts,
      contacts, 
      contactsSelector, 
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

router.post("/load", async (req, res) => { 

  const nowRunning = "/contacts/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 21;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      contactId: Joi.string().required().uuid(),
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
      contactId,
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
        c.*, 
        u.user_name 
      FROM 
        contacts c
      JOIN 
        users u 
      ON 
        c.updated_by = u.user_id 
      WHERE 
        c.contact_id = '${contactId}'
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting contact records';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send(
        await handleError({ 
          details: queryText,
          errorNumber, 
          failure, 
          nowRunning, 
          userId 
        })
      )
      
    } else if (!results.rowCount) {

      const failure = 'contact ID was not found';
      return res.status(200).send({ 
        failure, 
        success 
      })

    }

    let {
      active,
      block_all: blockAll,
      company_name: companyName,
      contact_name: contactName,
      contact_notes: contactNotes,
      created,
      email,
      locked,
      sms,
      updated,
      updated_by: updatedBy,
      user_name: updatedBy2
    } = results.rows[0];

    let fullName = contactName;

    if (companyName) fullName += ', ' + companyName;

    fullName = stringCleaner(fullName);
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      active,
      blockAll,
      companyName: stringCleaner(companyName),
      contactName: stringCleaner(contactName),
      contactNotes: stringCleaner(contactNotes, false, !containsHTML(contactNotes)),
      created: +created,
      email: stringCleaner(email),
      fullName,
      locked: +locked,
      sms: stringCleaner(sms),
      updated: +updated,
      updatedBy,
      updatedBy2: stringCleaner(updatedBy2),
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

router.post("/new", async (req, res) => { 

  const nowRunning = "/contacts/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 18;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      companyName: Joi.string().optional().allow('', null),
      contactName: Joi.string().required(),
      contactNotes: Joi.string().optional().allow('', null),
      email: Joi.string().required(),
      locked: Joi.boolean(),
      masterKey: Joi.any(),
      sms: Joi.string().optional().allow('', null),
      url: Joi.string().optional().allow('', null),
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
      companyName,
      contactName,
      contactNotes,
      email,
      locked,
      sms,
      url,
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

    const contactId = uuidv4();
    companyName ? companyName = stringCleaner(companyName, true) : companyName = '';
    contactName = stringCleaner(contactName, true);
    contactNotes ? contactNotes = stringCleaner(contactNotes, true) : contactNotes = '';
    email = stringCleaner(email, true);
    locked ? locked = +userLevel : locked = 0;
    const now = moment().format('X');
    sms ? sms = stringCleaner(sms, true) : sms = '';
    url ? url = stringCleaner(url, true) : url = '';

    const queryText = `
      INSERT INTO contacts (
        company_name, 
        contact_id, 
        contact_name, 
        contact_notes, 
        created, 
        email, 
        locked, 
        sms, 
        updated, 
        updated_by
      ) 
      VALUES (
        '${companyName}', 
        '${contactId}', 
        '${contactName}', 
        '${contactNotes}', 
        ${now}, 
        '${email}', 
        ${locked}, 
        '${sms}', 
        ${now}, 
        '${userId}'
      ) 
      ON CONFLICT DO NOTHING 
      RETURNING contact_id
      ;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new contact record';
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
      
    } else if (results.rowCount === 0) {

      const failure = 'attempt to create a duplicate contact name/email pair was blocked';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send({ 
        failure, 
        success 
      });

    }
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ contactId, success: true });

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

router.post("/search", async (req, res) => { 

  const nowRunning = "/contacts/search";
  console.log(`${nowRunning}: running`);

  const errorNumber = 22;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional().allow('', null),
      blockAll: Joi.boolean().optional().allow('', null),
      companyName: Joi.string().optional().min(3).allow('', null),
      contactName: Joi.string().optional().min(3).allow('', null),
      contactNotes: Joi.string().optional().min(3).allow('', null),
      email: Joi.string().optional().min(5).allow('', null),
      masterKey: Joi.any(),
      sms: Joi.string().optional().min(3).allow('', null),
      url: Joi.string().optional().min(7).allow('', null),
      userId: Joi.any() // only relevant for Postman testing
    })
    .or('active', 'blockAll', 'companyName', 'contactName', 'contactNotes', 'sms', 'url');

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
      blockAll,
      companyName,
      contactName,
      contactNotes,
      email,
      sms,
      url,
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
        c.*, 
        u.user_name 
      FROM 
        contacts c
      JOIN 
        users u 
      ON 
        c.updated_by = u.user_id
    `;

    if (typeof active === 'boolean') {

      queryText += `
      AND c.active = ${active}
      `;

    }

    if (typeof blockAll === 'boolean') {

      queryText += `
       AND c.block_all = ${blockAll}
      `;

    }

    if (companyName) {

      queryText += `
      AND c.company_name ILIKE '%${stringCleaner(companyName)}%'
      `;

    }

    if (contactName) {

      queryText += `
      AND c.contact_name ILIKE '%${stringCleaner(contactName)}%'
      `;

    }

    if (contactNotes) {

      queryText += `
      AND c.contact_notes ILIKE '%${stringCleaner(contactNotes)}%'
      `;

    }

    if (email) {

      queryText += `
      AND c.email ILIKE '%${stringCleaner(email)}%'
      `;

    }

    if (sms) {

      queryText += `
      AND c.sms ILIKE '%${stringCleaner(sms)}%'
      `;

    }

    if (url) {

      queryText += `
      AND c.url ILIKE '%${stringCleaner(url)}%'
      `;

    }

    queryText += `
      ORDER BY 
        c.active DESC, 
        c.block_all, 
        c.contact_name, 
        c.company_name
      ;
    `;

    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when searching contact records';
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

    const contacts = {};
    const contactsSelector = [];

    Object.values(results.rows).forEach(row => {

      let {
        active,
        block_all: blockAll,
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        created,
        email,
        locked,
        sms,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;
      let fullName = contactName;

      if (companyName) fullName += ', ' + companyName;

      fullName = stringCleaner(fullName);

      contacts[contactId] = {
        active,
        blockAll,
        companyName: stringCleaner(companyName),
        contactName: stringCleaner(contactName),
        contactNotes: stringCleaner(contactNotes, false, !containsHTML(contactNotes)),
        created: +created,
        email: stringCleaner(email),
        fullName,
        locked: +locked,
        sms: stringCleaner(sms),
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner(updatedBy2)
      };
      contactsSelector.push({
        label: fullName,
        value: contactId
      });

    });
    
    console.log(`${nowRunning}: finished`);
    return res.status(200).send({ 
      contacts, 
      contactsSelector, 
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

router.post("/update", async (req, res) => { 

  const nowRunning = "/contacts/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 19;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      active: Joi.boolean().optional(),
      apiTesting: Joi.boolean().optional(),
      blockAll: Joi.boolean().optional(),
      contactId: Joi.string().required().uuid(),
      companyName: Joi.string().optional().allow('', null),
      contactName: Joi.string().required(),
      contactNotes: Joi.string().optional().allow('', null),
      email: Joi.string().required(),
      locked: Joi.boolean(),
      masterKey: Joi.any(),
      sms: Joi.string().optional().allow('', null),
      url: Joi.string().optional().allow('', null),
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
      blockAll,
      contactId,
      companyName,
      contactName,
      contactNotes,
      email,
      locked,
      sms,
      url,
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
      UPDATE contacts 
      SET 
        active = ${typeof active === 'boolean' ? `${active}` : 'active'} ,
        block_all = ${typeof blockAll === 'boolean' && +userLevel > 6 ? `${blockAll}` : 'blockAll'},
        company_name = '${companyName ? stringCleaner(companyName, true) : ''}', 
        contact_name = '${stringCleaner(contactName, true)}', 
        contact_notes = '${contactNotes ? stringCleaner(contactNotes, true) : ''}', 
        email = '${stringCleaner(email, true)}', 
        locked = ${locked === true ? userLevel : locked === false ? 0 : 'locked'},
        sms = '${sms ? stringCleaner(sms, true) : ''}', 
        updated = ${moment().format('X')}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        updated_by = '${userId}', 
        url = '${url ? stringCleaner(url, true) : 'url'}'
      WHERE 
        contact_id = '${contactId}'
      RETURNING 
        contact_id;
    `;
    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when updating contact record';
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
console.log('contact services loaded successfully!');