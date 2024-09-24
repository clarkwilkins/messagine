
// Global error handler for all functions and routes.

const request = require('request');

// Function to record the error in the Simplexable API.

const recordError = async data => { // data should be { context, details, errorMessage, errorNumber, userId }

  try {

    const {
      SIMPLEXABLE_API: host,
      SIMPLEXABLE_API_TOKEN: masterKey,
      SIMPLEXABLE_PLATFORM: platform
    } = process.env;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // avoids having node crash when we make the request

    request.post(
      {
        url: host + '/errors/record',
        json: {
          ...data,
          masterKey,
          platform,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  } catch(e) {

    console.log ('handleError.recordError failed with an exception:', e)

  }

}

async function handleError({ 
  details,
  error, 
  failure, // specific failures (database, validation, etc.)
  nowRunning, 
  errorNumber, 
  userId
}) {

  if (error) { // Handling exceptions.

    // Split the error stack into individual lines.

    const stackLines = error.stack ? error.stack.split('\n') : ['no message found'];

    // Main error message (usually the first line).

    const errorMessage = stackLines[0];  // The first line typically contains the main error type and message
    
    // Scan stack lines to find the first occurrence of a specific project keyword ("messagine" in this case).

    const findErrorLocation = (stack) => {

      return stack.find(line => line.includes('messagine')) || 'No specific error location found';

    };

    // Get the error location by scanning the stack lines.

    let errorLocation = findErrorLocation(stackLines);
    errorLocation = errorLocation.replace(/\bat\s+/, '').trim();  // Remove the first instance of "at " with optional whitespace

    console.log('errorLocation:', errorLocation);
    console.log(stackLines)

    // Record the error for logging/tracking purposes

    await recordError({
      context: `${nowRunning}.e`,
      details: `Error occurred at <b>${errorLocation.trim()}</b>.<br/>Stack trace: <pre>${stackLines.join('<br/>')}</pre>`,
      errorMessage: errorMessage,
      errorNumber,
      userId
    });

    // Return the failure response or object to exit the route or function

    return { 
      failure: `${errorMessage} at ${errorLocation}`,
      success: false 
    }; 

  } else if (failure) { // Handling failures.

    // Record the failure for logging/tracking purposes

    await recordError({
      context: `${nowRunning}.f`,
      details,
      errorMessage: failure,
      errorNumber,
      userId
    });

    // Log the failure for visibility.

    console.log(`${nowRunning}: failed, message: ${failure}`);

    // Return the failure response or object to exit the route or function

    return { 
      failure,
      success: false 
    }; 

  }

}

module.exports = handleError;
