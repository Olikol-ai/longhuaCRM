import { apiFetch, getToken, setToken } from './http';

function flattenAuthResult(result) {
  if (result.token) setToken(result.token);
  const { token: _token, user: profile, ...rest } = result;
  return { ...(profile ?? {}), ...rest };
}

export const auth = {
  async me() {
    if (!getToken()) {
      const err = new Error('Not authenticated');
      err.status = 401;
      throw err;
    }
    const result = await apiFetch('/auth/me');
    return flattenAuthResult(result);
  },
  async updateMe(data) {
    const result = await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(data) });
    return flattenAuthResult(result);
  },
  logout() {
    setToken(null);
    sessionStorage.removeItem('longhua_pending_registration_email');
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
    return flattenAuthResult(result);
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
    return result;
  },
  async verifyRegistration(email, code) {
    const result = await apiFetch('/auth/verify-registration', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    return flattenAuthResult(result);
  },
  async resendRegistrationCode(email) {
    return apiFetch('/auth/resend-registration-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  /** @deprecated Legacy flow */
  async verifyCode(code) {
    const result = await apiFetch('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    return flattenAuthResult(result);
  },
  /** @deprecated Legacy flow */
  async resendCode() {
    return apiFetch('/auth/resend-code', { method: 'POST' });
  },
  async forgotPassword(email) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(token, password, confirmPassword) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token,
        password,
        confirm_password: confirmPassword,
      }),
    });
  },
};
