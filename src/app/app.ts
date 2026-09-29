import { Component, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

type AccessoryRequest = FormGroup<{
  item: FormControl<string>;
  request: FormControl<string>;
  quantity: FormControl<number>;
}>;

const ACCESSORIES = ['Reeds', 'Reed case', 'Seat strap', 'Neck strap or harness', 'Hand rest', 'Cleaning swab', 'Bocal', 'Reed-making supplies', 'Other'];
const ISSUES = ['Notes do not speak', 'Unusual resistance or suspected leak', 'Sticking or noisy keys', 'Loose joint', 'Bocal or reed fit', 'Visible damage', 'Other'];

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
      this.message.set('Please complete the required fields and check your answers.');
      return;
    }
    if (!this.configured) {
      this.message.set('This is a draft preview. Connect a Supabase project before collecting responses.');
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
      this.message.set('We could not save your response. Your answers are still here; please try again.');
    }
  }
}
