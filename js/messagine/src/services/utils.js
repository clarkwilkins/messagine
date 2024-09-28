import {
  includes,
  replace,
  toLower
} from 'lodash';


// Changes the window/tab title.

export function changeTitle( newTitle ) {

  if ( newTitle ) window.document.title = newTitle;

}

// Check if values contains the supplied string.

export function containsCaseInsensitive( searchString, value ) {

  // Convert both the value and searchString to lowercase.

  const lowerValue = toLower(value);
  const lowerSearchString = toLower(searchString);

  // Check if lowerValue contains lowerSearchString.

  return includes(lowerValue, lowerSearchString);

}

// detects the presence of HTML tags in the content.

export function containsHTML ( string ) { 

  const htmlRegex = /<[^>]+>/g;
  return htmlRegex.test(string);

}

// Remove duplicates in an array.

export function distinctArray(array) {

  if (!array) return ([]);

  return [...new Set(array)];

}

// String sanitization.

export function stringCleaner(string, nl2br) {

  string = replace( replace( string, /""/g, '"' ) ).trim();

  if ( nl2br ) string = replace( string, /\n/g, '<br />' );

  return string;

}

// Validate the UUID.

export function validateUUID( str ) {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

  return regexExp.test(str);

}