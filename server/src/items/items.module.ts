import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ItemsService } from './items.service.js';
import { ItemsController } from './items.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
