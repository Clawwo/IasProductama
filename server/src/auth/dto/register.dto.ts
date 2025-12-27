import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  // Coerce numeric inputs (e.g., from form fields sent as numbers) into strings
  @Transform(({ value }) =>
    value !== undefined && value !== null ? String(value) : value,
  )
  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
