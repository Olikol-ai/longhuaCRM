import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMaterialFolderDto } from './dto/create-material-folder.dto';
import { FilterQueryDto } from './dto/filter-query.dto';
import {
  GrantMaterialAccessDto,
  RevokeMaterialAccessDto,
} from './dto/grant-material-access.dto';
import { SyncMaterialAccessDto } from './dto/sync-material-access.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateMaterialFolderDto } from './dto/update-material-folder.dto';
import { MaterialAccessCheckService } from './material-access-check.service';
import { MaterialAccessService } from './material-access.service';
import { MaterialsService } from './materials.service';

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly materialAccessService: MaterialAccessService,
    private readonly materialAccessCheck: MaterialAccessCheckService,
  ) {}

  @Get()
  findAllMaterials(
    @CurrentUser() user: JwtPayload,
    @Query('courseId') courseId?: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.materialsService.findAllMaterials(user, {
      courseId: courseId?.trim() || undefined,
      folderId: folderId?.trim() || undefined,
    });
  }

  @Post('filter')
  filterMaterials(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.materialsService.filterMaterials(user, dto.where ?? {});
  }

  @Get('folders')
  findAllFolders(@CurrentUser() user: JwtPayload) {
    return this.materialsService.findAllFolders(user);
  }

  @Post('folders/filter')
  filterFolders(@CurrentUser() user: JwtPayload, @Body() dto: FilterQueryDto) {
    return this.materialsService.filterFolders(user, dto.where ?? {});
  }

  @Get('folders/:id')
  findFolderById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.materialsService.findFolderById(user, id);
  }

  @Post('folders')
  @Roles('admin', 'teacher', 'tutor')
  createFolder(@CurrentUser() user: JwtPayload, @Body() dto: CreateMaterialFolderDto) {
    return this.materialsService.createFolder(user, dto);
  }

  @Patch('folders/:id')
  @Roles('admin', 'teacher', 'tutor')
  updateFolder(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialFolderDto,
  ) {
    return this.materialsService.updateFolder(user, id, dto);
  }

  @Delete('folders/:id')
  @Roles('admin')
  deleteFolder(@Param('id') id: string) {
    return this.materialsService.deleteFolder(id);
  }

  @Post('access/grant')
  @Roles('admin', 'teacher', 'tutor')
  grantAccess(@CurrentUser() user: JwtPayload, @Body() dto: GrantMaterialAccessDto) {
    return this.materialAccessService.grant(dto, user);
  }

  @Post('access/revoke')
  @Roles('admin', 'teacher', 'tutor')
  revokeAccess(@CurrentUser() user: JwtPayload, @Body() dto: RevokeMaterialAccessDto) {
    return this.materialAccessService.revoke(dto, user);
  }

  @Post('access/sync')
  @Roles('admin')
  syncAccess(@Body() dto: SyncMaterialAccessDto) {
    return this.materialAccessService.syncUserAccess(
      dto.userId,
      dto.materialIds,
      dto.grantedByRole ?? 'ADMIN',
    );
  }

  @Get('access/check/:materialId')
  checkAccess(
    @CurrentUser() user: JwtPayload,
    @Param('materialId') materialId: string,
  ) {
    return this.materialAccessCheck
      .hasAccess(user.sub, materialId, user.role)
      .then((hasAccess) => ({ has_access: hasAccess }));
  }

  @Get('access/material/:materialId')
  @Roles('admin', 'teacher', 'tutor')
  listMaterialGrants(@Param('materialId') materialId: string) {
    return this.materialAccessService.listGrantsForMaterial(materialId);
  }

  @Get(':id')
  findMaterialById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.materialsService.findMaterialById(user, id);
  }

  @Post()
  @Roles('admin', 'teacher', 'tutor')
  createMaterial(@CurrentUser() user: JwtPayload, @Body() dto: CreateMaterialDto) {
    return this.materialsService.createMaterial(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'teacher', 'tutor')
  updateMaterial(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.updateMaterial(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'teacher', 'tutor')
  deleteMaterial(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.materialsService.deleteMaterial(user, id);
  }
}

@Controller('material-access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialAccessController {
  constructor(
    private readonly materialAccessService: MaterialAccessService,
    private readonly materialAccessCheck: MaterialAccessCheckService,
  ) {}

  @Get('check/:materialId')
  check(
    @CurrentUser() user: JwtPayload,
    @Param('materialId') materialId: string,
  ) {
    return this.materialAccessCheck
      .hasAccess(user.sub, materialId, user.role)
      .then((hasAccess) => ({ has_access: hasAccess }));
  }

  @Get('user/:userId/editor')
  @Roles('admin', 'teacher')
  getEditor(@Param('userId') userId: string) {
    return this.materialAccessService.getUserAccessEditor(userId);
  }

  @Put('user/:userId')
  @Roles('admin')
  syncUser(
    @Param('userId') userId: string,
    @Body() body: { material_ids?: string[]; materialIds?: string[] },
  ) {
    const materialIds = body.materialIds ?? body.material_ids ?? [];
    return this.materialAccessService.syncUserAccess(userId, materialIds, 'ADMIN');
  }
}
