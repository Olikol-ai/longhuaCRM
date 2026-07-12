import { createDomainClient } from './domain-client';

const lessonsClient = createDomainClient('/lessons');
const attendance = createDomainClient('/lessons/attendance', {
  listPath: '/lessons/attendance',
  filterPath: '/lessons/attendance/filter',
});

export const lessons = {
  ...lessonsClient,
  attendance,
};
