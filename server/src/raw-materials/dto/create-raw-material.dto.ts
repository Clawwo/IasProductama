import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateRawMaterialDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
