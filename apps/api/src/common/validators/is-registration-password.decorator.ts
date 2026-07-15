import { registerDecorator, ValidationOptions } from 'class-validator';
import { getRegistrationPasswordError } from '../security/password-validation';

const FALLBACK =
  'Пароль должен содержать хотя бы одну латинскую букву и одну цифру.';

/**
 * DTO-level password policy — delegates to getRegistrationPasswordError()
 * (same rules as AuthService / PendingRegistrationService).
 */
export function IsRegistrationPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          return getRegistrationPasswordError(value) === null;
        },
        defaultMessage(args) {
          const value = typeof args?.value === 'string' ? args.value : '';
          return getRegistrationPasswordError(value) ?? FALLBACK;
        },
      },
    });
  };
}
