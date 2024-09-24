const { Pool } = require( 'pg' );
const fs = require ( 'fs' );
const moment = require ( 'moment' );
const { split, startsWith } = require ( 'lodash' );

const pool = new Pool(); // initializing a connection pool for the route that calls this module

async function noTransaction({ errorNumber, nowRunning, queryText, userId }) {

  const client = await pool.connect();

  try {

    const result = await client.query(queryText);
    return result;

  } catch ( e ) {

    console.error( e );

  } finally {

      client.release();

  }

}

async function transactionRequired({ apiTesting, errorNumber, nowRunning, queryText, userId }) {

  const client = await pool.connect();

  try {

    await client.query( "BEGIN " );
    const result = await client.query( queryText );
    apiTesting ? await client.query( "ROLLBACK " ) : await client.query( "COMMIT " );
    return result;

  } catch ( e ) {

    console.error( e );

  } finally {

    client.release();

    if ( !apiTesting ) {

      let statements = split( queryText, ';' );
      let logStatements = '';
      statements.map( theStatement => { 

        theStatement = theStatement.trim();

        if (['DELETE', 'INSERT', 'UPDATE'].some(cmd => startsWith(theStatement, cmd))) {

          logStatements += theStatement + ";\n";

        }

      });

      let logfile = process.env.MESSAGINE_LOGS + moment().format( "YYYY.MM.DD" );

      if ( logStatements ) {

        logStatements = "\n/* " + moment().format( "HH.mm.ss" ) + " */\n" + logStatements;

        (async () => {

          try {

            const fsp = require( 'fs' ).promises;
            await fsp.appendFile( logfile, logStatements );

          } catch (err) {

            console.error('Logging failed: ', err);

          }

        })();

      }
      
    }

  }

}

module.exports = {
  noTransaction,
  transactionRequired
}