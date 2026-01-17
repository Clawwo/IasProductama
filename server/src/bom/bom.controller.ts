import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { BomService } from './bom.service.js';

@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get()
  async findOne(@Query('code') code?: string, @Query('name') name?: string) {
    if (!code && !name) {
      throw new NotFoundException('Parameter code atau name diperlukan');
    }
    return this.bomService.findOneByCodeOrName(code, name);
  }
}
