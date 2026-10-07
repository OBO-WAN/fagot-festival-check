import { makeCsv, materialTotals, normalizeResponse, responsesCsv } from './organizer-data';

describe('Organizer summaries and CSV exports', () => {
  const row = (accessories: unknown[] = []) => normalizeResponse({
    id: '00000000-0000-0000-0000-000000000001', created_at: '2026-10-07T06:00:00+00:00',
    name: 'Participant', email: 'person@example.com', accessories,
  });

  it('separates purchased/borrowed units from advice requests and retains unknown requests', () => {
    const rows = [row([
      { item: 'Cañas', request: 'Comprar', quantity: 2 },
      { item: 'Cañas', request: 'Comprar', quantity: 3 },
      { item: 'Cañas', request: 'Pedir prestado', quantity: 4 },
      { item: 'Cañas', request: 'Pedir asesoramiento', quantity: 12 },
      { item: 'Cañas', request: 'Comprar', quantity: -1 },
      { item: 'Cañas', request: 'Unknown', quantity: 1 },
    ])];
    expect(materialTotals(rows)).toEqual([{ item: 'Cañas', buy: 5, borrow: 4, advice: 1, unclassified: 2 }]);
  });

  it('handles empty and malformed optional data without treating it as markup', () => {
    expect(materialTotals([])).toEqual([]);
    const normalized = normalizeResponse({ name: '<img src=x onerror=alert(1)>', accessories: [null, { quantity: '3' }], issues: ['A', null] });
    expect(normalized.name).toContain('<img');
    expect(normalized.issues).toEqual(['A']);
    expect(normalized.accessories.map(item => item.quantity)).toEqual([null, null]);
    expect(materialTotals([normalized])[0].unclassified).toBe(2);
  });

  it('exports accents, commas, quotes and multiline answers as UTF-8 CSV', () => {
    const response = row();
    response.name = 'José, "A"';
    response.issueDescription = 'Primera línea\nSegunda línea';
    const csv = responsesCsv([response]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"José, ""A"""');
    expect(csv).toContain('"Primera línea\nSegunda línea"');
    expect(csv).toContain('"person@example.com"');
  });

  it('neutralizes spreadsheet formulas including whitespace and control-character prefixes', () => {
    const csv = makeCsv([['=HYPERLINK("url")', '+1+2', '-2+3', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1', 'Normal', 3]]);
    for (const unsafe of ["'=HYPERLINK", "'+1+2", "'-2+3", "'@SUM", "'  =1+1", "'\t=1+1", "'\r=1+1"]) expect(csv).toContain(unsafe);
    expect(csv).toContain('"Normal","3"');
  });
});
