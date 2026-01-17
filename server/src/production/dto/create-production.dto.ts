import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ProductionRawLineDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsIn(['ITEM', 'BAHAN_BAKU'])
  sourceType?: 'ITEM' | 'BAHAN_BAKU';

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

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class ProductionFinishedLineDto {
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

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateProductionDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionRawLineDto)
  rawLines!: ProductionRawLineDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionFinishedLineDto)
  finishedLines!: ProductionFinishedLineDto[];
}
