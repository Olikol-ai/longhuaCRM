import {
  Body,
  Controller,
  Delete,
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
import { EntityRepositoryService } from './entity-repository.service';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entityRepository: EntityRepositoryService) {}

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

    const { sort, limit, ...filters } = query;

    const hasFilters = Object.keys(filters).length > 0;

    if (hasFilters) {
      return this.entityRepository.filter(entityName, filters);
    }

    return this.entityRepository.list(
      entityName,
      sort,
      limit ? Number(limit) : undefined,
    );
  }

  @Post(':entity/filter')
  @UseGuards(JwtAuthGuard)
  filter(
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
  ) {
    const entityName = this.ensureEntity(entity);
    return this.entityRepository.filter(entityName, body || {});
  }

  @Post(':entity')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown> | Record<string, unknown>[],
  ) {
    const entityName = this.ensureEntity(entity);

    if (Array.isArray(body)) {
      return this.entityRepository.bulkCreate(entityName, body);
    }

    return this.entityRepository.create(entityName, body || {});
  }

  @Patch(':entity/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const entityName = this.ensureEntity(entity);
    return this.entityRepository.update(entityName, id, body || {});
  }

  @Delete(':entity/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    const entityName = this.ensureEntity(entity);

    await this.entityRepository.delete(entityName, id);

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
}
