export interface RequestedAccessory {
  item: string;
  request: string;
  quantity: number | null;
}

export interface FestivalResponse {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  system: string;
  model: string;
  ownership: string;
  accessories: RequestedAccessory[];
  accessoryDetails: string;
  issues: string[];
  issueDescription: string;
  playability: string;
}

export interface MaterialTotal {
  item: string;
  buy: number;
  borrow: number;
  advice: number;
  unclassified: number;
}

const text = (value: unknown): string => typeof value === 'string' ? value : '';

export function normalizeResponse(row: Record<string, unknown>): FestivalResponse {
  const accessories = Array.isArray(row['accessories']) ? row['accessories'] : [];
  return {
    id: text(row['id']), createdAt: text(row['created_at']), name: text(row['name']),
    email: text(row['email']), system: text(row['bassoon_system']),
    model: text(row['instrument_model']), ownership: text(row['ownership']),
    accessories: accessories.map(value => {
      const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      const quantity = item['quantity'];
      return {
        item: text(item['item']) || 'Accesorio sin especificar',
        request: text(item['request']) || 'Solicitud sin especificar',
        quantity: typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 && quantity <= 20 ? quantity : null,
      };
    }),
    accessoryDetails: text(row['accessory_details']),
    issues: Array.isArray(row['issues']) ? row['issues'].filter((value): value is string => typeof value === 'string') : [],
    issueDescription: text(row['issue_description']), playability: text(row['playability']),
  };
}

export function materialTotals(responses: FestivalResponse[]): MaterialTotal[] {
  const totals = new Map<string, MaterialTotal>();
  for (const response of responses) {
    for (const accessory of response.accessories) {
      const row = totals.get(accessory.item) ?? { item: accessory.item, buy: 0, borrow: 0, advice: 0, unclassified: 0 };
      if (accessory.request === 'Pedir asesoramiento') row.advice += 1;
      else if (accessory.request === 'Comprar' && accessory.quantity !== null) row.buy += accessory.quantity;
      else if (accessory.request === 'Pedir prestado' && accessory.quantity !== null) row.borrow += accessory.quantity;
      else row.unclassified += 1;
      totals.set(accessory.item, row);
    }
  }
  return Array.from(totals.values()).sort((a, b) => a.item.localeCompare(b.item, 'es'));
}

// Submitted text is untrusted. Quoting alone does not stop spreadsheet formulas.
function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function makeCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function responsesCsv(responses: FestivalResponse[]): string {
  return makeCsv([
    ['Referencia', 'Fecha (UTC)', 'Nombre', 'Correo', 'Sistema', 'Marca y modelo', 'Propiedad', 'Accesorios', 'Detalles de accesorios', 'Problemas', 'Descripción de problemas', 'Puede tocar'],
    ...responses.map(row => [row.id, row.createdAt, row.name, row.email, row.system, row.model, row.ownership,
      row.accessories.map(item => `${item.request}: ${item.quantity ?? 'cantidad no indicada'} · ${item.item}`).join('\n'),
      row.accessoryDetails, row.issues.join('\n'), row.issueDescription, row.playability]),
  ]);
}

export function materialsCsv(totals: MaterialTotal[]): string {
  return makeCsv([
    ['Accesorio', 'Comprar (unidades)', 'Préstamo (unidades)', 'Asesoramiento (solicitudes)', 'Solicitudes sin clasificar'],
    ...totals.map(row => [row.item, row.buy, row.borrow, row.advice, row.unclassified]),
  ]);
}
