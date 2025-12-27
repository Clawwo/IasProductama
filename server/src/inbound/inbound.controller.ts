import { Body, Controller, Post } from '@nestjs/common';
import { InboundService } from './inbound.service.js';
import { CreateInboundDto } from './dto/create-inbound.dto.js';

@Controller('api/inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Post()
  create(@Body() dto: CreateInboundDto) {
    return this.inboundService.create(dto);
  }
}
