import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { PriceTaxTreatment } from '../generated/prisma/enums.js';

const DECIMAL = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
const MONEY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTaxAssignmentDto {
  @IsUUID()
  taxRuleVersionId!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveFrom?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  configurationNotes?: string | null;
}

export class UpdateTaxAssignmentDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveFrom?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY)
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  configurationNotes?: string | null;
}

export class CreatePriceScenarioDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @Matches(MONEY)
  salePriceCUP!: string;

  @Matches(DECIMAL)
  projectedQuantity!: string;

  @IsEnum(PriceTaxTreatment)
  salePriceTaxTreatment!: PriceTaxTreatment;

  @IsOptional()
  @Matches(MONEY)
  discountsReturnsCUP?: string;

  @IsOptional()
  @Matches(MONEY)
  otherOperatingExpensesCUP?: string | null;

  @IsOptional()
  @Matches(DECIMAL)
  targetNetMarginPercent?: string | null;
}
