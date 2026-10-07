import { SupabaseClient } from '@supabase/supabase-js';
import { loadResponses } from './organizer-loader';

function record(index: number) {
  return { id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, created_at: '2026-10-07T06:00:00.123456+00:00', name: `Participant ${index}` };
}

function clientWithPages(pages: { data: unknown; error: unknown; count?: number }[]) {
  const filters: string[] = [];
  const limit = vi.fn();
  const from = vi.fn(() => {
    const page = pages.shift();
    const query = {
      select: () => query, order: () => query,
      limit: (size: number) => { limit(size); return query; },
      or: (filter: string) => { filters.push(filter); return query; },
      then: (resolve: (result: unknown) => void) => Promise.resolve(page).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, filters, limit };
}

describe('Loading all organizer responses', () => {
  it('loads beyond the first page using both timestamp precision and UUID as the cursor', async () => {
    const first = Array.from({ length: 200 }, (_, index) => record(500 - index));
    const mock = clientWithPages([{ data: first, error: null }, { data: [record(300)], error: null }]);
    const rows = await loadResponses(mock.client);
    expect(rows).toHaveLength(201);
    expect(mock.from).toHaveBeenCalledTimes(2);
    expect(mock.limit).toHaveBeenCalledWith(200);
    expect(mock.filters[0]).toContain('created_at.lt.2026-10-07T06:00:00.123456+00:00');
    expect(mock.filters[0]).toContain('id.lt.00000000-0000-0000-0000-000000000301');
  });

  it('rejects a later page failure instead of presenting/exporting partial totals', async () => {
    const mock = clientWithPages([{ data: Array.from({ length: 200 }, (_, index) => record(index + 1)), error: null }, { data: null, error: new Error('Denied') }]);
    await expect(loadResponses(mock.client)).rejects.toThrow('Responses could not be loaded');
  });

  it('continues through short pages when the server caps results below the requested page size', async () => {
    const mock = clientWithPages([
      { data: [record(3)], error: null, count: 3 },
      { data: [record(2)], error: null, count: 2 },
      { data: [record(1)], error: null, count: 1 },
    ]);
    expect(await loadResponses(mock.client)).toHaveLength(3);
    expect(mock.from).toHaveBeenCalledTimes(3);
  });

  it('fails safely when pagination does not advance or a cursor is malformed', async () => {
    const repeated = Array.from({ length: 200 }, (_, index) => record(index + 1));
    await expect(loadResponses(clientWithPages([{ data: repeated, error: null }, { data: repeated, error: null }]).client)).rejects.toThrow('did not advance');
    await expect(loadResponses(clientWithPages([{ data: [{ id: 'bad', created_at: 'bad' }], error: null }]).client)).rejects.toThrow('Unexpected response data');
  });
});
