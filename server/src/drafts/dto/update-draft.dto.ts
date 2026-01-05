import { DraftType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

export class UpdateDraftDto {
  @IsOptional()
  @IsEnum(DraftType)
  type?: DraftType;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
