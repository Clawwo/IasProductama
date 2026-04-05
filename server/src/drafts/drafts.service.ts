import { Injectable } from '@nestjs/common';
import { DraftType, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';

type DraftPagedQuery = {
  type?: DraftType;
  draftKind?: 'CONVECTION_INBOUND' | 'CONVECTION_OUTBOUND';
  page?: number;
  perPage?: number;
};

@Injectable()
export class DraftsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDraftDto, userId?: string) {
    return this.prisma.draft.create({
      data: {
        type: dto.type,
        payload: dto.payload as Prisma.InputJsonValue,
        createdById: userId ?? undefined,
        updatedById: userId ?? undefined,
      },
    });
  }

  findAll(type?: DraftType) {
    return this.prisma.draft.findMany({
      where: type ? { type } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findPaged(query: DraftPagedQuery) {
    const page =
      Number.isFinite(query.page) && (query.page ?? 0) > 0
        ? Number(query.page)
        : 1;
    const perPageRaw =
      Number.isFinite(query.perPage) && (query.perPage ?? 0) > 0
        ? Number(query.perPage)
        : 20;
    const perPage = Math.min(perPageRaw, 100);

    const where: Prisma.DraftWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.draftKind
        ? {
            payload: {
              path: ['draftKind'],
              equals: query.draftKind,
            },
          }
        : {}),
    };

    const total = await this.prisma.draft.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(page, pageCount);
    const skip = (currentPage - 1) * perPage;

    const data = await this.prisma.draft.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      data,
      total,
      page: currentPage,
      perPage,
      pageCount,
    };
  }

  findOne(id: string) {
    return this.prisma.draft.findUnique({ where: { id } });
  }

  remove(id: string) {
    return this.prisma.draft.delete({ where: { id } });
  }

  update(id: string, dto: UpdateDraftDto, userId?: string) {
    const data: Prisma.DraftUpdateInput = {};
    if (dto.type) data.type = dto.type;
    if (dto.payload) data.payload = dto.payload as Prisma.InputJsonValue;
    if (userId) data.updatedBy = { connect: { id: userId } };
    return this.prisma.draft.update({ where: { id }, data });
  }
}
