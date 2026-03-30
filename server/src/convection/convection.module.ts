import { Module } from '@nestjs/common';
import { ConvectionService } from './convection.service.js';
import { ConvectionController } from './convection.controller.js';

@Module({
  controllers: [ConvectionController],
  providers: [ConvectionService],
})
export class ConvectionModule {}
