import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { UserEntity } from '../../users/entities/user.entity';
import { UserChatProfileEntity } from '../entities';

export interface ChatDirectoryFilters {
  query?: string;
  role?: string;
  language?: string;
  level?: string;
  timezone?: string;
}

export type ChatDirectoryUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  lastSeenAt: Date | null;
  profile: {
    nativeLanguage: string | null;
    spokenLanguage: string | null;
    timezone: string | null;
    levelLabel: string | null;
  } | null;
};

@Injectable()
export class ChatDirectoryService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  async search(
    actor: DomainAccessActor,
    filters: ChatDirectoryFilters,
  ): Promise<ChatDirectoryUser[]> {
    const query = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndMapOne(
        'user.chatProfile',
        UserChatProfileEntity,
        'profile',
        'profile.user_id = user.id',
      )
      .select([
        'user.id',
        'user.email',
        'user.role',
        'user.firstName',
        'user.lastName',
        'user.lastSeenAt',
      ])
      .addSelect([
        'profile.nativeLanguage',
        'profile.spokenLanguage',
        'profile.timezone',
        'profile.levelLabel',
      ])
      .where('user.id <> :userId', { userId: actor.sub })
      .andWhere('user.status = :status', { status: 'active' })
      .take(50);

    if (filters.role) query.andWhere('user.role = :role', { role: filters.role });
    if (filters.query) {
      query.andWhere(
        new Brackets((where) =>
          where
            .where('user.first_name ILIKE :query', { query: `%${filters.query}%` })
            .orWhere('user.last_name ILIKE :query', { query: `%${filters.query}%` })
            .orWhere('user.email ILIKE :query', { query: `%${filters.query}%` }),
        ),
      );
    }
    if (filters.language) {
      query.andWhere(
        '(profile.native_language = :language OR profile.spoken_language = :language)',
        { language: filters.language },
      );
    }
    if (filters.level) query.andWhere('profile.level_label = :level', { level: filters.level });
    if (filters.timezone) {
      query.andWhere('profile.timezone = :timezone', { timezone: filters.timezone });
    }

    const rows = await query.getMany();
    return rows.map((user) => {
      const profile = (user as UserEntity & { chatProfile?: UserChatProfileEntity }).chatProfile;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        lastSeenAt: user.lastSeenAt ?? null,
        profile: profile
          ? {
              nativeLanguage: profile.nativeLanguage,
              spokenLanguage: profile.spokenLanguage,
              timezone: profile.timezone,
              levelLabel: profile.levelLabel,
            }
          : null,
      };
    });
  }
}
