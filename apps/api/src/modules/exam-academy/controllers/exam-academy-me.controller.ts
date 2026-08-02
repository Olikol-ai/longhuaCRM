import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  PERSONAL_WORD_STATUS,
  REVIEW_ITEM_STATUS,
  SESSION_STATUS,
} from '../constants';
import {
  ExamAcademyFavoriteEntity,
  ExamAcademyPersonalWordEntity,
  ExamAcademyReviewItemEntity,
  ExamAcademyUserAchievementEntity,
  ExamAcademyUserStatsDailyEntity,
} from '../entities';
import { ExamAcademySessionService } from '../services/exam-academy-session.service';

class FavoriteDto {
  @IsString()
  content_kind!: string;

  @IsUUID()
  content_id!: string;

  @IsOptional()
  @IsUUID()
  content_item_id?: string;
}

class WordDto {
  @IsString()
  word!: string;

  @IsOptional()
  @IsString()
  pinyin?: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * «Моя подготовка» — learner cabinet endpoints.
 * Longhua school only (not tutors / tutor_students).
 */
@Controller('exam-academy/me')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'teacher', 'student')
export class ExamAcademyMeController {
  constructor(
    private readonly sessionService: ExamAcademySessionService,
    @InjectRepository(ExamAcademyFavoriteEntity)
    private readonly favorites: Repository<ExamAcademyFavoriteEntity>,
    @InjectRepository(ExamAcademyReviewItemEntity)
    private readonly reviewItems: Repository<ExamAcademyReviewItemEntity>,
    @InjectRepository(ExamAcademyPersonalWordEntity)
    private readonly words: Repository<ExamAcademyPersonalWordEntity>,
    @InjectRepository(ExamAcademyUserStatsDailyEntity)
    private readonly statsDaily: Repository<ExamAcademyUserStatsDailyEntity>,
    @InjectRepository(ExamAcademyUserAchievementEntity)
    private readonly userAchievements: Repository<ExamAcademyUserAchievementEntity>,
  ) {}

  @Get('preparation')
  async preparation(@Req() req: { user: DomainAccessActor }) {
    const userId = req.user.sub;
    const [history, favorites, review, dictionary, stats, achievements] = await Promise.all([
      this.sessionService.listPreparationHistory(userId, 30),
      this.favorites.count({ where: { userId } }),
      this.reviewItems.count({ where: { userId, status: REVIEW_ITEM_STATUS.Active } }),
      this.words.count({ where: { userId } }),
      this.statsDaily.find({
        where: { userId },
        order: { day: 'DESC' },
        take: 30,
      }),
      this.userAchievements.find({
        where: { userId },
        relations: { achievement: true },
        order: { earnedAt: 'DESC' },
      }),
    ]);

    const completed = history.filter(
      (s) =>
        s.status === SESSION_STATUS.Completed ||
        s.display_status === SESSION_STATUS.Completed ||
        s.status === SESSION_STATUS.Expired ||
        s.display_status === SESSION_STATUS.Expired,
    );
    const practices = completed.filter(
      (s) => s.mode === 'practice' || s.mode === 'error_review' || s.mode === 'favorites',
    );
    const mocks = completed.filter((s) => s.mode === 'mock_exam' || s.mode === 'random_exam');
    const avg =
      stats.length > 0
        ? stats.reduce((sum, row) => sum + (Number(row.avgPercent) || 0), 0) / stats.length
        : 0;
    const best = stats.reduce((max, row) => Math.max(max, Number(row.bestPercent) || 0), 0);

    return {
      summary: {
        practice_count: practices.length,
        mock_count: mocks.length,
        average_percent: Math.round(avg * 100) / 100,
        best_percent: best,
        favorites_count: favorites,
        review_count: review,
        dictionary_count: dictionary,
      },
      history,
      stats_series: stats.reverse(),
      achievements,
    };
  }

  @Get('favorites')
  listFavorites(@Req() req: { user: DomainAccessActor }) {
    return this.favorites.find({
      where: { userId: req.user.sub },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('favorites')
  async addFavorite(@Req() req: { user: DomainAccessActor }, @Body() dto: FavoriteDto) {
    const existing = await this.favorites.findOne({
      where: {
        userId: req.user.sub,
        contentKind: dto.content_kind,
        contentId: dto.content_id,
      },
    });
    if (existing) return existing;
    return this.favorites.save({
      userId: req.user.sub,
      contentKind: dto.content_kind,
      contentId: dto.content_id,
      contentItemId: dto.content_item_id ?? null,
    });
  }

  @Delete('favorites/:id')
  async removeFavorite(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    await this.favorites.delete({ id, userId: req.user.sub });
    return { ok: true };
  }

  @Get('review')
  listReview(@Req() req: { user: DomainAccessActor }) {
    return this.reviewItems.find({
      where: { userId: req.user.sub, status: REVIEW_ITEM_STATUS.Active },
      order: { lastWrongAt: 'DESC' },
    });
  }

  @Get('dictionary')
  listDictionary(@Req() req: { user: DomainAccessActor }, @Query('status') status?: string) {
    return this.words.find({
      where: status ? { userId: req.user.sub, status } : { userId: req.user.sub },
      order: { updatedAt: 'DESC' },
    });
  }

  @Post('dictionary')
  async addWord(@Req() req: { user: DomainAccessActor }, @Body() dto: WordDto) {
    return this.words.save({
      userId: req.user.sub,
      word: dto.word.trim(),
      pinyin: dto.pinyin ?? null,
      translation: dto.translation ?? null,
      explanation: dto.explanation ?? null,
      note: dto.note ?? null,
      status: dto.status || PERSONAL_WORD_STATUS.Saved,
      sourceContentKind: null,
      sourceContentId: null,
    });
  }

  @Patch('dictionary/:id')
  async updateWord(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() dto: Partial<WordDto>,
  ) {
    const row = await this.words.findOne({ where: { id, userId: req.user.sub } });
    if (!row) return null;
    Object.assign(row, {
      ...(dto.word !== undefined ? { word: dto.word } : {}),
      ...(dto.pinyin !== undefined ? { pinyin: dto.pinyin } : {}),
      ...(dto.translation !== undefined ? { translation: dto.translation } : {}),
      ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
    return this.words.save(row);
  }

  @Delete('dictionary/:id')
  async deleteWord(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    await this.words.delete({ id, userId: req.user.sub });
    return { ok: true };
  }

  @Get('stats/series')
  statsSeries(@Req() req: { user: DomainAccessActor }) {
    return this.statsDaily.find({
      where: { userId: req.user.sub },
      order: { day: 'ASC' },
      take: 90,
    });
  }
}
