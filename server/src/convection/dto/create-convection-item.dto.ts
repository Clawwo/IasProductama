import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

function normalizeUnitInput(value: unknown) {
  const cleaned = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!cleaned) return undefined;
  if (cleaned === 'PASANG') return 'SET';
  if (cleaned === 'M' || cleaned === 'METERS' || cleaned === 'MTR')
    return 'METER';
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'OZ' || cleaned === 'ONZ') return 'ONS';
  return cleaned;
}

export class CreateConvectionItemDto {
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
  @Transform(({ value }) => normalizeUnitInput(value))
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  metersPerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockBase?: number;
}
