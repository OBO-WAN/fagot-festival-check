import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SPONSOR_CONFIG } from './sponsor-config';

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert }) }),
}));

describe('Survey sponsorship placement', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SPONSOR_CONFIG, useValue: { enabled: true, adUnitId: '1234567' } }],
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  function readyForm() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const input = (selector: string, value: string, event = 'input') => {
      const element = host.querySelector(selector) as HTMLInputElement;
      element.value = value;
      element.dispatchEvent(new Event(event, { bubbles: true }));
    };
    input('#student-name', 'Test participant');
    input('input[type=email]', 'test@example.com');
    input('#bassoon-system', 'Alemán (Heckel)', 'change');
    input('#ownership', 'Es mío', 'change');
    (host.querySelector('input[type=radio][value="Sí"]') as HTMLInputElement).click();
    fixture.detectChanges();
    return fixture;
  }

  it('loads one real provider frame before submission and closing it preserves confirmation', async () => {
    const fixture = readyForm();
    expect(fixture.nativeElement.querySelectorAll('iframe[data-aa]').length).toBe(1);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(insert).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Gracias. Nos vemos en el festival.');
    expect(fixture.nativeElement.querySelector('app-sponsor-panel section')).not.toBeNull();
    fixture.nativeElement.querySelector('.dismiss-button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Gracias. Nos vemos en el festival.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('keeps answers and the independent footer banner when saving fails', async () => {
    insert.mockResolvedValue({ error: new Error('Test save failure') });
    const fixture = readyForm();
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('iframe[data-aa]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('#student-name').value).toBe('Test participant');
    expect(fixture.nativeElement.textContent).toContain('No hemos podido guardar tu respuesta');
  });

  it('does not turn a legacy preview URL into a fake survey or sample ad', () => {
    window.history.replaceState({}, '', '/?sponsor-preview=1');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(insert).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('iframe[data-aa]').length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('VISTA PREVIA');
    expect(fixture.nativeElement.textContent).not.toContain('RESPUESTA RECIBIDA');
  });
});
