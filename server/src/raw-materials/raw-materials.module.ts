import { Module } from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service.js';
import { RawMaterialsController } from './raw-materials.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RawMaterialsController],
  providers: [RawMaterialsService],
})
export class RawMaterialsModule {}
