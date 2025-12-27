import { Module } from '@nestjs/common';
import { InboundController } from './inbound.controller.js';
import { InboundService } from './inbound.service.js';

@Module({
  controllers: [InboundController],
  providers: [InboundService],
})
export class InboundModule {}
