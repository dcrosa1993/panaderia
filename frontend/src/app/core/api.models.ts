export type MaterialKind =
  | 'INGREDIENT'
  | 'PACKAGING'
  | 'CONSUMABLE'
  | 'FUEL'
  | 'OTHER';

export type MeasurementDimension =
  | 'MASS'
  | 'VOLUME'
  | 'COUNT'
  | 'TIME'
  | 'LENGTH'
  | 'AREA'
  | 'ENERGY'
  | 'OTHER';

export type MembershipRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type RecipeVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
}

export interface AccessTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface Bakery {
  id: string;
  name: string;
  role: MembershipRole;
}

export interface MeasurementUnit {
  id: string;
  code: string;
  name: string;
  dimension: MeasurementDimension;
  conversionFactor: string;
}

export interface MaterialPrice {
  id: string;
  packagePriceCUP: string;
  packageQuantity: string;
  packageUnit: MeasurementUnit;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceNote: string | null;
  normalizedQuantityInBaseUnit: string;
  pricePerBaseUnitCUP: string;
  baseUnit: MeasurementUnit;
}

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  isActive: boolean;
  densityGramPerMl: string | null;
  baseUnit: MeasurementUnit;
  currentPrice: MaterialPrice | null;
}

export interface PaginatedMaterials {
  items: Material[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MaterialPriceHistory {
  material: { id: string; name: string; baseUnit: MeasurementUnit };
  items: MaterialPrice[];
}

export interface PricePreview {
  packagePriceCUP: string;
  packageQuantity: string;
  packageUnit: MeasurementUnit;
  baseUnit: MeasurementUnit;
  normalizedQuantityInBaseUnit: string;
  pricePerBaseUnitCUP: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  salesUnit: Pick<MeasurementUnit, 'id' | 'code' | 'name' | 'dimension'>;
  recipeSummary: {
    draftVersionNumber: number | null;
    publishedVersion: {
      versionNumber: number;
      outputQuantity: string;
      outputUnit: Pick<MeasurementUnit, 'id' | 'code' | 'name'>;
      effectiveFrom: string | null;
      effectiveTo: string | null;
    } | null;
    recipeStatus: 'NO_RECIPE' | 'DRAFT_AVAILABLE' | 'PUBLISHED';
    versionCount?: number;
  };
}

export interface PaginatedProducts {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RecipeVersionSummary {
  id: string;
  versionNumber: number;
  status: RecipeVersionStatus;
  outputQuantity: string;
  outputUnit: Pick<MeasurementUnit, 'id' | 'code' | 'name'>;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  materialCount: number;
}

export interface RecipeMaterialLine {
  id: string;
  materialId: string;
  material: Pick<Material, 'id' | 'name' | 'kind' | 'isActive' | 'baseUnit'>;
  quantity: string;
  unit: Pick<MeasurementUnit, 'id' | 'code' | 'name' | 'dimension'>;
  position: number;
  notes: string | null;
}

export interface RecipeVersionDetail {
  id: string;
  productId: string;
  versionNumber: number;
  status: RecipeVersionStatus;
  outputQuantity: string;
  outputUnit: Pick<MeasurementUnit, 'id' | 'code' | 'name' | 'dimension'>;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  preparationNotes: string | null;
  materials: RecipeMaterialLine[];
  laborOperations: RecipeLaborOperation[];
}

export interface RecipeLaborOperation {
  id: string;
  laborRoleId: string;
  laborRole: { id: string; name: string; isActive: boolean };
  operationName: string;
  durationMinutes: string;
  workersCount: string;
  position: number;
  notes: string | null;
}

export interface CostCalculationLine {
  id: string;
  lineType: string;
  descriptionSnapshot: string;
  quantity: string | null;
  unitNameSnapshot: string | null;
  unitCostCUP: string | null;
  totalCUP: string | null;
  detailsSnapshot: unknown;
}

export interface CostCalculation {
  id: string;
  recipeVersionId: string;
  valuationDate: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'FAILED';
  materialCostCUP: string | null;
  laborCostCUP: string | null;
  overheadCostCUP: string | null;
  totalProductionCostCUP: string | null;
  outputQuantity: string | null;
  outputUnitSnapshot: string | null;
  unitCostCUP: string | null;
  incompleteReasons: Array<{ category: string; code: string; message: string }>;
  inputSnapshot?: unknown;
  lines?: CostCalculationLine[];
  createdAt?: string;
}

export interface LaborRole {
  id: string;
  name: string;
  isActive: boolean;
  currentRate?: string | null;
}

export interface LaborRate {
  id: string;
  hourlyRateCUP: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface OverheadExpense {
  id: string;
  name: string;
  category: string;
  amountCUP: string;
  periodStart: string;
  periodEnd: string;
  allocationMethod: string;
  allocationBaseQuantity: string | null;
  allocationUnitId: string | null;
  allocationUnit: Pick<MeasurementUnit, 'id' | 'code' | 'name' | 'dimension'> | null;
  notes: string | null;
}

export interface TaxRuleVersion {
  id: string;
  versionNumber: number;
  calculationMethod: string;
  taxBase: string;
  rate: string | null;
  fixedAmountCUP: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verificationStatus: string;
}

export interface TaxRule {
  id: string;
  code: string;
  name: string;
  category: string;
  versions: TaxRuleVersion[];
}

export interface TaxAssignment {
  id: string;
  enabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  configurationNotes: string | null;
  taxRule: { code: string; name: string; category: string };
  taxRuleVersion: Pick<TaxRuleVersion, 'versionNumber' | 'calculationMethod' | 'taxBase' | 'rate' | 'verificationStatus'>;
}

export interface PriceScenario {
  id: string;
  calculationId: string;
  name: string;
  status: 'CALCULATED' | 'INCOMPLETE' | 'DRAFT' | 'FAILED';
  salePriceCUP: string;
  projectedQuantity: string;
  salePriceTaxTreatment: string;
  discountsReturnsCUP: string;
  grossSalesCUP: string | null;
  netSalesCUP: string | null;
  costOfSalesCUP: string | null;
  otherOperatingExpensesCUP: string | null;
  salesTaxCUP: string | null;
  profitBeforeProfitTaxCUP: string | null;
  profitTaxCUP: string | null;
  profitAfterTaxCUP: string | null;
  netMarginPercent: string | null;
  calculationSnapshot: {
    incompleteReasons?: Array<{ category: string; code: string; message: string }>;
    warnings?: string[];
    preTaxRevenueEstimateCUP?: string | null;
    customerTotalCUP?: string | null;
    breakEvenPriceCUP?: string | null;
    breakEvenPriceTaxTreatment?: string;
    recommendedPriceCUP?: string | null;
    recommendedPriceTaxTreatment?: string;
  } | null;
  taxLines: Array<{
    id: string;
    taxNameSnapshot: string;
    taxBaseSnapshot: string;
    baseAmountCUP: string | null;
    rateApplied: string | null;
    taxAmountCUP: string | null;
    verificationStatusSnapshot: string;
    notesSnapshot: string | null;
  }>;
}
