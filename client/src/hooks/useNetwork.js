import { useContext } from 'react';
import { NetworkContext } from '../contexts/NetworkContext';

export function useNetwork() {
  return useContext(NetworkContext);
}