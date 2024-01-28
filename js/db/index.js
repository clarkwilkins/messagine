const { Pool } = require( 'pg' );
const { recordError } = require( '../functions.js' );
const fs = require ( 'fs' );
const moment = require ( 'moment' );
const { split, startsWith } = require ( 'lodash' );

const pool = new Pool(); // initializing a connection pool for the route that calls this

async function query( query, apiTesting ) {

  const client = await pool.connect();

  try {

    await client.query( "BEGIN " );
    const result = await client.query( query );
    apiTesting ? await client.query( "ROLLBACK " ) : await client.query( "COMMIT " );
    return result;

 } catch ( e ) {

    await client.query( "ROLLBACK " ); // rollback before throwing exception
    recordError( query, 3 )

 } finally {

    client.release();

    if ( !apiTesting ) {

      let statements = split( query, ';' );
      let logStatements = '';
      statements.map( theStatement => { 

        theStatement = theStatement.trim();
        startsWith( theStatement, 'DELETE' ) ? logStatements += theStatement + ";\n" : null;
        startsWith( theStatement, 'INSERT' ) ? logStatements += theStatement + ";\n" : null;
        startsWith( theStatement, 'UPDATE' ) ? logStatements += theStatement + ";\n" : null;

     } );

      let logfile = process.env.UNITI_LOGS + moment().format( "YYYY.MM.DD" );

      if ( logStatements ) {

        logStatements = "\n/* " + moment().format( "HH.mm.ss" ) + " */\n" + logStatements;

        (async () => {

          const fsp = require( 'fs' ).promises;
          await fsp.appendFile( logfile, logStatements );
          
       })();

     }
      
   }

 }

}

async function noTransaction( query, errorNumber, nowRunning, userId ) {

  const client = await pool.connect();

  try {

    const result = await client.query( query );
    return result;

 } catch ( e ) {

    console.log( 'database error: ' + e.message )
    recordError( {
      context: `api: ${nowRunning}`,
      details: query,
      errorMessage: `error: ${e.message}`,      
      errorNumber,
      userId
    } );
    return {}

 } finally {

    client.release();

 }

}

async function transactionRequired( query, errorNumber, nowRunning, userId, apiTesting ) {

  const client = await pool.connect();

  try {

    await client.query( "BEGIN " );
    const result = await client.query( query );
    apiTesting ? await client.query( "ROLLBACK " ) : await client.query( "COMMIT " );
    return result;

 } catch ( e ) {

    await client.query( "ROLLBACK " ); // rollback before throwing exception
    recordError( {
      context: `api: ${nowRunning}`,
      details: query,
      errorMessage: `error: ${e.message}`,      
      errorNumber,
      userId
   } );
    return {};

 } finally {

    client.release();

    if ( !apiTesting ) {

      let statements = split( query, ';' );
      let logStatements = '';
      statements.map( theStatement => { 

        theStatement = theStatement.trim();
        startsWith( theStatement, 'DELETE' ) ? logStatements += theStatement + ";\n" : null;
        startsWith( theStatement, 'INSERT' ) ? logStatements += theStatement + ";\n" : null;
        startsWith( theStatement, 'UPDATE' ) ? logStatements += theStatement + ";\n" : null;

     } );

      let logfile = process.env.MESSAGINE_LOGS + moment().format( "YYYY.MM.DD" );

      if ( logStatements ) {

        logStatements = "\n/* " + moment().format( "HH.mm.ss" ) + " */\n" + logStatements;

        (async () => {

          const fsp = require( 'fs' ).promises;
          await fsp.appendFile( logfile, logStatements );
          
       })();

     }
      
   }

 }

}

module.exports = {
  query,
  noTransaction,
  transactionRequired
}