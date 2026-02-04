import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(user: User): Omit<User, 'password'> {
    // Remove password before returning to callers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  async create(data: CreateUserDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const role = data.role ?? Role.PETUGAS;
    return this.prisma.user.create({ data: { ...data, role } });
  }

  async createWithPlainPassword(
    data: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const hashed = await bcrypt.hash(data.password, 10);
    const created = await this.create({ ...data, password: hashed });
    return this.sanitize(created);
  }

  async update(
    id: string,
    data: UpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    if (data.email && data.email !== existing.email) {
      const dupe = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (dupe && dupe.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    const password = data.password
      ? await bcrypt.hash(data.password, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: data.email ?? existing.email,
        name: data.name ?? existing.name,
        role: data.role ?? existing.role,
        isActive: data.isActive ?? existing.isActive,
        password: password ?? existing.password,
      },
    });

    return this.sanitize(updated);
  }

  async remove(id: string): Promise<Omit<User, 'password'>> {
    const deleted = await this.prisma.user
      .delete({ where: { id } })
      .catch((err) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
        throw err;
      });
    return this.sanitize(deleted);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async ensureSeedAdmin(defaultAdmin: CreateUserDto) {
    const admin = await this.prisma.user.findFirst({
      where: { role: Role.ADMIN },
    });
    if (!admin) {
      await this.prisma.user.create({
        data: {
          ...defaultAdmin,
          role: defaultAdmin.role ?? Role.ADMIN,
        },
      });
    }
  }

  async findAll(q?: string): Promise<Array<Omit<User, 'password'>>> {
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
