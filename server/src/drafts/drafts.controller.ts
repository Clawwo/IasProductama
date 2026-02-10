import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DraftType, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DraftsService } from './drafts.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drafts')
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findAll(@Query('type') type?: DraftType) {
    if (type && !Object.values(DraftType).includes(type)) {
      throw new BadRequestException('Tipe draft tidak valid');
    }
    return this.draftsService.findAll(type);
  }

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const draft = await this.draftsService.findOne(id);
    if (!draft) {
      throw new NotFoundException('Draft tidak ditemukan');
    }
    return draft;
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateDraftDto, @Req() req: { user?: JwtPayload }) {
    return this.draftsService.create(dto, req.user?.sub);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.draftsService.remove(id);
  }

  @Roles(Role.ADMIN, Role.PETUGAS)
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDraftDto,
    @Req() req: { user?: JwtPayload },
  ) {
    return this.draftsService.update(id, dto, req.user?.sub);
  }
}
