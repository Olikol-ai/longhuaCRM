import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { SettingsController } from './settings.controller';

describe('SettingsController ACL', () => {
  it('welcome page read is not admin-only; writes remain admin-only', () => {
    const readRoles = Reflect.getMetadata(
      ROLES_KEY,
      SettingsController.prototype.getWelcomePage,
    );
    const writeRoles = Reflect.getMetadata(
      ROLES_KEY,
      SettingsController.prototype.saveWelcomePage,
    );
    const listRoles = Reflect.getMetadata(
      ROLES_KEY,
      SettingsController.prototype.findAll,
    );

    expect(readRoles).toBeUndefined();
    expect(writeRoles).toEqual(['admin']);
    expect(listRoles).toEqual(['admin']);
  });
});
