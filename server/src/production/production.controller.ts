import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get()
  findRecent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.productionService.findRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProductionDto, @Req() req: { user?: JwtPayload }) {
    return this.productionService.create(dto, req.user?.sub);
  }
}
