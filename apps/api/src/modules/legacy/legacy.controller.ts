import { Controller, Get } from '@nestjs/common';

@Controller('apps/public/prod/public-settings/by-id')
export class LegacyController {
  @Get('longhua-crm')
  publicSettings() {
    return { id: 'longhua-crm', public_settings: { auth_required: true } };
  }
}
