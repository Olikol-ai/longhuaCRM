import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { MaterialAccessCheckService } from './material-access-check.service';

@Controller('material-access')
export class MaterialAccessController {
  constructor(private readonly materialAccessCheck: MaterialAccessCheckService) {}

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
}
