import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ReceiveRawMaterialOutboundLineDto {
  @IsString()
  @IsNotEmpty()
  receivedBy!: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
