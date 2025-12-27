import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './strategies/jwt.strategy';

type RequestMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface AuthResponse extends TokenPair {
  user: Omit<User, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private readonly refreshTtlMs =
    Number(process.env.SESSION_TTL_MS ?? 0) > 0
      ? Number(process.env.SESSION_TTL_MS)
      : 1000 * 60 * 60 * 24 * 7; // default 7 days

  private get accessConfig(): JwtSignOptions {
    const expiresIn = (process.env.JWT_ACCESS_EXPIRES ??
      process.env.JWT_EXPIRES_IN ??
      '15m') as JwtSignOptions['expiresIn'];

    return {
      secret:
        process.env.JWT_ACCESS_SECRET ??
        process.env.JWT_SECRET ??
        'dev-access-secret',
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

  private computeRefreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlMs);
  }

  private async signAccessToken(
    user: User,
    sessionId: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    return this.jwtService.signAsync(payload, this.accessConfig);
  }

  private async createSession(
    user: User,
    meta?: RequestMeta,
  ): Promise<SessionTokens> {
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = this.computeRefreshExpiry();

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: meta?.userAgent ?? null,
        ipAddress: meta?.ipAddress ?? null,
        expiresAt,
      },
    });

    const accessToken = await this.signAccessToken(user, session.id);

    return { accessToken, refreshToken, sessionId: session.id };
  }

  private async validateRefreshSession(dto: RefreshTokenDto) {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { user: true },
    });

    const expired =
      session?.expiresAt && session.expiresAt.getTime() <= Date.now();

    if (!session || session.revokedAt || expired || !session.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const match = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );
    if (!match) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return session;
  }

  async register(dto: RegisterDto, meta?: RequestMeta): Promise<AuthResponse> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const role = dto.role ?? Role.PETUGAS;
    const user = await this.usersService.create({
      ...dto,
      password: hashed,
      role,
    });
    const tokens = await this.createSession(user, meta);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto, meta?: RequestMeta): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.createSession(user, meta);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refresh(
    dto: RefreshTokenDto,
    meta?: RequestMeta,
  ): Promise<AuthResponse> {
    const session = await this.validateRefreshSession(dto);
    const user = session.user;

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = this.computeRefreshExpiry();

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        expiresAt,
        revokedAt: null,
        userAgent: meta?.userAgent ?? session.userAgent,
        ipAddress: meta?.ipAddress ?? session.ipAddress,
      },
    });

    const accessToken = await this.signAccessToken(user, session.id);

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: this.sanitizeUser(user),
    };
  }

  async logout(dto: RefreshTokenDto) {
    const session = await this.validateRefreshSession(dto);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async me(payload: JwtPayload): Promise<Omit<UserModel, 'password'>> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return this.sanitizeUser(user);
  }
}
