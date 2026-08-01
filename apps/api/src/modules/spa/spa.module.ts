import { Module } from '@nestjs/common';
import { SpaController } from './spa.controller';
import { SpaFallbackRegistrar } from './spa-fallback.registrar';

@Module({
  controllers: [SpaController],
  providers: [SpaFallbackRegistrar],
})
export class SpaModule {}
