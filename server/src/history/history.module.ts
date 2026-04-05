import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
