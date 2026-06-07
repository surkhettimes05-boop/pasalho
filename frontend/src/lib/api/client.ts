import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const TOKEN_KEY = process.env.NEXT_PUBLIC_JWT_TOKEN_KEY || 'pasalo_token';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: unwrap {success, data} envelope and handle 401
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      // Avoid infinite loop if already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
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
