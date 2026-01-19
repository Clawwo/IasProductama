import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class RawMaterialOutboundLineDto {
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

  @IsString()
  @IsNotEmpty()
  batchCode!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRawMaterialOutboundDto {
  @IsString()
  @IsNotEmpty()
  artisan!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RawMaterialOutboundLineDto)
  lines!: RawMaterialOutboundLineDto[];
}
