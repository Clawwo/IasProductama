import { Module } from '@nestjs/common';
import { OutboundController } from './outbound.controller.js';
import { OutboundService } from './outbound.service.js';

@Module({
  controllers: [OutboundController],
  providers: [OutboundService],
})
export class OutboundModule {}
