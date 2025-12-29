import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  // Coerce numeric inputs (e.g., from form fields sent as numbers) into strings
  @Transform(({ value }) => (value !== undefined && value !== null ? String(value) : value))
  @IsString()
  @MinLength(6)
  password!: string;
}
