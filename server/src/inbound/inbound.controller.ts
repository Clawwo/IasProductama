import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InboundService } from './inbound.service.js';
import { CreateInboundDto } from './dto/create-inbound.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller('inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.inboundService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateInboundDto, @Req() req: { user?: JwtPayload }) {
    return this.inboundService.create(dto, req.user?.sub);
  }
}
