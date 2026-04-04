import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const ALLOWED_RAW_MATERIAL_UNITS = ['PCS', 'GRAM', 'METER'] as const;

function normalizeUnitInput(value: unknown) {
  const cleaned = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!cleaned) return undefined;
  if (cleaned === 'PC' || cleaned === 'PIECE' || cleaned === 'PIECES')
    return 'PCS';
  if (cleaned === 'G' || cleaned === 'GR') return 'GRAM';
  if (cleaned === 'M' || cleaned === 'METERS' || cleaned === 'MTR')
    return 'METER';
  return cleaned;
}

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
  @Transform(({ value }) => normalizeUnitInput(value))
  @IsString()
  @IsIn(ALLOWED_RAW_MATERIAL_UNITS)
  unit?: (typeof ALLOWED_RAW_MATERIAL_UNITS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
