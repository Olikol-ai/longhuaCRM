import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';
import { normalizeRole } from '../../common/constants/roles';

@Injectable()
export class B2bAccessService {
  isAdmin(actor: JwtPayload): boolean {
    return normalizeRole(actor.role) === 'admin';
  }

  isSalesManager(actor: JwtPayload): boolean {
    return normalizeRole(actor.role) === 'sales_manager';
  }

  canAccessB2b(actor: JwtPayload): boolean {
    const role = normalizeRole(actor.role);
    return role === 'admin' || role === 'sales_manager';
  }

  assertCanAccessB2b(actor: JwtPayload): void {
    if (!this.canAccessB2b(actor)) {
      throw new ForbiddenException('B2B sales access denied');
    }
  }

  assertAdmin(actor: JwtPayload): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  assertCanReadOrganization(actor: JwtPayload, salesManagerUserId: string | null): void {
    this.assertCanAccessB2b(actor);
    if (this.isAdmin(actor)) {
      return;
    }
    if (salesManagerUserId !== actor.sub) {
      throw new ForbiddenException('Organization access denied');
    }
  }

  scopeOrganizationManagerId(actor: JwtPayload): string | null {
    this.assertCanAccessB2b(actor);
    if (this.isAdmin(actor)) {
      return null;
    }
    return actor.sub;
  }

  assertCanManageOrganization(actor: JwtPayload): void {
    this.assertAdmin(actor);
  }

  assertCanManageReceipts(actor: JwtPayload): void {
    this.assertAdmin(actor);
  }

  assertCanManagePayouts(actor: JwtPayload): void {
    this.assertAdmin(actor);
  }

  assertOrganizationExists<T>(row: T | null): asserts row is T {
    if (!row) {
      throw new NotFoundException('Organization not found');
    }
  }
}
