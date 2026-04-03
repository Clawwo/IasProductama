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

class RawMaterialInboundLineDto {
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

export class CreateRawMaterialInboundDto {
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
  @Type(() => RawMaterialInboundLineDto)
  lines!: RawMaterialInboundLineDto[];
}
