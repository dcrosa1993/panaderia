import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  selector: 'app-login',
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <p class="eyebrow">PANADERÍA</p>
        <h1>Inicia sesión</h1>
        <p class="muted">Accede al espacio de trabajo de tu panadería.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="email">Correo electrónico</label>
          <input id="email" type="email" autocomplete="username" formControlName="email">
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <small>Escribe un correo electrónico válido.</small>
          }
          <label for="password">Contraseña</label>
          <input id="password" type="password" autocomplete="current-password" formControlName="password">
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
    .auth-card { width: min(100%, 27rem); padding: 2rem; background: white; border: 1px solid #e4e6df; border-radius: 1rem; box-shadow: 0 18px 50px #26382a12; }
    .eyebrow { color: #346b43; font-size: .75rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: .5rem 0; font-family: Georgia, serif; font-size: 2rem; }
    .muted { color: #66716a; margin-bottom: 1.5rem; }
    form { display: grid; gap: .65rem; }
    label { font-weight: 650; margin-top: .4rem; }
    input { width: 100%; border: 1px solid #cbd4ca; border-radius: .55rem; padding: .75rem; font: inherit; }
    small, .error { color: #a33127; }
    button { margin-top: .75rem; padding: .8rem; border: 0; border-radius: .55rem; color: white; background: #28643a; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .55; cursor: not-allowed; }
  `],
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
