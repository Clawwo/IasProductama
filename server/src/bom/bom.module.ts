import { Module } from '@nestjs/common';
import { BomService } from './bom.service.js';
import { BomController } from './bom.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [BomService],
  controllers: [BomController],
})
export class BomModule {}
