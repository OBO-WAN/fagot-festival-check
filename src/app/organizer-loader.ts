import { SupabaseClient } from '@supabase/supabase-js';
import { FestivalResponse, normalizeResponse } from './organizer-data';

const columns = 'id,created_at,name,email,bassoon_system,instrument_model,ownership,accessories,accessory_details,issues,issue_description,playability';
const pageSize = 200;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export async function loadResponses(client: SupabaseClient): Promise<FestivalResponse[]> {
  const responses: FestivalResponse[] = [];
  let cursor: { id: string; createdAt: string } | null = null;
  let previousId = '';
  while (true) {
    let query = client.from('festival_intake').select(columns, { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize);
    if (cursor) {
      // Keyset pagination avoids skipped/duplicated rows when new submissions arrive.
      query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    const { data, error, count } = await query;
    if (error || !Array.isArray(data)) throw new Error('Responses could not be loaded');
    for (const row of data) {
      if (!row || typeof row !== 'object' || !uuid.test(row['id']) || !timestamp.test(row['created_at'])) {
        throw new Error('Unexpected response data');
      }
      responses.push(normalizeResponse(row));
    }
    if (data.length === 0) {
      if (count) throw new Error('Responses could not be loaded');
      return responses;
    }
    // The server may cap pages below 200. Its exact remaining count tells us
    // whether a short page is really the end, rather than silently truncating.
    if (data.length < pageSize && (count == null || count <= data.length)) return responses;
    const last = responses[responses.length - 1];
    if (previousId === last.id) throw new Error('Response pagination did not advance');
    previousId = last.id;
    cursor = { id: last.id, createdAt: last.createdAt };
  }
}
