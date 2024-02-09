import { jwtDecode } from "jwt-decode";
import {
  includes,
  replace,
  toLower
} from 'lodash';
import ErrorModal from '../components/common/ErrorModal';
import http from "./http";
// import jwtDecode from 'jwt-decode';

const masterKey = process.env.REACT_APP_API_KEY;

// userId is needed for every API route that does level checking, so we get it here rather than check every function call to handler.js
// However, there won't be a JWT available before login, so jwtDecode is conditional here.

let userId;

const jwt = localStorage.getItem( "docr.token" );

if ( jwt ) {
  
  const { userRecord } = jwtDecode( jwt );
  userId = userRecord.user_id;
}

if ( !userId ) localStorage.removeItem( "docr.token" ); // remove the session record so we can force the user to log in again

export async function apiLoader({ api, payload}) {
  
  let server = process.env.REACT_APP_API + '/';
  payload = {
    ...payload,
    masterKey: process.env.REACT_APP_API_KEY,
    userId
  }
  const result = await http.post( server + api, payload );
  return result;

}

// changes the window/tab title

export function changeTitle( newTitle ) {

  if ( newTitle ) window.document.title = newTitle;

}

// check if values contains the supplied string (c/o ChatGPT)

export function containsCaseInsensitive( searchString, value ) {

  // Convert both the value and searchString to lowercase

  const lowerValue = toLower(value);
  const lowerSearchString = toLower(searchString);

  // Check if lowerValue contains lowerSearchString

  return includes(lowerValue, lowerSearchString);

}

// detects the presence of HTML tags in the content

export function containsHTML ( string ) { // c/o ChatGPT 3.5

  const htmlRegex = /<[^>]+>/g;
  return htmlRegex.test(string);

}

// display an error modal

export function errorDisplay ( props ) {

  let {
    context,
    details,
    error,
    errorMessage,
    errorNumber,
    level,
    reportError
  } = props;

  if ( reportError === true ) { 

    if ( error?.message ) details = error.message;  // this is only going to be present on exceptions thrown

    errorHandler({ context, details, errorMessage: error, errorNumber });

  }

  if ( +level === 9 && error ) console.log( error );

  return ( 

    <ErrorModal
      errorMessage={errorMessage}
      errorNumber={errorNumber}
    />

  )

}

// report errors to the Simplexable API

export async function errorHandler( errorPayload ) {

  try {
    
    const api = 'utilities/log-error';
    const payload = { ...errorPayload };

    if ( !payload.userId ) payload.userId = masterKey; // this should only happen in login situations

    await apiLoader( api, payload );

    return true;

  } catch( e ) {

    console.log( 'errorHandler: ', e )
    return e.trace;
    
  }

}

// string sanitization

export function stringCleaner({ string, nl2br }) {

  string = replace( replace( string, /""/g, '"' ) ).trim();

  if ( nl2br ) string = replace( string, /\n/g, '<br />' );

  return string;

}

export function validateUUID( str ) {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

  return regexExp.test(str);

}