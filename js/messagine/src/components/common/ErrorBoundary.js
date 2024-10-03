import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ErrorModal from './ErrorModal';
import axios from 'axios';

const ErrorBoundary = ({ 
  children, 
  defaultError, 
  errorNumber 
}) => {

  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {

    if (hasError) {
      console.log('Error captured in boundary:', errorInfo);
    }

  }, [hasError, errorInfo]);

  // Internal function to handle exceptions and failures.

  const handleCaughtError = async ({ 
    details, 
    error, 
    failure, 
    nowRunning, 
    userId 
  }) => {

    console.log('Error caught:', { details, error, failure, nowRunning, userId });

    const recordError = async (data) => {
      try {
        const {
          REACT_APP_SIMPLEXABLE_API: host,
          REACT_APP_SIMPLEXABLE_API_TOKEN: masterKey,
          REACT_APP_SIMPLEXABLE_PLATFORM: platform
        } = process.env;

        await axios.post(
          `${host}/errors/record`,
          { ...data, masterKey, platform },
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (e) {

        console.log('Error recording:', e.message);

      }

    };

    // Handle network errors separately.

    if (error && error.networkError) {

      const networkErrorMessage = 'A network error occurred. Either the API server is down, or an invalid route was requested';
      await recordError({
        context: `${nowRunning}.network`,
        details: details || networkErrorMessage,
        errorMessage: networkErrorMessage,
        errorNumber,
        userId
      });
      setHasError(true);
      setErrorInfo({
        errorMessage: networkErrorMessage,
        stack: '',  // No stack trace for network errors
      });

      return; // Exit early for network errors

    }

    // Handling other exceptions.

    let errorMessage = 'An unexpected error occurred';
    let errorLocation = '';
    let stackLines = [];

    if (error) {

      if (typeof error === 'string') { // Use error directly if it's a string.

        errorMessage = error;

      } else if (error.message) { // Use the error message from the error object.

        errorMessage = error.message;

      } else if (error.stack) { // Parse the stack trace.

        stackLines = error.stack.split('\n');
        errorMessage = stackLines[0] || 'Error message unavailable';
        errorLocation = stackLines.find(line => typeof line === 'string' && line.includes('messagine')) || '';

      }

    }

    if (failure) { errorMessage = failure; }

    // Conditionally include the error location if available'
    
    const fullErrorMessage = errorLocation
      ? `${errorMessage} at ${errorLocation}`
      : errorMessage; // Only append "at location" if location exists

    await recordError({
      context: `${nowRunning}.e`,
      details: details || `Error occurred. Stack trace: ${stackLines.join('\n')}`,
      errorMessage: fullErrorMessage,
      errorNumber,
      userId
    });
    setHasError(true);
    setErrorInfo({
      errorMessage: fullErrorMessage,
      stack: stackLines.join('\n'),
    });
  };

  // Expose handleError to children via props.

  const handleError = (errorPayload) => {  handleCaughtError(errorPayload); };

  // Reset the error state if needed.

  const resetError = () => {
    setHasError(false);
    setErrorInfo(null);
  };

  // If an error has occurred, display the error modal.
  if (hasError) {

    return (
      <ErrorModal
        errorMessage={errorInfo?.errorMessage || defaultError}
        errorNumber={errorNumber}
        onRetry={resetError}
      />
    );

  }

  // Clone children and pass handleError as a prop.

  return React.cloneElement(children, { handleError });

};

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  context: PropTypes.string,
  errorNumber: PropTypes.number,
  defaultError: PropTypes.string,
};

export default ErrorBoundary;