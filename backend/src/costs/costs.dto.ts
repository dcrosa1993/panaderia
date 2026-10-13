import { IsOptional, IsUUID, Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCostCalculationDto {
  @Matches(DATE_ONLY)
  valuationDate!: string;

  @IsOptional()
  @IsUUID()
  recipeVersionId?: string;
}
