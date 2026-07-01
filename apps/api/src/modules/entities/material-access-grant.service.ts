import { Injectable } from '@nestjs/common';
import { EntityAccessContext } from './entity-access.types';
import { MaterialAccessWriteService } from './material-access-write.service';

@Injectable()
export class MaterialAccessGrantService {
  constructor(private readonly accessWrite: MaterialAccessWriteService) {}

  async grantCreatorAccess(
    materialId: string,
    context: EntityAccessContext,
  ): Promise<void> {
    if (context.role !== 'teacher' && context.role !== 'admin') {
      return;
    }

    const auditRole = context.role === 'admin' ? 'ADMIN' : 'TEACHER';
    await this.accessWrite.grantAccess(context.userId, materialId, auditRole);
  }
}
