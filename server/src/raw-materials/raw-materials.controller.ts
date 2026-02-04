import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RawMaterialsService } from './raw-materials.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { CreateRawMaterialOutboundDto } from './dto/create-raw-material-outbound.dto.js';
import { ReceiveRawMaterialOutboundLineDto } from './dto/receive-raw-material-outbound-line.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('raw-materials')
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findAll() {
    return this.rawMaterialsService.findAll();
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get('outbound')
  findOutbound(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.rawMaterialsService.findOutboundRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post('outbound')
  createOutbound(@Body() dto: CreateRawMaterialOutboundDto) {
    return this.rawMaterialsService.createOutbound(dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Patch('outbound/lines/:id/receive')
  receiveOutboundLine(
    @Param('id') id: string,
    @Body() dto: ReceiveRawMaterialOutboundLineDto,
  ) {
    return this.rawMaterialsService.receiveOutboundLine(id, dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.rawMaterialsService.findOne(code);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  create(@Body() dto: CreateRawMaterialDto) {
    return this.rawMaterialsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateRawMaterialDto) {
    return this.rawMaterialsService.update(code, dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.rawMaterialsService.remove(code);
  }
}
