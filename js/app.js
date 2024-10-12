const express = require( 'express' );
const app = express();
const fs = require('fs');
const https = require('https');
require( "dotenv" ).config({ path: __dirname + "/.env" });

const {
  SSL_API_PORT: port,
  SSL_CERT: sslCertificate,
  SSL_KEY: sslKey
} = process.env;

const cert = fs.readFileSync( sslCertificate );
const key = fs.readFileSync( sslKey );

const campaigns = require( "./routes/campaigns" );
const contacts = require( "./routes/contacts" );
const email = require( "./routes/email" );
const lists = require( "./routes/lists" );
const scheduler = require( "./routes/scheduler" );
const templates = require( "./routes/templates" );
const users = require( "./routes/users" );
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

app.use( "/campaigns", campaigns ); // campaign services
app.use( "/contacts", contacts ); // contact services
app.use( "/email", email ); // email services
app.use( "/lists", lists ); // list services
app.use( "/scheduler", scheduler ); // scheduler services
app.use( "/templates", templates ); // message template services
app.use( "/users", users ); // user services
app.use( "/utilities", utilities ); // utility services

const httpsServer = https.createServer(
  {
    key,
    cert
 },
  app
);
httpsServer.listen( port, () => {
  console.log( 'Messagine 3.x server running SSL on port ' + port );
});