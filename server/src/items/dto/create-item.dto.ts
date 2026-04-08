import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const ALLOWED_ITEM_UNITS = ['PCS', 'GRAM', 'METER'] as const;

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

export class CreateItemDto {
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
  @IsIn(ALLOWED_ITEM_UNITS)
  unit?: (typeof ALLOWED_ITEM_UNITS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitWeightOns?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;
}
