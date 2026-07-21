import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../auth/tokenStorage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3001').replace(
  /\/$/,
  '',
);

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/** Register a logout / session-clear callback for HTTP 401 responses. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await tokenStorage.clear();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export function getApiBaseUrl() {
  return API_URL;
}
