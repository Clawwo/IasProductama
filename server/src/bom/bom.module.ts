import { Module } from '@nestjs/common';
import { BomService } from './bom.service.js';
import { BomController } from './bom.controller.js';

@Module({
  providers: [BomService],
  controllers: [BomController],
})
export class BomModule {}
