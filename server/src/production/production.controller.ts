import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';

@Controller('api/production')
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
  create(@Body() dto: CreateProductionDto) {
    return this.productionService.create(dto);
  }
}
