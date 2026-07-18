import { apiFetch } from './http';

export const alfabank = {
  requestOfflinePayment(payload) {
    return apiFetch('/alfabank/offline-payment-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  initCardPayment(payload) {
    return apiFetch('/payments/alfa/init', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getPaymentStatus(paymentId) {
    return apiFetch(`/payments/alfa/status/${paymentId}`);
  },
};
