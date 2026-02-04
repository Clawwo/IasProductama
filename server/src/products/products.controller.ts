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
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.productsService.findOne(code);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(code, dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.productsService.remove(code);
  }
}
