import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialAccessEntity } from '../../entities/MaterialAccess.entity';

@Injectable()
export class MaterialAccessCheckService {
  constructor(
    @InjectRepository(MaterialAccessEntity)
    private readonly accessRepo: Repository<MaterialAccessEntity>,
  ) {}

  async hasAccess(userId: string, materialId: string): Promise<boolean> {
    const accesses = await this.accessRepo.find({
      where: { userId, materialId },
    });

    const adminDeny = accesses.find(
      (a) => a.grantedByRole === 'ADMIN' && a.access === false,
    );
    if (adminDeny) return false;

    const adminAllow = accesses.find(
      (a) => a.grantedByRole === 'ADMIN' && a.access === true,
    );
    if (adminAllow) return true;

    const teacherAllow = accesses.find(
      (a) => a.grantedByRole === 'TEACHER' && a.access === true,
    );
    if (teacherAllow) return true;

    return false;
  }
}
