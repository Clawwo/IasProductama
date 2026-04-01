import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { HistoryService } from './history.service.js';

type HistoryDirectionParam = 'Masuk' | 'Keluar';
type HistoryCategoryParam = 'Barang' | 'Konveksi' | 'Bahan baku' | 'Produksi';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Roles(Role.ADMIN, Role.PETUGAS, Role.PELIHAT)
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const allowedType: Array<HistoryDirectionParam | 'all'> = [
      'all',
      'Masuk',
      'Keluar',
    ];
    const allowedCategory: Array<HistoryCategoryParam | 'all'> = [
      'all',
      'Barang',
      'Konveksi',
      'Bahan baku',
      'Produksi',
    ];

    if (type && !allowedType.includes(type as HistoryDirectionParam | 'all')) {
      throw new BadRequestException('Parameter type tidak valid');
    }

    if (
      category &&
      !allowedCategory.includes(category as HistoryCategoryParam | 'all')
    ) {
      throw new BadRequestException('Parameter category tidak valid');
    }

    const parsedPage = Number(page);
    const parsedPerPage = Number(perPage);

    return this.historyService.findPaged({
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      perPage: Number.isFinite(parsedPerPage) ? parsedPerPage : undefined,
      type: (type as HistoryDirectionParam | 'all' | undefined) ?? 'all',
      category: (category as HistoryCategoryParam | 'all' | undefined) ?? 'all',
      search,
      fromDate,
      toDate,
    });
  }
}
