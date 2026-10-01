import { TestBed } from '@angular/core/testing';
import { SPONSOR_CONFIG, SponsorConfig } from './sponsor-config';
import { SponsorPanel } from './sponsor-panel';

describe('SponsorPanel', () => {
  function mount(config?: SponsorConfig, preview = false) {
    TestBed.configureTestingModule({
      imports: [SponsorPanel],
      providers: config ? [{ provide: SPONSOR_CONFIG, useValue: config }] : [],
    });
    const fixture = TestBed.createComponent(SponsorPanel);
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges();
    return fixture;
  }

  it('renders no panel or iframe with the shipped default configuration', () => {
    const fixture = mount();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('uses a local sample for a preview, even when a live ID is configured', () => {
    const fixture = mount({ mode: 'live', adUnitId: '1234567' }, true);
    expect(fixture.nativeElement.textContent).toContain('No se carga publicidad externa');
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it.each(['', '123?redirect=https://example.com', '../123', 'https://example.com', '0'])(
    'fails closed for invalid live ID %j',
    (adUnitId) => {
      const fixture = mount({ mode: 'live', adUnitId });
      expect(fixture.nativeElement.querySelector('section')).toBeNull();
      expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    },
  );

  it('restricts a live frame to the configured provider and matching public ID', () => {
    const fixture = mount({ mode: 'live', adUnitId: '1234567' });
    const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe('https://acceptable.a-ads.com/1234567/?size=300x250');
    expect(frame.getAttribute('data-aa')).toBe('1234567');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  });

  it('can be dismissed and emits only an event name and mode', () => {
    const details: unknown[] = [];
    const observe = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('festival:sponsor', observe);
    try {
      const fixture = mount({ mode: 'preview', adUnitId: '' });
      fixture.nativeElement.querySelector('button').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('section')).toBeNull();
      expect(details).toEqual([
        { event: 'panel_rendered', mode: 'preview' },
        { event: 'panel_dismissed', mode: 'preview' },
      ]);
    } finally {
      window.removeEventListener('festival:sponsor', observe);
    }
  });
});
