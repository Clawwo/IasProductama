import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { BomService } from './bom.service.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  async findOne(@Query('code') code?: string, @Query('name') name?: string) {
    if (!code && !name) {
      throw new NotFoundException('Parameter code atau name diperlukan');
    }
    return this.bomService.findOneByCodeOrName(code, name);
  }
}
