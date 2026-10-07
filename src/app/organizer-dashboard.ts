import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ORGANIZER_CLIENT } from './organizer-client';
import { FestivalResponse, materialTotals, materialsCsv, responsesCsv } from './organizer-data';
import { loadResponses } from './organizer-loader';

type View = 'checking' | 'signed-out' | 'forbidden' | 'ready' | 'error';

@Component({
  selector: 'app-organizer-dashboard',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './organizer-dashboard.html',
  styleUrl: './organizer-dashboard.css',
})
export class OrganizerDashboard {
  private readonly client = inject(ORGANIZER_CLIENT);
  protected readonly available = this.client !== null;
  private readonly destroyRef = inject(DestroyRef);
  private generation = 0;
  protected readonly view = signal<View>('checking');
  protected readonly responses = signal<FestivalResponse[]>([]);
  protected readonly message = signal('');
  protected readonly account = signal('');
  protected readonly authBusy = signal(false);
  protected readonly tab = signal<'responses' | 'materials'>('responses');
  protected readonly materials = computed(() => materialTotals(this.responses()));
  protected readonly difficultyCount = computed(() => this.responses().filter(row => row.playability === 'Con dificultad' || row.playability === 'No').length);
  protected readonly accessoryCount = computed(() => this.responses().filter(row => row.accessories.length > 0).length);
  protected readonly unclassifiedCount = computed(() => this.materials().reduce((sum, row) => sum + row.unclassified, 0));
  protected readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  constructor() {
    afterNextRender(() => { void this.initialize(); });
    this.destroyRef.onDestroy(() => { this.generation += 1; this.responses.set([]); });
  }

  private signedOut(): void {
    this.generation += 1;
    this.responses.set([]);
    this.account.set('');
    this.view.set('signed-out');
    this.authBusy.set(false);
  }

  private async initialize(): Promise<void> {
    if (!this.client) { this.view.set('signed-out'); this.message.set('El acceso al panel aún no está disponible.'); return; }
    const { data: listener } = this.client.auth.onAuthStateChange(event => {
      // Do not make asynchronous Supabase calls inside the auth callback.
      if (event === 'SIGNED_OUT') this.signedOut();
    });
    this.destroyRef.onDestroy(() => listener.subscription.unsubscribe());
    const generation = this.generation;
    try {
      const { data, error } = await this.client.auth.getSession();
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (error) throw error;
      if (data.session) { this.account.set(data.session.user.email ?? ''); await this.refresh(); }
      else this.signedOut();
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) { this.signedOut(); this.message.set('No se pudo comprobar la sesión. Vuelve a iniciar sesión.'); }
    }
  }

  protected async login(): Promise<void> {
    if (!this.client || this.authBusy()) return;
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    this.authBusy.set(true);
    this.message.set('');
    const values = this.loginForm.getRawValue();
    const generation = this.generation;
    try {
      const { data, error } = await this.client.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (error || !data.session) { this.message.set('No se pudo iniciar sesión. Comprueba tu correo y contraseña.'); return; }
      this.account.set(data.session.user.email ?? '');
      await this.refresh();
    } catch {
      if (!this.destroyRef.destroyed) this.message.set('No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      this.loginForm.controls.password.reset();
      this.authBusy.set(false);
    }
  }

  protected async refresh(): Promise<void> {
    if (!this.client) return;
    const generation = ++this.generation;
    this.responses.set([]);
    this.message.set('');
    this.view.set('checking');
    try {
      const { data: allowed, error } = await this.client.rpc('festival_organizer_access');
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (error) throw error;
      if (allowed !== true) { this.view.set('forbidden'); return; }
      const rows = await loadResponses(this.client);
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      this.responses.set(rows);
      this.view.set('ready');
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) {
        this.view.set('error');
        this.message.set('No se pudieron cargar las respuestas. Puedes volver a intentarlo.');
      }
    }
  }

  protected async logout(): Promise<void> {
    if (!this.client || this.authBusy()) return;
    this.generation += 1;
    this.responses.set([]);
    this.view.set('checking');
    this.authBusy.set(true);
    this.message.set('');
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      this.signedOut();
    } catch {
      this.view.set('error');
      this.message.set('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    } finally { this.authBusy.set(false); }
  }

  protected exportCsv(kind: 'responses' | 'materials'): void {
    if (this.view() !== 'ready' || this.responses().length === 0) return;
    const content = kind === 'responses' ? responsesCsv(this.responses()) : materialsCsv(this.materials());
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `festival-${kind === 'responses' ? 'respuestas' : 'materiales'}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
