import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  sessionId!: string;

  @IsString()
  refreshToken!: string;
}
