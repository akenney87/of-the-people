import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create the context
const NetworkContext = createContext({
  isOnline: true,
  hasConnectivity: true
});

// Define the provider component
function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasConnectivity, setHasConnectivity] = useState(true);
  
  useEffect(() => {
    // Update online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check actual connectivity by pinging your API
    const checkConnectivity = async () => {
      try {
        // Simple HEAD request to check connectivity
        await fetch('/api-health-check', { method: 'HEAD' });
        setHasConnectivity(true);
      } catch (error) {
        setHasConnectivity(false);
      }
    };
    
    // Check connectivity periodically
    const intervalId = setInterval(checkConnectivity, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, []);
  
  return (
    <NetworkContext.Provider value={{ isOnline, hasConnectivity }}>
      {children}
    </NetworkContext.Provider>
  );
}

// Add prop validation
NetworkProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Define the hook
function useNetwork() {
  return useContext(NetworkContext);
}

// Export as a named export instead of default export
export { NetworkProvider, useNetwork };