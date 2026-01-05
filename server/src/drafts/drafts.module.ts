import { Module } from '@nestjs/common';
import { DraftsService } from './drafts.service.js';
import { DraftsController } from './drafts.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [DraftsController],
  providers: [DraftsService],
})
export class DraftsModule {}
