import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { canManageHskAcademyContent } from '../../../common/constants/roles';
import { PUBLISH_CAPABILITY } from '../constants';
import { ExamContentPermissionEntity } from '../entities';

@Injectable()
export class ExamContentAccessService {
  constructor(
    @InjectRepository(ExamContentPermissionEntity)
    private readonly permissions: Repository<ExamContentPermissionEntity>,
  ) {}

  assertStaff(actor: DomainAccessActor): void {
    if (canManageHskAcademyContent(actor.role)) return;
    throw new ForbiddenException(
      'Exam Content Studio доступен только преподавателям школы Longhua',
    );
  }

  isAdmin(actor: DomainAccessActor): boolean {
    return String(actor.role || '').toLowerCase() === 'admin';
  }

  async canPublish(actor: DomainAccessActor): Promise<boolean> {
    if (this.isAdmin(actor)) return true;
    const row = await this.permissions.findOne({
      where: { userId: actor.sub, capability: PUBLISH_CAPABILITY },
    });
    return Boolean(row);
  }

  async assertCanPublish(actor: DomainAccessActor): Promise<void> {
    this.assertStaff(actor);
    if (!(await this.canPublish(actor))) {
      throw new ForbiddenException('Недостаточно прав для публикации контента');
    }
  }
}
