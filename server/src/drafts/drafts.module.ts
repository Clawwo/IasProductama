import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DraftsService } from './drafts.service.js';
import { DraftsController } from './drafts.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DraftsController],
  providers: [DraftsService],
})
export class DraftsModule {}
