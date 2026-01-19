import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service.js';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto.js';
import { CreateRawMaterialOutboundDto } from './dto/create-raw-material-outbound.dto.js';
import { ReceiveRawMaterialOutboundLineDto } from './dto/receive-raw-material-outbound-line.dto.js';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto.js';

@Controller('raw-materials')
export class RawMaterialsController {
  constructor(private readonly rawMaterialsService: RawMaterialsService) {}

  @Get()
  findAll() {
    return this.rawMaterialsService.findAll();
  }

  @Get('outbound')
  findOutbound(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.rawMaterialsService.findOutboundRecent(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Post('outbound')
  createOutbound(@Body() dto: CreateRawMaterialOutboundDto) {
    return this.rawMaterialsService.createOutbound(dto);
  }

  @Patch('outbound/lines/:id/receive')
  receiveOutboundLine(
    @Param('id') id: string,
    @Body() dto: ReceiveRawMaterialOutboundLineDto,
  ) {
    return this.rawMaterialsService.receiveOutboundLine(id, dto);
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
