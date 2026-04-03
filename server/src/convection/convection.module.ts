import { Module } from '@nestjs/common';
import { ConvectionService } from './convection.service.js';
import { ConvectionController } from './convection.controller.js';
import { ConvectionAccessGuard } from './convection-access.guard.js';

@Module({
  controllers: [ConvectionController],
  providers: [ConvectionService, ConvectionAccessGuard],
})
export class ConvectionModule {}
