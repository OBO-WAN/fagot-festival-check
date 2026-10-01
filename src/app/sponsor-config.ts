import { InjectionToken } from '@angular/core';

export interface SponsorConfig {
  mode: 'off' | 'preview' | 'live';
  adUnitId: string;
}

// A public ad-unit ID, never an API key or wallet credential.
// Enable live mode only after AADS approves the site and placement.
export const sponsorConfig: Readonly<SponsorConfig> = {
  mode: 'off',
  adUnitId: '',
};

export const SPONSOR_CONFIG = new InjectionToken<Readonly<SponsorConfig>>(
  'Festival sponsor config',
  {
    providedIn: 'root',
    factory: () => sponsorConfig,
  },
);
