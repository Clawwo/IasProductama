import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ItemsService } from './items.service.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.itemsService.findOne(code);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(code, dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.itemsService.remove(code);
  }
}
