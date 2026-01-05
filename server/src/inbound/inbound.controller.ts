import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InboundService } from './inbound.service.js';
import { CreateInboundDto } from './dto/create-inbound.dto.js';

@Controller('api/inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.inboundService.findRecent(Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post()
  create(@Body() dto: CreateInboundDto) {
    return this.inboundService.create(dto);
  }
}
