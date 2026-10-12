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
