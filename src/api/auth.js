import { apiFetch, getToken, setToken } from './http';

export const auth = {
  async me() {
    if (!getToken()) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const result = await apiFetch('/auth/me');
    if (result.token) setToken(result.token);
    const { token: _token, ...user } = result;
    return user;
  },
  async updateMe(data) {
    const result = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(data) });
    if (result.token) setToken(result.token);
    const { token: _token, ...user } = result;
    return user;
  },
  logout() {
    setToken(null);
    window.location.href = '/login';
  },
  redirectToLogin(redirectUrl) {
    const returnUrl = redirectUrl || window.location.href;
    window.location.href = `/login?from_url=${encodeURIComponent(returnUrl)}`;
  },
  async login(email, password) {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    return result.user;
  },
  async register(email, password, firstName, lastName) {
    const result = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });
    setToken(result.token);
    return result.user;
  },
};
