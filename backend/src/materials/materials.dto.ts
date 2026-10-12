import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
} from 'class-validator';
import {
  MaterialKind,
  MeasurementDimension,
} from '../generated/prisma/enums.js';

const PRICE_DECIMAL = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const QUANTITY_DECIMAL = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const DENSITY_DECIMAL = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,8})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ListMaterialsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsEnum(MaterialKind)
  kind?: MaterialKind;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

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

export class ListUnitsQueryDto {
  @IsOptional()
  @IsEnum(MeasurementDimension)
  dimension?: MeasurementDimension;
}

export class CreateMaterialDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsEnum(MaterialKind)
  kind!: MaterialKind;

  @IsUUID()
  baseUnitId!: string;

  @IsOptional()
  @Matches(DENSITY_DECIMAL)
  densityGramPerMl?: string | null;
}

export class UpdateMaterialDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsEnum(MaterialKind)
  kind?: MaterialKind;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @IsOptional()
  @Matches(DENSITY_DECIMAL)
  densityGramPerMl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMaterialPriceDto {
  @Matches(PRICE_DECIMAL)
  packagePriceCUP!: string;

  @Matches(QUANTITY_DECIMAL)
  packageQuantity!: string;

  @IsUUID()
  packageUnitId!: string;

  @Matches(DATE_ONLY)
  effectiveFrom!: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceNote?: string | null;
}
