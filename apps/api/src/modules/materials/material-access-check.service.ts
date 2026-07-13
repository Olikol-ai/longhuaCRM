import { Injectable } from '@nestjs/common';
import { MaterialsDomainAccessService } from '../../common/access/materials-domain-access.service';
import { normalizeRole } from '../../common/constants/roles';

@Injectable()
export class MaterialAccessCheckService {
  constructor(private readonly materialsAccess: MaterialsDomainAccessService) {}

  private actor(userId: string, role: string | undefined) {
    return { sub: userId, email: '', role: role ?? '' };
  }

  async assertCanAccess(
    userId: string,
    role: string | undefined,
    materialId: string,
  ): Promise<void> {
    await this.materialsAccess.assertCanReadMaterial(
      this.actor(userId, role),
      materialId,
    );
  }

  async checkAccess(
    userId: string,
    role: string | undefined,
    materialId: string,
  ): Promise<{ hasAccess: boolean }> {
    const hasAccess = await this.hasAccess(userId, materialId, role);
    return { hasAccess };
  }

  async hasAccess(
    userId: string,
    materialId: string,
    role?: string,
  ): Promise<boolean> {
    return this.canAccessMaterial(userId, materialId, role);
  }

  async canAccessMaterial(
    userId: string,
    materialId: string,
    role?: string,
  ): Promise<boolean> {
    if (normalizeRole(role) === 'admin') {
      return true;
    }
    try {
      await this.assertCanAccess(userId, role, materialId);
      return true;
    } catch {
      return false;
    }
  }

  async getAccessibleMaterialIds(
    userId: string,
    role: string | undefined,
  ): Promise<string[]> {
    if (normalizeRole(role) === 'admin') {
      return [];
    }
    return this.materialsAccess.resolveAccessibleMaterialIds(
      this.actor(userId, role),
    );
  }

  async filterAccessibleMaterialIds(
    userId: string,
    role: string | undefined,
    materialIds: string[],
  ): Promise<string[]> {
    if (normalizeRole(role) === 'admin') {
      return materialIds;
    }
    const ids = await this.materialsAccess.resolveAccessibleMaterialIds(
      this.actor(userId, role),
    );
    const allowed = new Set(ids);
    return materialIds.filter((id) => allowed.has(id));
  }
}
