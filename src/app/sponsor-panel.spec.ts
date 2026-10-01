import { TestBed } from '@angular/core/testing';
import { SPONSOR_CONFIG, SponsorConfig } from './sponsor-config';
import { SponsorPanel } from './sponsor-panel';

describe('SponsorPanel', () => {
  function mount(config?: SponsorConfig) {
    TestBed.configureTestingModule({
      imports: [SponsorPanel],
      providers: config ? [{ provide: SPONSOR_CONFIG, useValue: config }] : [],
    });
    const fixture = TestBed.createComponent(SponsorPanel);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the owner-provided ad unit with the shipped configuration', () => {
    const fixture = mount();
    const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
    expect(frame.getAttribute('data-aa')).toBe('2457059');
    expect(frame.getAttribute('src')).toBe('https://ad.a-ads.com/2457059/?size=300x250');
  });

  it('does not load the provider when disabled, even with a valid ID', () => {
    const fixture = mount({ enabled: false, adUnitId: '1234567' });
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it.each(['', '123?redirect=https://example.com', '../123', 'https://example.com', '0'])(
    'fails closed for invalid live ID %j',
    (adUnitId) => {
      const fixture = mount({ enabled: true, adUnitId });
      expect(fixture.nativeElement.querySelector('section')).toBeNull();
      expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    },
  );

  it('restricts a live frame to the configured provider and matching public ID', () => {
    const fixture = mount({ enabled: true, adUnitId: '1234567' });
    const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe('https://ad.a-ads.com/1234567/?size=300x250');
    expect(frame.getAttribute('data-aa')).toBe('1234567');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  });

  it('can be dismissed and emits only an event name and provider', () => {
    const details: unknown[] = [];
    const observe = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('festival:sponsor', observe);
    try {
      const fixture = mount({ enabled: true, adUnitId: '1234567' });
      fixture.nativeElement.querySelector('button').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('section')).toBeNull();
      expect(details).toEqual([
        { event: 'panel_rendered', provider: 'aads' },
        { event: 'panel_dismissed', provider: 'aads' },
      ]);
    } finally {
      window.removeEventListener('festival:sponsor', observe);
    }
  });
});
