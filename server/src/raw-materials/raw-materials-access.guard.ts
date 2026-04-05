import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

const RAW_MATERIAL_ALLOWED_EMAILS = new Set([
  'gudangkulon@gmail.com',
  'admin@gmail.com',
]);

@Injectable()
export class RawMaterialsAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) return false;

    if (user.role === Role.ADMIN) {
      return true;
    }

    const email = (user.email ?? '').trim().toLowerCase();
    return RAW_MATERIAL_ALLOWED_EMAILS.has(email);
  }
}
