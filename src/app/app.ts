import { Component, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

type AccessoryRequest = FormGroup<{
  item: FormControl<string>;
  request: FormControl<string>;
  quantity: FormControl<number>;
}>;

const ACCESSORIES = [
  { value: 'Reeds', label: 'Cañas' },
  { value: 'Reed case', label: 'Estuche para cañas' },
  { value: 'Seat strap', label: 'Correa de asiento' },
  { value: 'Neck strap or harness', label: 'Correa de cuello o arnés' },
  { value: 'Hand rest', label: 'Apoyamano' },
  { value: 'Cleaning swab', label: 'Paño de limpieza' },
  { value: 'Bocal', label: 'Tudel (bocal)' },
  { value: 'Reed-making supplies', label: 'Material para fabricar cañas' },
  { value: 'Other', label: 'Otro accesorio' },
];
const ISSUES = [
  { value: 'Notes do not speak', label: 'Hay notas que no responden' },
  { value: 'Unusual resistance or suspected leak', label: 'Resistencia inusual o posible fuga de aire' },
  { value: 'Sticking or noisy keys', label: 'Llaves que se atascan o hacen ruido' },
  { value: 'Loose joint', label: 'Unión floja' },
  { value: 'Bocal or reed fit', label: 'Encaje del tudel o la caña' },
  { value: 'Visible damage', label: 'Daños visibles' },
  { value: 'Other', label: 'Otro problema' },
];

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly accessories = ACCESSORIES;
  protected readonly issues = ISSUES;
  protected readonly selectedIssues = signal<string[]>([]);
  protected readonly status = signal<'idle' | 'sending' | 'success' | 'error'>('idle');
  protected readonly message = signal('');
  protected readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(120)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] }),
    system: new FormControl('', { nonNullable: true, validators: Validators.required }),
    instrumentModel: new FormControl('', { nonNullable: true, validators: Validators.maxLength(160) }),
    ownership: new FormControl('', { nonNullable: true, validators: Validators.required }),
    accessoryRequests: new FormArray<AccessoryRequest>([]),
    accessoryDetails: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
    issueDescription: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    playability: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected get requests(): FormArray<AccessoryRequest> { return this.form.controls.accessoryRequests; }

  protected addRequest(): void {
    if (this.requests.length >= 12) return;
    this.requests.push(new FormGroup({
      item: new FormControl('', { nonNullable: true, validators: Validators.required }),
      request: new FormControl('', { nonNullable: true, validators: Validators.required }),
      quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(20)] }),
    }));
  }

  protected removeRequest(index: number): void { this.requests.removeAt(index); }

  protected toggleIssue(issue: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIssues.update(current => checked ? [...current, issue] : current.filter(value => value !== issue));
  }

  protected async submit(): Promise<void> {
    this.message.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.message.set('Completa los campos obligatorios y revisa tus respuestas.');
      return;
    }
    if (!this.configured) {
      this.message.set('Esta es una vista previa. Conecta Supabase antes de empezar a recoger respuestas.');
      return;
    }
    this.status.set('sending');
    const value = this.form.getRawValue();
    try {
      const client = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
      const { error } = await client.from('festival_intake').insert({
        name: value.name.trim(), email: value.email.trim(), bassoon_system: value.system,
        instrument_model: value.instrumentModel.trim(), ownership: value.ownership,
        accessories: value.accessoryRequests.map(row => ({ item: row.item, request: row.request, quantity: row.quantity })),
        accessory_details: value.accessoryDetails.trim(),
        issues: this.selectedIssues(), issue_description: value.issueDescription.trim(), playability: value.playability,
      });
      if (error) throw error;
      this.status.set('success');
      this.form.reset();
      this.requests.clear();
      this.selectedIssues.set([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      this.status.set('error');
      this.message.set('No hemos podido guardar tu respuesta. Tus datos siguen aquí; inténtalo de nuevo.');
    }
  }
}
