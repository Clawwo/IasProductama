import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { InboundModule } from './inbound/inbound.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ItemsModule } from './items/items.module.js';

@Module({
  imports: [PrismaModule, UsersModule, InboundModule, AuthModule, ItemsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
