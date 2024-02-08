import { 
  Container,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { jwtDecode } from "jwt-decode";
import {
  ChatCircleDots
} from '@phosphor-icons/react';
import { toast } from 'react-toastify';
import {
  includes,
  replace,
  toLower
} from 'lodash';
import ErrorModal from '../components/common/ErrorModal';
import http from "./http";
import InfoAlert from '../components/common/InfoAlert';
// import jwtDecode from 'jwt-decode';

const masterKey = process.env.REACT_APP_API_KEY;

// userId is needed for every API route that does level checking, so we get it here rather than check every function call to handler.js
// However, there won't be a JWT available before login, so jwtDecode is conditional here.

let level = 1;
let userId;

const jwt = localStorage.getItem( "docr.token" );

if ( jwt ) {
  
  const { userRecord } = jwtDecode( jwt );
  level = userRecord.level;
  userId = userRecord.user_id;

}

if ( !userId ) localStorage.removeItem( "docr.token" ); // remove the session record so we can force the user to log in again

export async function apiLoader( route, payload, external, global ) {
  
  let server = null;

  if ( global ) { // use the Simplexable error handler

    server = process.env.REACT_APP_SIMPLEXABLE_API + '/';

  } else {

    server = process.env.REACT_APP_API + '/';

  }

  if ( !external ) { // all Uniti requests need the current API key and the user ID

    payload = {
      ...payload,
      masterKey,
      userId
    }

  }

  const result = await http.post( server + route, payload );
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

export function displayDependencies( componentDependencies, functionDependencies, routeDependencies, followupFunction ) {

  if ( !componentDependencies ) componentDependencies = [];
  if ( !functionDependencies ) functionDependencies = [];
  if ( !routeDependencies ) routeDependencies = [];

  const count = componentDependencies?.length + functionDependencies?.length + routeDependencies?.length;

  if ( count === 0 ) return ( <InfoAlert message="there are no linked dependencies at this time." /> )

  const onClick = ( itemName, itemId ) => {
    
    followupFunction( itemId ); // this should unlink the dependency
    toast.success( 'The dependency ' + itemName + ' was removed.' );

  }

  return ( 

    <>

      <div className="size-65">linked dependencies ({count})</div>

      <Container className="mt-3 mb-3 border-gray-2 size-80">

        {componentDependencies.map( ( row, key ) => {

          const {
            componentId,
            componentPath
          } = row;

          return ( 

            <Row
              className="alternate-1 p-3 hover"
              key={key}
              onClick={ () => onClick( componentPath, componentId ) }
            >

              <div className="size-65">component</div>

              <div>{componentPath}</div>

            </Row>
          )

        })}

        {functionDependencies.map( ( row, key ) => {

          const {
            functionId,
            functionName
          } = row;

          return ( 

            <Row
              className="alternate-1 p-3 hover"
              key={key}
              onClick={ () => onClick( functionName, functionId ) }
            >

              <div className="size-65">function</div>

              <div>{functionName}</div>

            </Row>
          )

        })}

        {routeDependencies.map( ( row, key ) => {

          const {
             routeId,
             routeName
          } = row;

          return ( 

            <Row
              className="alternate-1 p-3 hover"
              key={key}
              onClick={ () => onClick( routeName, routeId ) }
            >

              <div className="size-65"> route</div>

              <div>{ routeName}</div>

            </Row>
          )

        })}

      </Container>
    
    </>
  )

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

    errorHandler( { context, details, errorMessage, errorNumber } );

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

// get comments (component, function, issue, route)

export async function getComments( payload ) {

  const nowRunning = 'handler.js:getComments()';
  const errorNumber = 40;

  try {   
    
    const api = 'comments/get';
    const { data: getComments } = await apiLoader( api, payload ); 
    const {
      comments,
      failure: getCommentsFailure,
      noComments,
      success: getCommentsSuccess
    } = getComments;
    return( {
      comments,
      getCommentsFailure,
      noComments,
      getCommentsSuccess
    });

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get component details

export async function getComponent( componentId ) {

  const nowRunning = 'handler.js:getComponent()';
  const errorNumber = 33;

  try {   
    
    const api = 'components/load';
    const payload = { componentId };
    const { data: getComponent } = await apiLoader( api, payload );
    const {
      component,
      failure: getComponentFailure,
      success: getComponentSuccess
    } = getComponent;
    return( { component, getComponentFailure, getComponentSuccess } );

  } catch( e ) {

    const details = 'Exception thrown during handler function.'; 
    return errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );

  }

}

// get all components

export async function getComponents( platform ) {

  const nowRunning = 'handler.js:getComponents()';
  const errorNumber = 25;

  try {

    if ( isNaN( platform ) ) return { allComponents: {}, componentList: {}, getComponentsSuccess: true }    
    
    const api = 'components/all';
    const payload = { platform };
    const { data: getComponents } = await apiLoader( api, payload );
    const {
      componentList, // Selector-friendly
      components: allComponents,
      failure: getComponentsFailure,
      success: getComponentsSuccess
    } = getComponents; 
    return ( { allComponents, componentList, getComponentsFailure, getComponentsSuccess } );

  } catch( e ) {

    const details = 'Exception thrown during handler function.'; 
    return errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );

  }

}

// get dependencies (current and potential)

export async function getDependencies( itemId, platform, clientSide ) {

  const nowRunning = 'handler.js:getDependencies()';
  const errorNumber = 36;

  try {   
    
    if ( +clientSide !== 1 && +clientSide !== 2 ) clientSide = 3; // 1 = GUI globals only, 2 = API globals only

    const api = 'utilities/dependencies';
    const payload = { 
      clientSide,
      itemId,
      platform
     };
    const { data: getDependencies } = await apiLoader( api, payload );
    const {
      availableComponents,
      availableFunctions,
      availableRoutes,
      componentDependencies,
      dependentIds,
      failure: getDependenciesFailure,
      functionDependencies,
      linkedGlobals,
      routeDependencies,
      success: getDependenciesSuccess
    } = getDependencies;

    return ( { 
      availableComponents,
      availableFunctions,
      availableRoutes,
      componentDependencies,
      dependentIds,
      functionDependencies,
      getDependenciesFailure,
      getDependenciesSuccess,
      linkedGlobals,
      routeDependencies
     } );

  } catch( e ) { // this is the latest version of error handling for handler functions

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get function details

export async function getFunction( functionId ) {

  const nowRunning = 'handler.js:getFunction()';
  const errorNumber = 44;

  try {   
    
    const api = 'functions/load';
    const payload = { functionId };
    const { data: getFunctionData } = await apiLoader( api, payload );
    const {
      failure: getFunctionFailure,
      success: getFunctionSuccess,
      thisFunction
    } = getFunctionData;
    return ( { 
      getFunctionFailure,
      getFunctionSuccess,
      thisFunction
     } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get all standalone functions

export async function getFunctions( platform, clientSide ) {
  
  const nowRunning = 'handler.js:getFunctions()';
  const errorNumber = 28;

  try {

    if ( +clientSide !== 1 && +clientSide !== 2 ) clientSide = 3; // 1 = GUI globals only, 2 = API globals only

    const api = 'functions/all';
    const payload = { 
      clientSide,
      platform 
    };
    const { data: getFunctions } = await apiLoader( api, payload );
    let {
      failure: getFunctionsFailure,
      functions,
      functionList, // Selector-friendly
      success: getFunctionsSuccess
    } = getFunctions;

    if ( !functionList ) functionList = [];

    const allFunctions = functions || {};
    
    return ( { allFunctions, errorNumber, functionList, getFunctionsFailure, getFunctionsSuccess } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get all global items

export async function getGlobals( platform, clientSide ) {
  
  const nowRunning = 'handler.js:getGlobals()';
  const errorNumber = 70;

  try {

    if ( +clientSide !== 1 && +clientSide !== 2 ) clientSide = 3; // 1 = GUI globals only, 2 = API globals only

    const api = 'utilities/globals/all';
    const payload = { 
      clientSide,
      platform 
    };
    const { data: getGlobals } = await apiLoader( api, payload );
    let {
      failure: getGlobalsFailure,
      globals,
      globalsList, // Selector-friendly,
      sourceList,
      success: getGlobalsSuccess
    } = getGlobals;
    
    return ( { errorNumber, getGlobalsFailure, getGlobalsSuccess, globals, globalsList, sourceList } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get an issue wit linked items and comments

export async function getIssue( issueId ) {

  const nowRunning = 'handler.js:getIssue( issueId )';
  const errorNumber = 15;

  try {

    if ( !validateUUID( issueId ) ) return { notFound: 'invalid UUID', success: true }

    const api = 'issues/load';
    const payload = { issueId };

    const { data: getIssue } = await apiLoader( api, payload );
    const {
      comments,
      connectedComponents,
      connectedFunctions,
      connectedRoutes,
      failure: getIssueFailure,
      issue,
      notFound,
      success: getIssueSuccess
    } = getIssue;
    return ( { comments, connectedComponents, connectedFunctions, connectedRoutes, getIssueFailure, getIssueSuccess, issue, notFound } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get all issues

export async function getIssues() {

  const nowRunning = 'handler.js:getIssues()';
  const errorNumber = 12;

  try {

    const api = 'issues/all';
    const payload = {};

    const { data: getIssues } = await apiLoader( api, payload );
    const {
      allIssues,
      failure: getIssuesFailure,
      success: getIssuesSuccess
    } = getIssues;
    return ( { allIssues, getIssuesFailure, getIssuesSuccess } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get all platforms

export async function getPlatforms() {

  const nowRunning = 'handler.js:getPlatforms()';
  const errorNumber = 9;

  try {

    const api = 'utilities/platforms/all';
    const payload = {};

    const { data: getPlatforms } = await apiLoader( api, payload );
    const {
      failure: getPlatformsFailure,
      platformList, // Selector-friendly
      platforms, // lookup list keyed by platformId
      success: getPlatformsSuccess
    } = getPlatforms;
    return ( { errorNumber, getPlatformsFailure, getPlatformsSuccess, platformList, platforms } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get route details

export async function getRoute( routeId ) {

  const nowRunning = 'handler.js:getRoute()';
  const errorNumber = 60;

  try {   
    
    const api = 'routes/load';
    const payload = { routeId };
    const { data: getRouteData } = await apiLoader( api, payload );
    const {
      failure: getRouteFailure,
      route,
      success: getRouteSuccess
    } = getRouteData;
    return ( { 
      getRouteFailure,
      getRouteSuccess,
      route
     } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// get all routes

export async function getRoutes( platform ) {

  const nowRunning = 'handler.js:getRoutes()';
  const errorNumber = 21;

  try {

    const api = 'routes/all';
    const payload = { platform };
    const { data: getRoutes } = await apiLoader( api, payload );

    const {
      failure: getRoutesFailure,
      routeList, // Selector-friendly
      routes: allRoutes,
      success: getRoutesSuccess
    } = getRoutes;
    return ( { allRoutes, getRoutesFailure, getRoutesSuccess, routeList } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}
// get all users

export async function getUsers() {

  const nowRunning = 'handler.js:getUsers()';
  const errorNumber = 19;

  try {

    const api = 'utilities/users/all';
    const payload = {};
    const { data: getUsers } = await apiLoader( api, payload );

    const {
      allUsers,
      failure: getUsersFailure,
      success: getUsersSuccess,
      userList
    } = getUsers;
    return ( { allUsers, getUsersFailure, getUsersSuccess, userList } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// (un)link dependencies

export async function linkDependencies( dependentId, itemId, link, globalProp ) {

  const nowRunning = 'handler.js:linkDependencies()';
  const errorNumber = 38;

  try {   
    
    const api = 'utilities/dependencies/link';
    const payload = { 
      dependentId,
      itemId, 
      link,
      globalProp
     };
    const { data: linkDependencies } = await apiLoader( api, payload );
    const {
      failure: linkDependenciesFailure,
      success: linkDependenciesSuccess
    } = linkDependencies;

    return ( { 
      linkDependenciesFailure,
      linkDependenciesSuccess
     } );

  } catch( e ) {

    if ( level === 9 ) console.log( e );

    const details = 'Exception thrown.'; 
    await errorHandler( { context: nowRunning, details, errorMessage: e.message, errorNumber } );
    return ( { errorDetails: nowRunning + ' exception: ' + e.message, errorNumber } );

  }

}

// display new comment button

export function newCommentButton( showNewComment, setShowNewComment ) {

  return (

    <div className="float-right ml-05">

      <OverlayTrigger
        delay={ {  hide: 100, show: 200 } }
        overlay={ ( props ) => ( 
          <Tooltip { ...props }>
            {showNewComment && ( <span>hide new comment tool</span> )}
            {!showNewComment && ( <span>show new comment tool</span> )}
          </Tooltip>
        )}
        placement="bottom"
      >

        <div onClick={ () => setShowNewComment( !showNewComment ) }><ChatCircleDots /></div>
        
      </OverlayTrigger>

    </div>

  );
  
}

// string sanitization

export function stringCleaner( string, toDb, nl2br ) {

  if ( !toDb ) string = replace( replace( string, /""/g, '"' ) ).trim();

  if ( toDb ) string = replace( replace( string, /"/g, '""' ), /'/g, "''" ).trim();

  if ( nl2br ) string = replace( string, /\n/g, '<br />' );

  return string;

}

// c/o https://melvingeorge.me/blog/check-if-string-valid-uuid-regex-javascript

export function validateUUID( str ) {

  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

  return regexExp.test(str);

}