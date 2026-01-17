import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

@Controller('raw-materials')
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Get()
  findAll() {
    return this.rawMaterialsService.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.rawMaterialsService.findOne(code);
  }

  @Post()
  create(@Body() dto: CreateRawMaterialDto) {
    return this.rawMaterialsService.create(dto);
  }

  @Patch(':code')
  update(@Param('code') code: string, @Body() dto: UpdateRawMaterialDto) {
    return this.rawMaterialsService.update(code, dto);
  }

  @Delete(':code')
  remove(@Param('code') code: string) {
    return this.rawMaterialsService.remove(code);
  }
}
