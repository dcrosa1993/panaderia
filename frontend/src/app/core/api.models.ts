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
}
