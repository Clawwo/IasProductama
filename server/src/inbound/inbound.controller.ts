import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { InboundService } from './inbound.service.js';
import { CreateInboundDto } from './dto/create-inbound.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.inboundService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateInboundDto, @Req() req: { user?: JwtPayload }) {
    return this.inboundService.create(dto, req.user?.sub);
  }
}
