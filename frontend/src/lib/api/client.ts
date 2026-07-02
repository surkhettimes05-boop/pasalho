import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TOKEN_KEY = process.env.NEXT_PUBLIC_JWT_TOKEN_KEY || 'pasalo_token';
const REFRESH_TOKEN_KEY = 'pasalo_refresh_token';

// Track in-flight refresh to avoid multiple simultaneous refreshes
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

import { handleMockRequest } from './demo-mock-data';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  adapter: IS_DEMO ? (handleMockRequest as any) : undefined,
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: unwrap {success, data} envelope, handle 401 with silent refresh
api.interceptors.response.use(
  (response) => {
    const { data } = response.data;
    return data;
  },
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    // If 401, try to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        originalRequest._retry = true;

        try {
          // If a refresh is already in flight, wait for it
          if (isRefreshing) {
            const newToken = await new Promise<string>((resolve, reject) => {
              refreshQueue.push({ resolve, reject });
            });
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api.request(originalRequest);
          }

          isRefreshing = true;

          try {
            // Call refresh endpoint directly (no auth header needed — uses body)
            const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            const body = res.data;
            // Handle both NestJS envelope {success, data} and bare response
            const payload = body.data || body;
            const { accessToken, refreshToken: newRefreshToken } = payload;

            setTokens(accessToken, newRefreshToken);

            // Resolve all queued requests
            for (const q of refreshQueue) {
              q.resolve(accessToken);
            }
            refreshQueue = [];

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api.request(originalRequest);
          } catch (refreshError) {
            // Refresh failed — reject queued requests and redirect to login
            for (const q of refreshQueue) {
              q.reject(new Error('Session expired'));
            }
            refreshQueue = [];
            clearTokens();
            if (!window.location.pathname.startsWith('/login')) {
              window.location.href = '/login';
            }
            return Promise.reject(new Error('Session expired. Please login again.'));
          } finally {
            isRefreshing = false;
          }
        } catch (e) {
          return Promise.reject(e);
        }
      }

      // No refresh token — clear and redirect
      clearTokens();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Session expired'));
    }

    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'Network error';
    return Promise.reject(new Error(message));
  },
);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;