import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { entityToApiRecord } from '../../common/utils/api-record.util';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async findAll() {
    const rows = await this.settingsService.findAll();
    return entityToApiRecord(rows);
  }

  @Patch(':key')
  async upsert(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
  ) {
    const row = await this.settingsService.upsert(key, body.value, body.description);
    return entityToApiRecord(row);
  }

  @Get('welcome/page')
  async getWelcomePage() {
    const record = await this.settingsService.getWelcomePage();
    return entityToApiRecord(record);
  }

  @Patch('welcome/page')
  async saveWelcomePage(@Body() body: Record<string, unknown>) {
    const record = await this.settingsService.saveWelcomePage(body);
    return entityToApiRecord(record);
  }
}
