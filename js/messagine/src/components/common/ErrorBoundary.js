import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ErrorModal from './ErrorModal';
import axios from 'axios';

const ErrorBoundary = ({ 
  children, 
  context, 
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

  // Internal function to handle exceptions and failures
  const handleCaughtError = async ({ details, error, failure, nowRunning, userId }) => {
    console.log('Error or failure caught:', error || failure);

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

    if (error) { // Handling exceptions
      const stackLines = error.stack ? error.stack.split('\n') : ['No stack trace available'];
      const errorMessage = stackLines[0];
      const errorLocation = stackLines.find(line => line.includes('messagine')) || 'Unknown location';

      await recordError({
        context: `${nowRunning}.e`,
        details: details || `Error occurred at ${errorLocation}. Stack trace: ${stackLines.join('\n')}`,
        errorMessage,
        errorNumber,
        userId
      });

      setHasError(true);
      setErrorInfo({
        errorMessage: `${errorMessage} at ${errorLocation}`,
        stack: stackLines.join('\n'),
      });

    } else if (failure) { // Handling area-specific failures
      await recordError({
        context: `${nowRunning}.f`,
        details,
        errorMessage: failure,
        errorNumber,
        userId
      });

      console.log(`${nowRunning}: failure occurred, message: ${failure}`);

      setHasError(true);
      setErrorInfo({
        errorMessage: failure,
      });
    }
  };

  // Expose handleError to children via props
  const handleError = (errorPayload) => {
    handleCaughtError(errorPayload);
  };

  // Reset the error state if needed
  const resetError = () => {
    setHasError(false);
    setErrorInfo(null);
  };

  // If an error has occurred, display the error modal
  if (hasError) {
    return (
      <ErrorModal
        errorMessage={errorInfo?.errorMessage || defaultError}
        errorNumber={errorNumber}
        onRetry={resetError}
      />
    );
  }

  // Clone children and pass handleError as a prop
  return React.cloneElement(children, { handleError });
};

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  context: PropTypes.string,
  errorNumber: PropTypes.number,
  defaultError: PropTypes.string,
};

export default ErrorBoundary;
