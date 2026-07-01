import { Body, Controller, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { SyncMaterialAccessDto } from './dto/sync-material-access.dto';
import { EntityAccessService } from './entity-access.service';
import { MaterialAccessCheckService } from './material-access-check.service';
import { MaterialAccessManagementService } from './material-access-management.service';

@Controller('material-access')
export class MaterialAccessController {
  constructor(
    private readonly materialAccessCheck: MaterialAccessCheckService,
    private readonly materialAccessManagement: MaterialAccessManagementService,
    private readonly entityAccess: EntityAccessService,
  ) {}

  @Get('check/:materialId')
  @UseGuards(JwtAuthGuard)
  async checkAccess(
    @CurrentUser() user: JwtPayload,
    @Param('materialId') materialId: string,
  ) {
    const hasAccess = await this.materialAccessCheck.canAccessMaterial(
      user.sub,
      materialId,
      user.role,
    );
    return { has_access: hasAccess };
  }

  @Get('user/:userId/editor')
  @UseGuards(JwtAuthGuard)
  async getUserEditor(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    const context = await this.entityAccess.createContext(user.sub, user.role);
    if (context.role !== 'admin' && context.role !== 'teacher') {
      throw new ForbiddenException('Forbidden');
    }
    return this.materialAccessManagement.getEditorData(userId, context);
  }

  @Put('user/:userId')
  @UseGuards(JwtAuthGuard)
  async syncUserAccess(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: SyncMaterialAccessDto,
  ) {
    const context = await this.entityAccess.createContext(user.sub, user.role);
    if (context.role !== 'admin' && context.role !== 'teacher') {
      throw new ForbiddenException('Forbidden');
    }
    return this.materialAccessManagement.syncUserAccess(
      userId,
      body.material_ids ?? [],
      context,
    );
  }
}
