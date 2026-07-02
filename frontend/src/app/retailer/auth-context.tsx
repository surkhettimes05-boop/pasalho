'use client';

import { createContext, useContext } from 'react';
import { RetailerProfile } from '@/lib/api/retailer-portal';

export interface RetailerAuthContextType {
  profile: RetailerProfile | null;
  token: string | null;
  setAuth: (token: string, profile: RetailerProfile) => void;
  clearAuth: () => void;
}

export const RetailerAuthContext = createContext<RetailerAuthContextType>({
  profile: null,
  token: null,
  setAuth: () => {},
  clearAuth: () => {},
});

export const useRetailerAuth = () => useContext(RetailerAuthContext);
