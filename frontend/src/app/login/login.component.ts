import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    ReactiveFormsModule,
  ],
  selector: 'app-login',
  template: `
    <main class="grid min-h-screen place-items-center bg-stone-50 px-4 py-10">
      <section class="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-9">
        <p class="text-xs font-extrabold tracking-[.14em] text-emerald-800">PANADERÍA</p>
        <h1 class="my-2 font-serif text-3xl font-medium text-emerald-950">Inicia sesión</h1>
        <p class="mb-6 text-stone-600">Accede al espacio de trabajo de tu panadería.</p>
        <form class="grid gap-2" [formGroup]="form" (ngSubmit)="submit()">
          <label class="mb-2 grid gap-2 text-sm font-medium text-stone-700" for="email">Correo electrónico
            <input nz-input id="email" type="email" autocomplete="username" formControlName="email">
          </label>
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p class="-mt-3 text-sm text-red-700">Escribe un correo electrónico válido.</p>
          }
          <label class="mb-2 grid gap-2 text-sm font-medium text-stone-700" for="password">Contraseña
            <input nz-input id="password" type="password" autocomplete="current-password" formControlName="password">
          </label>
          @if (error()) { <nz-alert class="mb-4 block" nzType="error" [nzMessage]="error()" nzShowIcon /> }
          <button nz-button nzType="primary" class="mt-2 w-full" type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    password: ['', [Validators.required, Validators.maxLength(1024)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim().toLowerCase(), password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/materials');
      },
      error: () => {
        this.error.set('No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }
}
