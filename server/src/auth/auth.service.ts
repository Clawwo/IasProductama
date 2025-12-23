import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: Omit<User, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private get refreshConfig() {
    const expiresIn = process.env.JWT_REFRESH_EXPIRES ?? '7d';

    return {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      expiresIn,
    };
  }

  private buildPayload(user: User): JwtPayload {
    return { sub: user.id, email: user.email, role: user.role };
  }

  private async signTokens(user: User): Promise<TokenPair> {
    const payload = this.buildPayload(user);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshOptions: JwtSignOptions = {
      secret: this.refreshConfig.secret,
      expiresIn: this.refreshConfig.expiresIn as JwtSignOptions['expiresIn'],
    };
    const refreshToken = await this.jwtService.signAsync(
      payload,
      refreshOptions,
    );
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({ ...dto, password: hashed });
    const tokens = await this.signTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.signTokens(user);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.refreshConfig.secret,
        },
      );
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const tokens = await this.signTokens(user);
      return { ...tokens, user: this.sanitizeUser(user) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(payload: JwtPayload): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitizeUser(user);
  }
}
