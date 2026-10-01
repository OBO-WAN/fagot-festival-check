import { InjectionToken } from '@angular/core';

export interface SponsorConfig {
  enabled: boolean;
  adUnitId: string;
}

// A public ad-unit ID, never an API key or wallet credential.
// Supply the owner's AADS unit ID to activate real delivery. An empty ID loads nothing.
export const sponsorConfig: Readonly<SponsorConfig> = {
  enabled: true,
  adUnitId: '',
};

export const SPONSOR_CONFIG = new InjectionToken<Readonly<SponsorConfig>>(
  'Festival sponsor config',
  {
    providedIn: 'root',
    factory: () => sponsorConfig,
  },
);
