import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller.js';
import { InboundService } from './inbound.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
