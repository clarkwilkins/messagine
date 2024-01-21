const express = require( 'express' );
const app = express();
const fs = require('fs');
const https = require('https');
require( "dotenv" ).config( { path: __dirname + "/.env" } );

const {
  SSL_API_PORT: port,
  SSL_CERT: sslCertificate,
  SSL_KEY: sslKey
} = process.env;

const cert = fs.readFileSync( sslCertificate );
const key = fs.readFileSync( sslKey );

const utilities = require( "./routes/utilities" );

app.use(function ( req, res, next ) {
  res.header( "Access-Control-Allow-Origin", "*" ); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header( "Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS" );
  next();
});

app.use( "/utilities", utilities ); // utility services

const httpsServer = https.createServer(
  {
    key,
    cert
 },
  app
);
httpsServer.listen( port, () => {
  console.log( 'Messageine 3.x server running SSL on port ' + port );
});