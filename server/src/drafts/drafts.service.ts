import { Injectable } from '@nestjs/common';
import { DraftType, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';

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
