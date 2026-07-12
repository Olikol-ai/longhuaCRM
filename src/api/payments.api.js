import { createDomainClient } from './domain-client';

const paymentsClient = createDomainClient('/payments');
const shopItems = createDomainClient('/payments/shop-items', {
  listPath: '/payments/shop-items',
  filterPath: '/payments/shop-items/filter',
});

export const payments = {
  ...paymentsClient,
  shopItems,
};
