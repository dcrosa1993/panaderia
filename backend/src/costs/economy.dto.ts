import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AllocationMethod, OverheadCategory } from '../generated/prisma/enums.js';

const DECIMAL = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const MONEY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLaborRoleDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  name!: string;
}

export class UpdateLaborRoleDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLaborRateDto {
  @Matches(MONEY)
  hourlyRateCUP!: string;

  @Matches(DATE_ONLY)
  effectiveFrom!: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class RecipeLaborOperationInputDto {
  @IsUUID()
  laborRoleId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  operationName!: string;

  @Matches(DECIMAL)
  durationMinutes!: string;

  @Matches(DECIMAL)
  workersCount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ReplaceRecipeLaborOperationsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeLaborOperationInputDto)
  items!: RecipeLaborOperationInputDto[];
}

export class CreateOverheadExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsEnum(OverheadCategory)
  category?: OverheadCategory;

  @Matches(MONEY)
  amountCUP!: string;

  @Matches(DATE_ONLY)
  periodStart!: string;

  @Matches(DATE_ONLY)
  periodEnd!: string;

  @IsEnum(AllocationMethod)
  allocationMethod!: AllocationMethod;

  @IsOptional()
  @Matches(DECIMAL)
  allocationBaseQuantity?: string | null;

  @IsOptional()
  @IsUUID()
  allocationUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class UpdateOverheadExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsEnum(OverheadCategory)
  category?: OverheadCategory;

  @IsOptional()
  @Matches(MONEY)
  amountCUP?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  periodStart?: string;

  @IsOptional()
  @Matches(DATE_ONLY)
  periodEnd?: string;

  @IsOptional()
  @IsEnum(AllocationMethod)
  allocationMethod?: AllocationMethod;

  @IsOptional()
  @Matches(DECIMAL)
  allocationBaseQuantity?: string | null;

  @IsOptional()
  @IsUUID()
  allocationUnitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}
