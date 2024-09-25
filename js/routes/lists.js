console.log("loading lists services now...");
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
  recordEvent,
  stringCleaner,
  validateSchema
} = require('../functions.js');
const success = false;

router.post("/all", async (req, res) => { 

  const nowRunning = "/lists/all";
  console.log(`${nowRunning}: running`);

  const errorNumber = 25;

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

    const queryText = `
      SELECT 
        l.*, 
        u.user_name 
      FROM 
        lists l
      JOIN 
        users u 
      ON 
        l.updated_by = u.user_id 
      ${typeof active === 'boolean' ? `WHERE l.active = ${active}` : ''}
      ${stringFilter.length > 2 ? `AND l.list_name ILIKE '%${stringCleaner(stringFilter, true)}%'` : ''}
      ORDER BY 
        active DESC, 
        list_name
      ;
    `;
    const results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting list records';
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

    const lists = {};
    const listsSelector = [];

    Object.values(results.rows).forEach(row => {

      let {
        accept_contacts: acceptContacts,
        active,
        created,
        list_id: listId,
        list_name: listName,
        list_notes: listNotes,
        locked,
        updated,
        updated_by: updatedBy,
        user_name: updatedBy2
      } = row;

      lists[listId] = {
        acceptContacts,
        active,
        created: +created,
        listName: stringCleaner(listName),
        listNotes: stringCleaner(listNotes, false, !containsHTML(listNotes)),
        locked: +locked,
        updated: +updated,
        updatedBy,
        updatedBy2: stringCleaner(updatedBy2)
      };
      listsSelector.push({
        label: listName,
        value: listId
      });

    });
    
    console.log(nowRunning + ": finished\n");
    return res.status(200).send({ 
      lists, 
      listsSelector, 
      success: true 
    });

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

router.post("/contact-linking", async (req, res) => { 

  const nowRunning = "/lists/contact-linking";
  console.log(`${nowRunning}: running`);

  const errorNumber = 27;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      contactId: Joi.string().required().uuid(),
      link: Joi.boolean().required(),
      listId: Joi.string().required().uuid(),
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
      apiTesting,
      contactId,
      link,
      listId,
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
    
    let queryText;

    if (link === false) {

      queryText = `
        DELETE FROM 
          list_contacts 
        WHERE 
          contact_id = '${contactId}' 
        AND 
          list_id = '${listId}'
        ;
      `;

    } else {

      queryText = `
        INSERT INTO 
          list_contacts (
            contact_id, 
            created, 
            list_id, 
            updated, 
            updated_by
          ) 
        VALUES (
          '${contactId}', 
          ${moment().format('X')}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
          '${listId}',
          ${moment().format('X')}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
          '${userId}'
        )
        ON CONFLICT DO NOTHING
        ;
      `;

    }

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting list records';
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
    
    console.log(nowRunning + ": finished\n");
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

router.post("/delete", async (req, res) => { 

  const nowRunning = "/lists/delete";
  console.log(`${nowRunning}: running`);

  const errorNumber = 51;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      listId: Joi.string().required().uuid(),
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
      apiTesting,
      listId,
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
      DELETE FROM 
        lists 
      WHERE 
        list_id = '${listId}' 
      AND 
        locked <= ${userLevel} 
      RETURNING 
        *
      ;
    `;
    let results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when deleting list record';
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

      const failure = 'attempt to delete a mailing list was blocked';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send({ 
        failure, 
        success 
      });

    }

    const listName = stringCleaner(results.rows[0].list_name);

    // cleanup

    queryText = `
      DELETE FROM 
        list_contacts 
      WHERE 
        list_id = '${listId}'
      ; 
      DELETE FROM 
        events 
      WHERE 
        event_target = '${listId}'
      ;
    `;
    results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when cleaning up after list deletion';
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

    const eventDetails = `Mailing list <b>${listName}</b> was deleted.`
    await recordEvent ({ 
      apiTesting, 
      event: 11, 
      eventDetails, 
      eventTarget: userId, 
      userId 
    });

    console.log(nowRunning + ": finished\n");
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

router.post("/load", async (req, res) => { 

  const nowRunning = "/lists/load";
  console.log(`${nowRunning}: running`);

  const errorNumber = 26;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      listId: Joi.string().required().uuid(),
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
      listId,
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
        l.*, 
        u.user_name 
      FROM 
        lists l
      JOIN 
        users u 
      ON 
        l.updated_by = u.user_id 
      WHERE 
        l.list_id = '${listId}'
      ;
    `;
    let results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the list metadata';
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
      
    } else if (!results.rowCount) {

      const failure = 'list ID was not found';
      return res.status(200).send({ 
        failure, 
        success 
      });

    }

    let {
      accept_contacts: acceptContacts,
      active,
      created,
      list_name: listName,
      list_notes: listNotes,
      locked,
      updated,
      updated_by: updatedBy,
      user_name: updatedBy2
    } = results.rows[0];

    // now get contacts on this list

    const linkedContacts = {};

    queryText = `
      SELECT 
        c.* 
      FROM 
        contacts c
      JOIN 
        list_contacts lc 
      ON 
        c.contact_id = lc.contact_id 
      WHERE 
        lc.list_id = '${listId}' 
        AND c.active = true 
        AND c.block_all = false 
      ORDER BY 
        c.contact_name, 
        c.company_name, 
        c.email
      ;
    `;
    results = await db.noTransaction({ errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when getting the linked contacts';
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

    Object.values(results.rows).forEach(row=> {

      const {
        company_name: companyName,
        contact_id: contactId,
        contact_name: contactName,
        contact_notes: contactNotes,
        email,
        updated
      } = row;

      fullName = contactName;

      if (companyName) fullName += ',' + companyName;

      linkedContacts[contactId] = {
        contactNotes: stringCleaner(contactNotes, false, !containsHTML(contactNotes)),
        email,
        fullName: stringCleaner(fullName),
        updated: moment.unix(updated).format('YYYY.MM.DD')
      };

    })

    console.log(nowRunning + ": finished\n");
    return res.status(200).send({ 
      acceptContacts,
      active,
      created: +created,
      linkedContacts,
      listName: stringCleaner(listName),
      listNotes: stringCleaner(listNotes, false, !containsHTML(listNotes)),
      locked: +locked,
      success: true,
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

router.post("/new", async (req, res) => { 

  const nowRunning = "/lists/new";
  console.log(`${nowRunning}: running`);

  const errorNumber = 23;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      apiTesting: Joi.boolean().optional(),
      listName: Joi.string().required(),
      listNotes: Joi.string().optional().allow('', null),
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
      apiTesting,
      listName,
      listNotes,
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

    const listId = uuidv4();
    listName = stringCleaner(listName, true);
    listNotes ? listNotes = stringCleaner(listNotes, true) : listNotes = '';
    const now = moment().format('X');

    const queryText = `
      INSERT INTO 
        lists(
          created, 
          list_id, 
          list_name, 
          list_notes, 
          locked, 
          updated, 
          updated_by
        ) 
      VALUES (
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        '${listId}', 
        '${stringCleaner(listName, true)}', 
        '${stringCleaner(listNotes, true)}', 
        0, 
        ${now}, -- ${moment().format('YYYY-MM-DD HH:mm:ss')}
        '${userId}'
      ) 
      ON CONFLICT DO NOTHING 
      RETURNING 
        list_id
      ;
    `;

    const results = await db.transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId });

    if (!results) {

      const failure = 'database error when creating a new list record';
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
    
    console.log(nowRunning + ": finished\n");
    return res.status(200).send({ 
      listId, 
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

  const nowRunning = "/lists/update";
  console.log(`${nowRunning}: running`);

  const errorNumber = 24;

  try {

    if (req.body.masterKey != API_ACCESS_TOKEN) {

      console.log(`${nowRunning}: bad token\n`);
      return res.status(403).send('unauthorized');

    }

    const schema = Joi.object({
      acceptContacts: Joi.boolean().optional(),
      active: Joi.boolean().optional(),
      apiTesting: Joi.boolean().optional(),
      listId: Joi.string().required().uuid(),
      listName: Joi.string().required(),
      listNotes: Joi.string().optional().allow('', null),
      locked: Joi.boolean().optional().allow('', null),
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
      acceptContacts,
      active,
      apiTesting,
      listId,
      listName,
      listNotes,
      locked,
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
      UPDATE 
        lists 
      SET 
        list_name = '${stringCleaner(listName, true)}', 
        list_notes = '${listNotes ? stringCleaner(listNotes, true) : ''}', 
        updated = ${moment().format('X')}, 
        updated_by = '${userId}'
        ${acceptContacts && typeof acceptContacts === 'boolean' ? `, accept_contacts = ${acceptContacts}` : ''} 
        ${active && typeof active === 'boolean' ? `, active = ${active}` : ''} 
        ${
          locked && locked === true 
            ? `, locked = ${userLevel}` 
            : locked === false 
              ? `, locked = 0` 
              : `, locked = locked`
        } 
      WHERE 
        list_id = '${listId}' 
        AND locked <= ${userLevel} 
      RETURNING 
        list_id
      ;
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
      
    } else if (results.rowCount === 0) {

      const failure = 'attempt to create a duplicate contact name/email pair was blocked';
      console.log(`${nowRunning}: ${failure}`);
      return res.status(200).send({ 
        failure, 
        success 
      });

    }
    
    console.log(nowRunning + ": finished\n");
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
console.log('lists services loaded successfully!');