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
} from '@nestjs/common';
import { DraftType } from '@prisma/client';
import { DraftsService } from './drafts.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';

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
  create(@Body() dto: CreateDraftDto) {
    return this.draftsService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.draftsService.remove(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    return this.draftsService.update(id, dto);
  }
}
