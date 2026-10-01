import { InjectionToken } from '@angular/core';

export interface SponsorConfig {
  enabled: boolean;
  adUnitId: string;
}

// A public ad-unit ID, never an API key or wallet credential.
// Unit supplied by the site owner. An empty ID or enabled: false loads nothing.
export const sponsorConfig: Readonly<SponsorConfig> = {
  enabled: true,
  adUnitId: '2457059',
};

export const SPONSOR_CONFIG = new InjectionToken<Readonly<SponsorConfig>>(
  'Festival sponsor config',
  {
    providedIn: 'root',
    factory: () => sponsorConfig,
  },
);
