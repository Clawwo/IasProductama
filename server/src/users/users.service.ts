import { ConflictException, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      await this.prisma.user.create({ data: defaultAdmin });
    }
  }
}
