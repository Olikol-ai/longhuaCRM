import { apiFetch } from './http';
import { createDomainClient, recordToEntityPayload } from './domain-client';

export const groups = {
  ...createDomainClient('/groups'),
  create(data) {
    const payload = recordToEntityPayload(data);
    if (!payload.teacherId) {
      delete payload.teacherId;
    }
    return apiFetch('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  workspace(groupId) {
    return apiFetch(`/groups/${groupId}/workspace`);
  },
  members(groupId) {
    return apiFetch(`/groups/${groupId}/members`);
  },
  addMember(groupId, studentId) {
    return apiFetch(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
  },
  removeMember(groupId, memberId) {
    return apiFetch(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
  },
};
