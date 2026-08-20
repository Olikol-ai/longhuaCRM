import {
  assertCanUpdateMaterialFolder,
  canRenameMaterialFolder,
} from './folder-update-acl.util';

describe('folder-update-acl', () => {
  const folderOwned = { createdByUserId: 'user-1' };
  const folderOther = { createdByUserId: 'user-2' };
  const folderLegacy = { createdByUserId: null };

  describe('assertCanUpdateMaterialFolder', () => {
    it('allows admin any patch', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'admin-1', role: 'admin' },
          folderOther,
          { name: 'A', sortOrder: 2, parentId: undefined },
        ),
      ).not.toThrow();
    });

    it('allows teacher to rename own folder', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'teacher' },
          folderOwned,
          { name: 'Новое имя' },
        ),
      ).not.toThrow();
    });

    it('allows tutor to rename own folder', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'tutor' },
          folderOwned,
          { name: 'Моя папка' },
        ),
      ).not.toThrow();
    });

    it('forbids teacher renaming someone else folder', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'teacher' },
          folderOther,
          { name: 'X' },
        ),
      ).toThrow(/только свои/);
    });

    it('forbids teacher renaming legacy folder without owner', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'teacher' },
          folderLegacy,
          { name: 'X' },
        ),
      ).toThrow(/только свои/);
    });

    it('forbids teacher changing structure fields', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'teacher' },
          folderOwned,
          { name: 'X', sortOrder: 1 },
        ),
      ).toThrow(/только название/);
    });

    it('forbids student role', () => {
      expect(() =>
        assertCanUpdateMaterialFolder(
          { sub: 'user-1', role: 'student' },
          folderOwned,
          { name: 'X' },
        ),
      ).toThrow(/Недостаточно прав/);
    });
  });

  describe('canRenameMaterialFolder', () => {
    it('admin can rename any', () => {
      expect(
        canRenameMaterialFolder({ sub: 'a', role: 'admin' }, folderLegacy),
      ).toBe(true);
    });

    it('owner teacher can rename', () => {
      expect(
        canRenameMaterialFolder({ sub: 'user-1', role: 'teacher' }, folderOwned),
      ).toBe(true);
    });

    it('non-owner cannot rename', () => {
      expect(
        canRenameMaterialFolder({ sub: 'user-1', role: 'teacher' }, folderOther),
      ).toBe(false);
    });
  });
});
