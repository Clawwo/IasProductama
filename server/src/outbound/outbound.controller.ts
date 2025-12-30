import { Body, Controller, Post } from '@nestjs/common';
import { OutboundService } from './outbound.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';

@Controller('api/outbound')
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  @Post()
  create(@Body() dto: CreateOutboundDto) {
    return this.outboundService.create(dto);
  }
}
