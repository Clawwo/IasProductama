import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRawMaterialDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
