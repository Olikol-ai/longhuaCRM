import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ProfileRelationsService } from './profile-relations.service';
import { UsersRepository } from './users.repository';

export interface UserDeleteResult {
  ok: true;
  orphanStudents: unknown[];
}

export interface PendingRegistrationDeleteResult {
  ok: true;
}

/**
 * Hard-delete a user account.
 *
 * Historical business data is preserved:
 * - lessons / groups stay (teacher/student FKs SET NULL via profile deletion)
 * - homework attempts / assessment attempts stay (user_id SET NULL)
 * - B2B receipts / commission accruals stay (manager_user_id SET NULL)
 *
 * Operational-only rows (ACL grants, personal prefs, sessions) are removed
 * only when they cannot exist without the account.
 */
@Injectable()
export class UserDeletionService {
  private readonly logger = new Logger(UserDeletionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profileRelations: ProfileRelationsService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async deleteUser(userId: string): Promise<UserDeleteResult> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.nullifyIfColumn(manager, 'assessment_attempts', 'user_id', userId);
        await this.nullifyIfColumn(manager, 'homework_attempts', 'user_id', userId);
        await this.nullifyIfColumn(manager, 'homework_assignments', 'assigned_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'homework_assignments', 'checked_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'homeworks', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'exam_academy_sessions', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'exam_academy_sessions', 'assigned_by_user_id', userId);

        await this.nullifyIfColumn(manager, 'assessment_exams', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'assessment_questions', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'assessment_exam_assignments', 'assigned_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'materials', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'material_folders', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'chats', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'chat_messages', 'sender_user_id', userId);
        await this.nullifyIfColumn(manager, 'chat_pinned_messages', 'pinned_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'certificate_history', 'actor_user_id', userId);
        await this.nullifyIfColumn(manager, 'lesson_recurrence_series', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'teacher_invite_links', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'tutor_invite_links', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'homework_access', 'granted_by_user_id', userId);

        await this.nullifyIfColumn(manager, 'organizations', 'sales_manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'organization_receipts', 'sales_manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'organization_receipts', 'created_by_user_id', userId);
        await this.nullifyIfColumn(manager, 'sales_commission_accruals', 'manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'sales_commission_payouts', 'manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'sales_commission_payouts', 'created_by_user_id', userId);

        await this.nullifyIfColumn(manager, 'sales_diary_entries', 'sales_manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'sales_diary_notes', 'sales_manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'sales_diary_contacts', 'sales_manager_user_id', userId);
        await this.nullifyIfColumn(manager, 'organization_deals', 'sales_manager_user_id', userId);

        await this.deleteIfTable(manager, 'homework_access', 'grantee_user_id', userId);
        await this.deleteIfTable(manager, 'exam_content_permissions', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_content_item_usage', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_academy_favorites', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_academy_review_items', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_academy_personal_words', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_academy_user_achievements', 'user_id', userId);
        await this.deleteIfTable(manager, 'exam_academy_user_stats_daily', 'user_id', userId);
      });

      const { orphanStudents } = await this.profileRelations.deleteProfilesForUser(userId);

      await this.deletePendingRegistrationsByEmail(user.email);

      try {
        await this.usersRepository.delete(userId);
      } catch (error) {
        this.throwIfFkViolation(error, userId);
        throw error;
      }

      return { ok: true, orphanStudents };
    } catch (error) {
      this.throwIfFkViolation(error, userId);
      throw error;
    }
  }

  async deletePendingRegistration(id: string): Promise<PendingRegistrationDeleteResult> {
    const exists = await this.tableExists(this.dataSource.manager, 'pending_registrations');
    if (!exists) {
      throw new NotFoundException('Pending registration not found');
    }
    const rows = await this.dataSource.query(
      `SELECT id, email FROM pending_registrations WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException('Pending registration not found');
    }
    const email = String(rows[0].email ?? '');
    const linkedUser = await this.usersRepository.findByEmail(email);
    if (linkedUser) {
      throw new ConflictException(
        'Нельзя удалить незавершённую регистрацию: для этого email уже создан аккаунт. Удалите аккаунт пользователя.',
      );
    }
    await this.dataSource.query(`DELETE FROM pending_registrations WHERE id = $1`, [id]);
    return { ok: true };
  }

  private async deletePendingRegistrationsByEmail(email: string): Promise<void> {
    if (!email?.trim()) {
      return;
    }
    if (!(await this.tableExists(this.dataSource.manager, 'pending_registrations'))) {
      return;
    }
    await this.dataSource.query(
      `DELETE FROM pending_registrations WHERE LOWER(email) = LOWER($1)`,
      [email.trim()],
    );
  }

  private throwIfFkViolation(error: unknown, userId: string): void {
    if (!(error instanceof QueryFailedError)) {
      return;
    }
    const driver = error as QueryFailedError & { code?: string };
    const code = String(driver.code ?? '');
    const message = String(error.message ?? '');
    if (code === '23503' || /foreign key|violates foreign key/i.test(message)) {
      this.logger.error(`User delete blocked by FK for ${userId}: ${message}`);
      throw new ConflictException(
        'Нельзя удалить пользователя: остаются связанные записи. Обратитесь к администратору.',
      );
    }
    if (code === '42P01' || /does not exist/i.test(message)) {
      this.logger.error(`User delete hit missing relation for ${userId}: ${message}`);
      throw new ConflictException(
        'Нельзя удалить пользователя: ошибка схемы базы данных. Обратитесь к администратору.',
      );
    }
  }

  private async tableExists(manager: EntityManager, table: string): Promise<boolean> {
    const rows = await manager.query(`SELECT to_regclass($1) AS name`, [`public.${table}`]);
    return Boolean(rows[0]?.name);
  }

  private async columnIsNullable(
    manager: EntityManager,
    table: string,
    column: string,
  ): Promise<boolean> {
    const rows = await manager.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return rows[0]?.is_nullable === 'YES';
  }

  private async nullifyIfColumn(
    manager: EntityManager,
    table: string,
    column: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.tableExists(manager, table))) {
      return;
    }
    if (!(await this.columnIsNullable(manager, table, column))) {
      return;
    }
    await manager.query(
      `UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" = $1`,
      [userId],
    );
  }

  private async deleteIfTable(
    manager: EntityManager,
    table: string,
    column: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.tableExists(manager, table))) {
      return;
    }
    await manager.query(`DELETE FROM "${table}" WHERE "${column}" = $1`, [userId]);
  }
}
