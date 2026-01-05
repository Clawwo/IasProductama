import { DraftType } from '@prisma/client';
import { IsEnum, IsObject } from 'class-validator';

export class CreateDraftDto {
  @IsEnum(DraftType)
  type!: DraftType;

  @IsObject()
  payload!: Record<string, unknown>;
}
