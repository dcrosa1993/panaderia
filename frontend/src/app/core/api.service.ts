import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AccessTokenResponse,
  AuthenticatedUser,
  Bakery,
  Material,
  MaterialKind,
  MaterialPriceHistory,
  MeasurementDimension,
  MeasurementUnit,
  PaginatedProducts,
  PaginatedMaterials,
  PricePreview,
  Product,
  ProductStatus,
  RecipeVersionDetail,
  RecipeVersionSummary,
} from './api.models';

const API_BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string) {
    return this.http.post<AccessTokenResponse>(`${API_BASE}/auth/login`, {
      email,
      password,
    });
  }

  currentUser() {
    return this.http.get<AuthenticatedUser>(`${API_BASE}/auth/me`);
  }

  bakeries() {
    return this.http.get<Bakery[]>(`${API_BASE}/bakeries`);
  }

  measurementUnits(dimension?: MeasurementDimension) {
    let params = new HttpParams();
    if (dimension) {
      params = params.set('dimension', dimension);
    }
    return this.http.get<MeasurementUnit[]>(`${API_BASE}/measurement-units`, {
      params,
    });
  }

  materials(filters: {
    page: number;
    pageSize: number;
    search?: string;
    kind?: MaterialKind | '';
    isActive?: boolean | null;
  }) {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.kind) params = params.set('kind', filters.kind);
    if (filters.isActive !== null && filters.isActive !== undefined) {
      params = params.set('isActive', filters.isActive);
    }
    return this.http.get<PaginatedMaterials>(`${API_BASE}/materials`, {
      params,
    });
  }

  material(id: string) {
    return this.http.get<Material>(`${API_BASE}/materials/${id}`);
  }

  createMaterial(input: {
    name: string;
    kind: MaterialKind;
    baseUnitId: string;
    densityGramPerMl?: string;
  }) {
    return this.http.post<Material>(`${API_BASE}/materials`, input);
  }

  updateMaterial(
    id: string,
    input: {
      name: string;
      kind: MaterialKind;
      baseUnitId: string;
      densityGramPerMl?: string | null;
      isActive: boolean;
    },
  ) {
    return this.http.patch<Material>(`${API_BASE}/materials/${id}`, input);
  }

  priceHistory(materialId: string) {
    return this.http.get<MaterialPriceHistory>(
      `${API_BASE}/materials/${materialId}/prices`,
    );
  }

  previewPrice(materialId: string, input: PriceInput) {
    return this.http.post<PricePreview>(
      `${API_BASE}/materials/${materialId}/prices/preview`,
      input,
    );
  }

  createPrice(materialId: string, input: PriceInput) {
    return this.http.post<MaterialPriceHistory['items'][number]>(
      `${API_BASE}/materials/${materialId}/prices`,
      input,
    );
  }

  products(filters: {
    page: number;
    pageSize: number;
    search?: string;
    status?: ProductStatus | '';
  }) {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<PaginatedProducts>(`${API_BASE}/products`, { params });
  }

  product(productId: string) {
    return this.http.get<Product>(`${API_BASE}/products/${productId}`);
  }

  createProduct(input: {
    name: string;
    description?: string | null;
    salesUnitId: string;
  }) {
    return this.http.post<Product>(`${API_BASE}/products`, input);
  }

  updateProduct(
    productId: string,
    input: {
      name?: string;
      description?: string | null;
      status?: ProductStatus;
      salesUnitId?: string;
    },
  ) {
    return this.http.patch<Product>(`${API_BASE}/products/${productId}`, input);
  }

  recipeVersions(productId: string) {
    return this.http.get<RecipeVersionSummary[]>(
      `${API_BASE}/products/${productId}/recipe-versions`,
    );
  }

  createRecipeVersion(
    productId: string,
    input?: {
      outputQuantity?: string;
      outputUnitId?: string;
      preparationNotes?: string | null;
    },
  ) {
    return this.http.post<{
      id: string;
      versionNumber: number;
      clonedFromPublished: boolean;
    }>(`${API_BASE}/products/${productId}/recipe-versions`, input ?? {});
  }

  recipeVersion(productId: string, versionId: string) {
    return this.http.get<RecipeVersionDetail>(
      `${API_BASE}/products/${productId}/recipe-versions/${versionId}`,
    );
  }

  updateRecipeVersion(
    productId: string,
    versionId: string,
    input: {
      outputQuantity?: string;
      outputUnitId?: string;
      preparationNotes?: string | null;
    },
  ) {
    return this.http.patch<RecipeVersionDetail>(
      `${API_BASE}/products/${productId}/recipe-versions/${versionId}`,
      input,
    );
  }

  replaceRecipeMaterials(
    productId: string,
    versionId: string,
    items: Array<{
      materialId: string;
      quantity: string;
      unitId: string;
      notes?: string | null;
    }>,
  ) {
    return this.http.put<RecipeVersionDetail>(
      `${API_BASE}/products/${productId}/recipe-versions/${versionId}/materials`,
      { items },
    );
  }

  publishRecipeVersion(
    productId: string,
    versionId: string,
    effectiveFrom: string,
  ) {
    return this.http.post<RecipeVersionDetail>(
      `${API_BASE}/products/${productId}/recipe-versions/${versionId}/publish`,
      { effectiveFrom },
    );
  }
}

export interface PriceInput {
  packagePriceCUP: string;
  packageQuantity: string;
  packageUnitId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sourceNote?: string | null;
}
