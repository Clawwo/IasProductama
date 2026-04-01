import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ConvectionService } from './convection.service.js';
import { CreateConvectionItemDto } from './dto/create-convection-item.dto.js';
import { CreateConvectionInboundDto } from './dto/create-convection-inbound.dto.js';
import { CreateConvectionOutboundDto } from './dto/create-convection-outbound.dto.js';
import { UpdateConvectionItemDto } from './dto/update-convection-item.dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('convection')
export class ConvectionController {
  constructor(private readonly convectionService: ConvectionService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get('items')
  listItems() {
    return this.convectionService.listItems();
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post('items')
  createItem(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    )
    dto: CreateConvectionItemDto,
  ) {
    return this.convectionService.createItem(dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Patch('items/:code')
  updateItem(
    @Param('code') code: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    )
    dto: UpdateConvectionItemDto,
  ) {
    return this.convectionService.updateItem(code, dto);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Delete('items/:code')
  removeItem(@Param('code') code: string) {
    return this.convectionService.removeItem(code);
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get('inbound')
  findRecentInbound(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.convectionService.findRecentInbound(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post('inbound')
  createInbound(
    @Body() dto: CreateConvectionInboundDto,
    @Req() req: { user?: JwtPayload },
  ) {
    return this.convectionService.createInbound(dto, req.user?.sub);
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get('outbound')
  findRecentOutbound(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.convectionService.findRecentOutbound(
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post('outbound')
  createOutbound(
    @Body() dto: CreateConvectionOutboundDto,
    @Req() req: { user?: JwtPayload },
  ) {
    return this.convectionService.createOutbound(dto, req.user?.sub);
  }
}
