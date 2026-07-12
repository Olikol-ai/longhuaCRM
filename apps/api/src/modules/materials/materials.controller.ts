import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { SyncMaterialAccessDto } from './dto/sync-material-access.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateMaterialFolderDto } from './dto/update-material-folder.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAllMaterials(@CurrentUser() user: JwtPayload) {
    return this.materialsService.findAllMaterials(user);
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
  @Roles('admin')
  createFolder(@Body() dto: CreateMaterialFolderDto) {
    return this.materialsService.createFolder(dto);
  }

  @Patch('folders/:id')
  @Roles('admin')
  updateFolder(@Param('id') id: string, @Body() dto: UpdateMaterialFolderDto) {
    return this.materialsService.updateFolder(id, dto);
  }

  @Delete('folders/:id')
  @Roles('admin')
  deleteFolder(@Param('id') id: string) {
    return this.materialsService.deleteFolder(id);
  }

  @Post('access/sync')
  @Roles('admin')
  syncAccess(@Body() dto: SyncMaterialAccessDto) {
    return this.materialsService.syncAccess(dto);
  }

  @Get(':id')
  findMaterialById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.materialsService.findMaterialById(user, id);
  }

  @Post()
  @Roles('admin')
  createMaterial(@Body() dto: CreateMaterialDto) {
    return this.materialsService.createMaterial(dto);
  }

  @Patch(':id')
  @Roles('admin')
  updateMaterial(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materialsService.updateMaterial(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  deleteMaterial(@Param('id') id: string) {
    return this.materialsService.deleteMaterial(id);
  }
}
