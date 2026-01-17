import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OutboundService } from './outbound.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';

@Controller('outbound')
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.outboundService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post()
  create(@Body() dto: CreateOutboundDto) {
    return this.outboundService.create(dto);
  }
}
