import type { SupabaseClient } from '@supabase/supabase-js';
import type { Exhibitor, Hotspot, PublicCatalogRepository } from '../contracts';
import { validHotspot } from '../map';
import { IntegrationError } from './config';
export const REFERENCE_SHA = '5351a36d4f9a08026d6dd0666a2cd840ff81cd65a490226a37d92fdc12b0f0d8';
export class SupabaseCatalog implements PublicCatalogRepository {
  constructor(private client: SupabaseClient) {}
  async list(exhibitionId: string): Promise<Exhibitor[]> {
    const { data, error } = await this.client.from('g2_exhibitors').select('id,company_id,exhibition_id,source_id,summary,g2_companies!inner(name),g2_exhibitor_booths(g2_booths(code))').eq('exhibition_id', exhibitionId);
    if (error) throw new IntegrationError('RETRY', 503);
    return (data ?? []).map(row => {
      const company = row.g2_companies as unknown as { name: string };
      const links = row.g2_exhibitor_booths as unknown as { g2_booths: { code: string } | null }[];
      return { id: row.id, companyId: row.company_id, exhibitionId: row.exhibition_id, name: company.name, summary: row.summary, sourceId: row.source_id, booth: links.map(b => b.g2_booths?.code).filter(Boolean).join(', ') || null, review: 'PUBLISHED' };
    });
  }
  async hotspots(exhibitionId: string, exhibitors: Exhibitor[], sha256: string): Promise<Hotspot[]> {
    const { data: maps, error } = await this.client.from('g2_maps').select('id,version').eq('exhibition_id', exhibitionId).eq('sha256', sha256);
    if (error) throw new IntegrationError('RETRY', 503);
    if (maps?.length !== 1) return [];
    const map = maps[0];
    const { data, error: spotsError } = await this.client.from('g2_hotspots').select('id,x,y,width,height,g2_booths!inner(g2_exhibitor_booths(exhibitor_id))').eq('map_id', map.id).eq('verified', true);
    if (spotsError) throw new IntegrationError('RETRY', 503);
    return (data ?? []).flatMap(row => {
      const booth = row.g2_booths as unknown as { g2_exhibitor_booths: { exhibitor_id: string }[] };
      // Shared booths stay list-only until a multi-company selection UI is approved.
      if (booth.g2_exhibitor_booths.length !== 1) return [];
      const exhibitor = exhibitors.find(e => e.id === booth.g2_exhibitor_booths[0].exhibitor_id);
      const h: Hotspot = { id: row.id, exhibitionId, exhibitorId: exhibitor?.id ?? '', mapVersion: map.version, review: 'VERIFIED', geometry: { x: Number(row.x), y: Number(row.y), width: Number(row.width), height: Number(row.height) } };
      return exhibitor && exhibitor.review === 'PUBLISHED' && validHotspot(h, exhibitor, map.version) ? [h] : [];
    });
  }
}
