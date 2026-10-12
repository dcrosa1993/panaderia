import { TestBed } from '@angular/core/testing';
import { SessionStore } from './session-store.service';

describe('SessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps the access token and active bakery in sessionStorage only', () => {
    const session = TestBed.inject(SessionStore);
    session.setToken('short-lived-token');
    session.setActiveBakery('bakery-id');

    expect(sessionStorage.getItem('panaderia.accessToken')).toBe(
      'short-lived-token',
    );
    expect(sessionStorage.getItem('panaderia.activeBakeryId')).toBe(
      'bakery-id',
    );
    expect(localStorage.length).toBe(0);

    session.clear();
    expect(sessionStorage.length).toBe(0);
  });
});
