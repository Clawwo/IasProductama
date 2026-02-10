import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { OutboundService } from './outbound.service.js';
import { CreateOutboundDto } from './dto/create-outbound.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('outbound')
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.outboundService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateOutboundDto, @Req() req: { user?: JwtPayload }) {
    return this.outboundService.create(dto, req.user?.sub);
  }
}
