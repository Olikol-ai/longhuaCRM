import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  UnauthorizedException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  EntityName,
  PUBLIC_READ_ENTITIES,
} from '../../common/constants/entity-names';

import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import { EntityAccessService } from './entity-access.service';
import { EntityRepositoryService } from './entity-repository.service';

@Controller('entities')
export class EntitiesController {
  constructor(
    private readonly entityRepository: EntityRepositoryService,
    private readonly entityAccess: EntityAccessService,
  ) {}

  @Get(':entity')
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @Param('entity') entity: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: JwtPayload | null,
  ) {
    const entityName = this.ensureEntity(entity);

    if (!this.isPublicRead(entityName) && !user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const context = user
      ? await this.entityAccess.createContext(user.sub, user.role)
      : null;

    const { sort, limit, ...filters } = query;
    const hasFilters = Object.keys(filters).length > 0;

    if (hasFilters) {
      if (!context) {
        throw new UnauthorizedException('Unauthorized');
      }
      return this.entityRepository.filter(entityName, filters, context);
    }

    return this.entityRepository.list(
      entityName,
      context,
      sort,
      limit ? Number(limit) : undefined,
    );
  }

  @Post(':entity/filter')
  @UseGuards(JwtAuthGuard)
  async filter(
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    const entityName = this.ensureEntity(entity);
    const context = await this.entityAccess.createContext(user.sub, user.role);
    return this.entityRepository.filter(entityName, body || {}, context);
  }

  @Post(':entity')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown> | Record<string, unknown>[],
    @CurrentUser() user: JwtPayload,
  ) {
    const entityName = this.ensureEntity(entity);
    this.ensureWritableEntity(entityName);
    const context = await this.entityAccess.createContext(user.sub, user.role);

    if (Array.isArray(body)) {
      return this.entityRepository.bulkCreate(entityName, body, context);
    }

    return this.entityRepository.create(entityName, body || {}, context);
  }

  @Patch(':entity/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    const entityName = this.ensureEntity(entity);
    const context = await this.entityAccess.createContext(user.sub, user.role);
    return this.entityRepository.update(entityName, id, body || {}, context);
  }

  @Delete(':entity/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const entityName = this.ensureEntity(entity);
    const context = await this.entityAccess.createContext(user.sub, user.role);

    await this.entityRepository.delete(entityName, id, context);

    return { success: true };
  }

  private ensureEntity(entity: string): EntityName {
    if (!this.entityRepository.isKnownEntity(entity)) {
      throw new NotFoundException(`Unknown entity: ${entity}`);
    }

    return entity;
  }

  private isPublicRead(entity: EntityName) {
    return PUBLIC_READ_ENTITIES.includes(
      entity as (typeof PUBLIC_READ_ENTITIES)[number],
    );
  }

  private ensureWritableEntity(entity: EntityName) {
    if (entity === 'User') {
      throw new ForbiddenException('Use /api/auth/register for User creation');
    }
  }
}
