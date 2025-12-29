import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuthResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    return this.authService.register(dto, this.buildMeta(req));
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponse> {
    return this.authService.login(dto, this.buildMeta(req));
  }

  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    return this.authService.refresh(dto, this.buildMeta(req));
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: JwtPayload }) {
    return this.authService.me(req.user);
  }

  private buildMeta(req: Request) {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null,
    };
  }
}
