import { Routes } from '@angular/router';
import { authenticatedGuard, bakerySelectionGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((module) => module.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./shell/authenticated-shell.component').then(
        (module) => module.AuthenticatedShellComponent,
      ),
    canActivate: [authenticatedGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'materials' },
      {
        path: 'select-bakery',
        loadComponent: () =>
          import('./bakeries/bakery-select.component').then(
            (module) => module.BakerySelectComponent,
          ),
      },
      {
        path: 'economy',
        canActivate: [bakerySelectionGuard],
        loadComponent: () =>
          import('./economy/economy.component').then(
            (module) => module.EconomyComponent,
          ),
      },
      {
        path: 'materials',
        canActivate: [bakerySelectionGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./materials/material-list.component').then(
                (module) => module.MaterialListComponent,
              ),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./materials/material-form.component').then(
                (module) => module.MaterialFormComponent,
              ),
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./materials/material-form.component').then(
                (module) => module.MaterialFormComponent,
              ),
          },
          {
            path: ':id/prices',
            loadComponent: () =>
              import('./materials/material-prices.component').then(
                (module) => module.MaterialPricesComponent,
              ),
          },
        ],
      },
      {
        path: 'products',
        canActivate: [bakerySelectionGuard],
        children: [
          {
            path: ':productId/costs',
            loadComponent: () =>
              import('./products/product-costing.component').then(
                (module) => module.ProductCostingComponent,
              ),
          },
          {
            path: '',
            loadComponent: () =>
              import('./products/product-list.component').then(
                (module) => module.ProductListComponent,
              ),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./products/product-form.component').then(
                (module) => module.ProductFormComponent,
              ),
          },
          {
            path: ':productId/edit',
            loadComponent: () =>
              import('./products/product-form.component').then(
                (module) => module.ProductFormComponent,
              ),
          },
          {
            path: ':productId/recipes/:versionId',
            loadComponent: () =>
              import('./products/recipe-editor.component').then(
                (module) => module.RecipeEditorComponent,
              ),
          },
          {
            path: ':productId',
            loadComponent: () =>
              import('./products/product-detail.component').then(
                (module) => module.ProductDetailComponent,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'materials' },
];
