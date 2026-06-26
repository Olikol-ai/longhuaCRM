const TOKEN_KEY = 'longhua_access_token';

export const appParams = {
  appId: 'longhua-crm',
  token: typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null,
  appBaseUrl: '',
  functionsVersion: '1',
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
};
