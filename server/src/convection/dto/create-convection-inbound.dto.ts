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

class ConvectionInboundLineDto {
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
  unit?: string; // KG by default, M supported for kain

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateConvectionInboundDto {
  @IsString()
  @IsNotEmpty()
  vendor!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConvectionInboundLineDto)
  lines!: ConvectionInboundLineDto[];
}
