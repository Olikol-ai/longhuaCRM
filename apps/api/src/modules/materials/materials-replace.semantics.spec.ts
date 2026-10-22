/**
 * Replace semantics: metadata (fileUrl) must not flip until a new upload succeeds.
 * The FE uploads first, then PATCHes; this unit test locks the service contract that
 * an update without fileUrl leaves the previous URL intact.
 */
import { MaterialsService } from './materials.service';
import { MaterialEntity } from './entities/material.entity';
import { JwtPayload } from '../auth/auth.service';

describe('MaterialsService replace semantics', () => {
  const actor: JwtPayload = {
    sub: 'admin-1',
    role: 'admin',
    email: 'admin@example.com',
  } as JwtPayload;

  function buildService(existing: MaterialEntity) {
    const repository = {
      findMaterialById: jest.fn().mockResolvedValue(existing),
      findFolderById: jest.fn(),
      updateMaterial: jest.fn(async (_id: string, patch: Partial<MaterialEntity>) => ({
        ...existing,
        ...patch,
      })),
    };
    const materialsAccess = {
      invalidateAccessCache: jest.fn(),
      scopeMaterialFilter: jest.fn(),
    };
    const materialAccessService = {
      listAccessSourcesForMaterials: jest.fn().mockResolvedValue(new Map()),
    };
    const service = new MaterialsService(
      repository as never,
      materialsAccess as never,
      materialAccessService as never,
    );
    // Bypass ACL helpers that need DB graphs.
    (service as unknown as { assertCanManageMaterial: () => void }).assertCanManageMaterial =
      () => undefined;
    (service as unknown as {
      attachCourseIds: (rows: MaterialEntity[]) => Promise<MaterialEntity[]>;
    }).attachCourseIds = async (rows) => rows;
    (service as unknown as {
      attachAccessSources: (
        _actor: JwtPayload,
        rows: MaterialEntity[],
      ) => Promise<MaterialEntity[]>;
    }).attachAccessSources = async (_actor, rows) => rows;
    return { service, repository };
  }

  it('title-only update keeps the previous fileUrl (failed replace must not wipe file)', async () => {
    const existing = {
      id: 'mat-1',
      title: 'Old',
      fileUrl: '/uploads/materials/old-uuid-book.pdf',
      status: 'active',
      folderId: 'folder-1',
    } as MaterialEntity;
    const { service, repository } = buildService(existing);

    const updated = await service.updateMaterial(actor, 'mat-1', {
      title: 'Renamed only',
    });

    expect(repository.updateMaterial).toHaveBeenCalledWith(
      'mat-1',
      expect.objectContaining({ title: 'Renamed only' }),
    );
    expect(repository.updateMaterial.mock.calls[0][1].fileUrl).toBeUndefined();
    expect(updated.fileUrl).toBe('/uploads/materials/old-uuid-book.pdf');
  });

  it('successful replace patches fileUrl to the new upload key', async () => {
    const existing = {
      id: 'mat-1',
      title: 'Old',
      fileUrl: '/uploads/materials/old-uuid-book.pdf',
      status: 'active',
      folderId: 'folder-1',
    } as MaterialEntity;
    const { service, repository } = buildService(existing);

    const updated = await service.updateMaterial(actor, 'mat-1', {
      title: 'Old',
      fileUrl: '/uploads/materials/new-uuid-book.pdf',
      fileType: 'pdf',
      fileSizeBytes: 12345,
      originalFilename: 'book.pdf',
    });

    expect(repository.updateMaterial).toHaveBeenCalledWith(
      'mat-1',
      expect.objectContaining({
        fileUrl: '/uploads/materials/new-uuid-book.pdf',
      }),
    );
    expect(updated.fileUrl).toBe('/uploads/materials/new-uuid-book.pdf');
  });
});
