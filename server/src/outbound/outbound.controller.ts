import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OutboundService } from './outbound.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

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
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateOutboundDto, @Req() req: { user?: JwtPayload }) {
    return this.outboundService.create(dto, req.user?.sub);
  }
}
