import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizerDashboard } from './organizer-dashboard';
import { ORGANIZER_CLIENT } from './organizer-client';

describe('Private organizer dashboard', () => {
  const session = { user: { email: 'organizer@example.com' } };
  const row = { id: '00000000-0000-0000-0000-000000000001', created_at: '2026-10-07T06:00:00+00:00', name: '<img src=x onerror=alert(1)>', email: 'participant@example.com', playability: 'No', accessories: [{ item: 'Cañas', request: 'Comprar', quantity: 2 }] };
  let authChanged: (event: string) => void;
  let result: Promise<{ data: unknown[]; error: unknown }>;
  let client: any;

  beforeEach(() => {
    result = Promise.resolve({ data: [row], error: null });
    const query: any = { select: () => query, order: () => query, limit: () => query, then: (resolve: any) => result.then(resolve) };
    client = {
      from: vi.fn(() => query), rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      auth: {
        onAuthStateChange: vi.fn((callback: (event: string) => void) => { authChanged = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
        getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        signOut: vi.fn().mockImplementation(async () => { authChanged('SIGNED_OUT'); return { error: null }; }),
      },
    };
    TestBed.configureTestingModule({ imports: [OrganizerDashboard], providers: [provideRouter([]), { provide: ORGANIZER_CLIENT, useValue: client }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(OrganizerDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.loading-message')).toBeNull();
    });
    return fixture;
  }

  it('shows login and never fetches responses without a session', async () => {
    client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('#organizer-password')).not.toBeNull();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('requires an explicit true authorization result before fetching any answers', async () => {
    client.rpc.mockResolvedValue({ data: 'true', error: null });
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Esta cuenta no tiene acceso');
    expect(client.from).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('participant@example.com');
  });

  it('shows authorized details as plain text and accurate material quantities', async () => {
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(host.textContent).toContain('participant@example.com');
    Array.from(host.querySelectorAll<HTMLButtonElement>('.view-tabs button'))[1].click();
    fixture.detectChanges();
    expect(host.querySelector('tbody tr')?.textContent).toContain('Cañas');
    expect(host.querySelector('tbody td')?.textContent).toBe('2');
  });

  it('clears answers on logout and signs out only the current session', async () => {
    const fixture = await render();
    fixture.nativeElement.querySelector('.account-bar button').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(fixture.nativeElement.textContent).not.toContain('participant@example.com');
    expect(fixture.nativeElement.querySelector('#organizer-password')).not.toBeNull();
  });

  it('discards a pending data response after the session signs out', async () => {
    let resolve!: (value: { data: unknown[]; error: unknown }) => void;
    result = new Promise(done => { resolve = done; });
    const fixture = TestBed.createComponent(OrganizerDashboard);
    fixture.detectChanges();
    await vi.waitFor(() => expect(client.from).toHaveBeenCalled());
    authChanged('SIGNED_OUT');
    resolve({ data: [row], error: null });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('participant@example.com');
    expect(fixture.nativeElement.querySelector('#organizer-password')).not.toBeNull();
  });

  it('does not display partial data when fetching fails', async () => {
    result = Promise.resolve({ data: [], error: new Error('Denied') });
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar las respuestas');
    expect(fixture.nativeElement.querySelector('.response-list')).toBeNull();
  });

  it('keeps answers hidden and reports a failed sign-out instead of claiming it succeeded', async () => {
    client.auth.signOut.mockResolvedValue({ error: new Error('Offline') });
    const fixture = await render();
    fixture.nativeElement.querySelector('.account-bar button').click();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No se pudo cerrar la sesión');
    });
    expect(fixture.nativeElement.textContent).not.toContain('participant@example.com');
  });

  it('clears the password field after password sign-in', async () => {
    client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const fixture = await render();
    const host: HTMLElement = fixture.nativeElement;
    for (const [id, value] of [['organizer-email', 'organizer@example.com'], ['organizer-password', 'example-password']]) {
      const input = host.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(client.auth.signInWithPassword).toHaveBeenCalledOnce();
    client.auth.signOut.mockImplementation(async () => { authChanged('SIGNED_OUT'); return { error: null }; });
    host.querySelector<HTMLButtonElement>('.account-bar button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector<HTMLInputElement>('#organizer-password')!.value).toBe('');
  });
});
