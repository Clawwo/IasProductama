import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller.js';
import { ProductionService } from './production.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
