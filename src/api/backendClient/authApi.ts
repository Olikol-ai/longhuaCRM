import { apiRequest } from './httpClient';
import type { AuthResponse, LoginPayload } from './types';

export const authApi = {
  login: (payload: LoginPayload): Promise<AuthResponse> =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    }),

  refresh: (): Promise<AuthResponse> =>
    apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
    }),

  logout: (): Promise<void> =>
    apiRequest<void>('/auth/logout', {
      method: 'POST',
    }),

  logoutAll: (accessToken: string): Promise<void> =>
    apiRequest<void>('/auth/logout-all', {
      method: 'POST',
      accessToken,
    }),
};
