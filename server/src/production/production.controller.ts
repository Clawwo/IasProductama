import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ProductionService } from './production.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.productionService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProductionDto, @Req() req: { user?: JwtPayload }) {
    return this.productionService.create(dto, req.user?.sub);
  }
}
