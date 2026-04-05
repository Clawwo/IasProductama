import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

const CONVECTION_ALLOWED_EMAILS = new Set([
  'gudangwetan@gmail.com',
  'admin@gmail.com',
]);

@Injectable()
export class ConvectionAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) return false;

    if (user.role === Role.ADMIN) return true;

    const email = (user.email ?? '').trim().toLowerCase();
    return CONVECTION_ALLOWED_EMAILS.has(email);
  }
}
