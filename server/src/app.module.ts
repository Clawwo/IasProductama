import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { InboundModule } from './inbound/inbound.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ItemsModule } from './items/items.module.js';
import { OutboundModule } from './outbound/outbound.module.js';
import { DraftsModule } from './drafts/drafts.module.js';
import { RawMaterialsModule } from './raw-materials/raw-materials.module.js';
import { ProductionModule } from './production/production.module.js';
import { BomModule } from './bom/bom.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    InboundModule,
    OutboundModule,
    AuthModule,
    ItemsModule,
    DraftsModule,
    RawMaterialsModule,
    ProductionModule,
    BomModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtAuthGuard, RolesGuard],
})
export class AppModule {}
