import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions, JwtModuleOptions } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const expiresIn = (process.env.JWT_ACCESS_EXPIRES ??
          '15m') as JwtSignOptions['expiresIn'];
        return {
          secret:
            process.env.JWT_ACCESS_SECRET ??
            process.env.JWT_SECRET ??
            'dev-access-secret',
          signOptions: { expiresIn },
        } satisfies JwtModuleOptions;
      },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
})
export class AuthModule {}
