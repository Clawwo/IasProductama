import { Module } from '@nestjs/common';
import { RawMaterialsService } from './raw-materials.service.js';
import { RawMaterialsController } from './raw-materials.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RawMaterialsController],
  providers: [RawMaterialsService],
})
export class RawMaterialsModule {}
