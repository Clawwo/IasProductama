import { PartialType } from '@nestjs/mapped-types';
import { CreateConvectionItemDto } from './create-convection-item.dto.js';

export class UpdateConvectionItemDto extends PartialType(
  CreateConvectionItemDto,
) {}
