/**
 * Auto-paginate Supabase queries to bypass PostgREST 1000-row limit.
 *
 * ใช้กับ query ที่ผลลัพธ์อาจ > 1000 rows เช่น audit_logs, production_events, oee_snapshots
 * แบบช่วงเวลายาว
 *
 * Usage:
 *   const rows = await fetchAllPages(
 *     (from, to) => supabase
 *       .from('production_events')
 *       .select('*')
 *       .gte('start_ts', start)
 *       .lte('start_ts', end)
 *       .order('start_ts', { ascending: false })
 *       .range(from, to)
 *   );
 *
 * Note: query function ต้องใช้ .range(from, to) — helper จะส่ง offset เพิ่มทีละ chunk
 */

import type { PostgrestError } from "@supabase/supabase-js";

type RangeQuery<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

interface FetchAllOptions {
  /** ขนาด chunk แต่ละหน้า (default 1000 = PostgREST default max) */
  pageSize?: number;
  /** จำนวน rows สูงสุดที่ดึง (กันลูปยาวเกินไป default 50000) */
  maxRows?: number;
}

export async function fetchAllPages<T>(
  query: RangeQuery<T>,
  options: FetchAllOptions = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxRows = options.maxRows ?? 50_000;
  const all: T[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await query(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break; // หน้าสุดท้าย
  }

  return all;
}
