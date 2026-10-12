import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../generated/prisma/enums.js';

const DECIMAL_QUANTITY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ListProductsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class CreateProductDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsUUID()
  salesUnitId!: string;
}

export class UpdateProductDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  salesUnitId?: string;
}

export class CreateRecipeVersionDto {
  @IsOptional()
  @Matches(DECIMAL_QUANTITY)
  outputQuantity?: string;

  @IsOptional()
  @IsUUID()
  outputUnitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  preparationNotes?: string | null;
}

export class UpdateRecipeVersionDto {
  @IsOptional()
  @Matches(DECIMAL_QUANTITY)
  outputQuantity?: string;

  @IsOptional()
  @IsUUID()
  outputUnitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  preparationNotes?: string | null;
}

export class RecipeMaterialInputDto {
  @IsUUID()
  materialId!: string;

  @Matches(DECIMAL_QUANTITY)
  quantity!: string;

  @IsUUID()
  unitId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ReplaceRecipeMaterialsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RecipeMaterialInputDto)
  items!: RecipeMaterialInputDto[];
}

export class PublishRecipeVersionDto {
  @Matches(DATE_ONLY)
  effectiveFrom!: string;
}
