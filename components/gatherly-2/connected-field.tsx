'use client';
import type { Exhibitor, Hotspot } from '@/lib/gatherly-2/contracts';
import { syncWorkspace } from '@/lib/gatherly-2/integration/browser-sync';
import { FieldPrototype } from './field-prototype';
export function ConnectedField({ userId, fieldDayId, exhibitors, hotspots, chunkedMedia = false, namespace }: { userId: string; fieldDayId: string; exhibitors: Exhibitor[]; hotspots: Hotspot[]; chunkedMedia?: boolean; namespace: string }) {
  return <FieldPrototype namespace={namespace} key={`${userId}:${fieldDayId}`} connected={{ userId, fieldDayId, exhibitors, hotspots, sync: workspace => syncWorkspace(workspace, userId, fetch, chunkedMedia) }} />;
}
