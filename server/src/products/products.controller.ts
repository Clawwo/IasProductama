import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.productsService.findOne(code);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(code, dto);
  }

  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.productsService.remove(code);
  }
}
