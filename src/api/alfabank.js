import { apiFetch } from './http';

export const alfabank = {
  requestOfflinePayment(payload) {
    return apiFetch('/alfabank/offline-payment-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
