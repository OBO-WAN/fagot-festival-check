import { Component, AfterViewInit, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SPONSOR_CONFIG } from './sponsor-config';

@Component({
  selector: 'app-sponsor-panel',
  templateUrl: './sponsor-panel.html',
  styleUrl: './sponsor-panel.css',
})
export class SponsorPanel implements AfterViewInit {
  readonly preview = input(false);
  private readonly config = inject(SPONSOR_CONFIG);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dismissed = signal(false);
  private frameLoaded = false;

  protected readonly mode = computed(() => (this.preview() ? 'preview' : this.config.mode));
  protected readonly unitId = this.config.adUnitId.trim();
  protected readonly frameUrl = computed(() => {
    if (this.mode() !== 'live' || !/^[1-9]\d{0,19}$/.test(this.unitId)) return null;
    // Only a validated numeric ID can enter this fixed provider URL.
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://acceptable.a-ads.com/${this.unitId}/?size=300x250`,
    );
  });
  protected readonly visible = computed(
    () => !this.dismissed() && (this.mode() === 'preview' || this.frameUrl() !== null),
  );

  ngAfterViewInit(): void {
    if (this.visible()) this.record('panel_rendered');
  }

  protected onFrameLoad(): void {
    if (this.frameLoaded) return;
    this.frameLoaded = true;
    this.record('frame_loaded');
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    this.record('panel_dismissed');
  }

  private record(event: 'panel_rendered' | 'frame_loaded' | 'panel_dismissed'): void {
    // Local observation only: no persistence, network request, or survey data.
    // A frame load is not proof of a visible or billable ad impression.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('festival:sponsor', {
          detail: { event, mode: this.mode() },
        }),
      );
    }
  }
}
