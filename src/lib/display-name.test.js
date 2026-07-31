import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatHelloGreeting,
  formatWelcomeGreeting,
  getGreetingName,
} from './display-name.js';

describe('getGreetingName', () => {
  it('prefers firstName over lastName and full_name', () => {
    assert.equal(
      getGreetingName({
        first_name: 'Иван',
        last_name: 'Иванов',
        full_name: 'Иванов Иван',
        name: 'Иванов Иван',
      }),
      'Иван',
    );
  });

  it('uses camelCase firstName', () => {
    assert.equal(getGreetingName({ firstName: 'Анна', lastName: 'Петрова' }), 'Анна');
  });

  it('falls back to displayName when firstName is missing', () => {
    assert.equal(
      getGreetingName({
        last_name: 'Иванов',
        full_name: 'Иванов',
        display_name: 'Китайский клуб',
      }),
      'Китайский клуб',
    );
    assert.equal(
      getGreetingName({ displayName: 'Репетитор Иван' }),
      'Репетитор Иван',
    );
  });

  it('returns empty when only lastName / full_name with surname are present', () => {
    assert.equal(getGreetingName({ last_name: 'Иванов', full_name: 'Иванов' }), '');
    assert.equal(getGreetingName({ lastName: 'Иванов', name: 'Иванов Иван' }), '');
    assert.equal(getGreetingName(null), '');
    assert.equal(getGreetingName({}), '');
  });
});

describe('formatHelloGreeting / formatWelcomeGreeting', () => {
  it('includes first name', () => {
    assert.equal(formatHelloGreeting({ first_name: 'Иван', last_name: 'Иванов' }), 'Здравствуйте, Иван!');
    assert.equal(
      formatWelcomeGreeting({ firstName: 'Иван', lastName: 'Иванов' }),
      'Добро пожаловать, Иван!',
    );
  });

  it('uses displayName when first name is absent', () => {
    assert.equal(
      formatHelloGreeting({ display_name: 'Наставник' }),
      'Здравствуйте, Наставник!',
    );
  });

  it('uses neutral greeting when no first name or displayName', () => {
    assert.equal(formatHelloGreeting({ last_name: 'Иванов', full_name: 'Иванов' }), 'Здравствуйте!');
    assert.equal(formatWelcomeGreeting({}), 'Добро пожаловать!');
  });
});
