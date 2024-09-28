import { useCallback } from 'react';

const useLoadingMessages = (setLoadingMessages) => {

  // Function to safely add a message.
  const addLoadingMessage = useCallback((loadingMessage) => {
    setLoadingMessages((prevMessages) => {
      const safePrevMessages = Array.isArray(prevMessages) ? prevMessages : [];
      
      // Use Set to ensure uniqueness
      const updatedMessages = new Set([...safePrevMessages, loadingMessage]);
      
      return Array.from(updatedMessages);  // Convert Set back to an array
    });
  }, [setLoadingMessages]);

  // Function to safely remove a message.
  const removeLoadingMessage = useCallback((loadingMessage) => {
    setLoadingMessages((prevMessages) => {
      const safePrevMessages = Array.isArray(prevMessages) ? prevMessages : [];
      return safePrevMessages.filter(msg => msg !== loadingMessage);
    });
  }, [setLoadingMessages]);

  return { 
    addLoadingMessage, 
    removeLoadingMessage 
  };
};

export default useLoadingMessages;