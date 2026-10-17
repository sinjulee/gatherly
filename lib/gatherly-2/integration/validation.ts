import { IntegrationError } from './config';
import type { RemoteRecord } from './storage';
export function parseRecord(value: unknown): RemoteRecord {
  if (!value || typeof value !== 'object') throw new IntegrationError('INVALID');
  const r = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const name of ['id', 'fieldDayId', 'exhibitorId']) if (typeof r[name] !== 'string' || !uuid.test(r[name])) throw new IntegrationError('INVALID');
  if (!Number.isSafeInteger(r.revision) || Number(r.revision) < 1 || !['NOTE', 'MEDIA'].includes(String(r.kind)) || typeof r.title !== 'string' || r.title.length > 120 || (r.kind === 'NOTE' && (typeof r.text !== 'string' || !r.text.trim() || r.text.length > 500))) throw new IntegrationError('INVALID');
  return { id: r.id as string, fieldDayId: r.fieldDayId as string, exhibitorId: r.exhibitorId as string, title: r.title, revision: Number(r.revision), kind: r.kind as RemoteRecord['kind'], ...(r.kind === 'NOTE' ? { text: r.text as string } : {}) };
}
