import { apiFetch } from './http';

export const telegram = {
  status() {
    return apiFetch('/telegram/admin/status');
  },
  createLink() {
    return apiFetch('/telegram/link/create', { method: 'POST' });
  },
  linkStatus() {
    return apiFetch('/telegram/status');
  },
  unlink() {
    return apiFetch('/telegram/unlink', { method: 'POST' });
  },
  sendTest({ targetType, targetId, message }) {
    return apiFetch('/telegram/admin/send-test', {
      method: 'POST',
      body: JSON.stringify({ targetType, targetId, message }),
    });
  },
  sendTestConfirmation({ studentId, lessonId }) {
    return apiFetch('/telegram/admin/send-test-confirmation', {
      method: 'POST',
      body: JSON.stringify({ studentId, lessonId }),
    });
  },
  checkBotInfo() {
    return apiFetch('/telegram/admin/check-bot-info', { method: 'POST' });
  },
  registerWebhook() {
    return apiFetch('/telegram/admin/register-webhook', { method: 'POST' });
  },
  fixWebhook() {
    return apiFetch('/telegram/admin/fix-webhook', { method: 'POST' });
  },
};
