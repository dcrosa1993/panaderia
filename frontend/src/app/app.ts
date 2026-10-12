import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly session = this.auth.session;

  selectBakery(event: Event): void {
    const bakeryId = (event.target as HTMLSelectElement).value;
    if (!this.session.bakeries().some((bakery) => bakery.id === bakeryId)) {
      return;
    }
    this.session.setActiveBakery(bakeryId);
    void this.router.navigate(['/materials']);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
