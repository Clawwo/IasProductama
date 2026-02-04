import { Module } from '@nestjs/common';
import { OutboundController } from './outbound.controller.js';
import { OutboundService } from './outbound.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [OutboundController],
  providers: [OutboundService],
})
export class OutboundModule {}
