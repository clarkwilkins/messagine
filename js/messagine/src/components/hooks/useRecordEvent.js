import { useCallback } from 'react';
import apiLoader from '../../services/apiLoader'; // Adjust this path based on your project structure

const useRecordEvent = () => {

  const recordEvent = useCallback(async ({ 
    apiTesting, 
    eventDetails, 
    eventNumber, 
    eventTarget 
  }) => {

    try {
      const api = 'utilities/record-event';
      const payload = { apiTesting, eventDetails, eventNumber, eventTarget };
      const { data } = await apiLoader({ api, payload });

      return {
        success: data.success,
        failure: data.failure,
      };
    } catch (error) {
      console.error('Error recording event:', error);
      return { success: false, failure: error.message };
    }
  }, []);

  return { recordEvent };
};

export default useRecordEvent;