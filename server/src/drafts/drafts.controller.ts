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
  Req,
  UseGuards,
} from '@nestjs/common';
import { DraftType } from '@prisma/client';
import { DraftsService } from './drafts.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

@Controller('drafts')
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  findAll(@Query('type') type?: DraftType) {
    if (type && !Object.values(DraftType).includes(type)) {
      throw new BadRequestException('Tipe draft tidak valid');
    }
    return this.draftsService.findAll(type);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const draft = await this.draftsService.findOne(id);
    if (!draft) {
      throw new NotFoundException('Draft tidak ditemukan');
    }
    return draft;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateDraftDto, @Req() req: { user?: JwtPayload }) {
    return this.draftsService.create(dto, req.user?.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.draftsService.remove(id);
  }

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
