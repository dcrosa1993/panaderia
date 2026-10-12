import { Routes } from '@angular/router';
import { authenticatedGuard, bakerySelectionGuard } from './core/auth.guards';
import { App } from './app';
import { BakerySelectComponent } from './bakeries/bakery-select.component';
import { LoginComponent } from './login/login.component';
import { MaterialFormComponent } from './materials/material-form.component';
import { MaterialListComponent } from './materials/material-list.component';
import { MaterialPricesComponent } from './materials/material-prices.component';
import { ProductDetailComponent } from './products/product-detail.component';
import { ProductFormComponent } from './products/product-form.component';
import { ProductListComponent } from './products/product-list.component';
import { RecipeEditorComponent } from './products/recipe-editor.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: App,
    canActivate: [authenticatedGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'materials' },
      { path: 'select-bakery', component: BakerySelectComponent },
      {
        path: 'materials',
        canActivate: [bakerySelectionGuard],
        children: [
          { path: '', component: MaterialListComponent },
          { path: 'new', component: MaterialFormComponent },
          { path: ':id/edit', component: MaterialFormComponent },
          { path: ':id/prices', component: MaterialPricesComponent },
        ],
      },
      {
        path: 'products',
        canActivate: [bakerySelectionGuard],
        children: [
          { path: '', component: ProductListComponent },
          { path: 'new', component: ProductFormComponent },
          { path: ':productId/edit', component: ProductFormComponent },
          {
            path: ':productId/recipes/:versionId',
            component: RecipeEditorComponent,
          },
          { path: ':productId', component: ProductDetailComponent },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'materials' },
];
