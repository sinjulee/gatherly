import { session } from '@/lib/gatherly-2/auth/server';
import { connectionStatusResponse } from '@/lib/gatherly-2/integration/connection-status';
import { vault } from '@/lib/gatherly-2/integration/runtime';
export async function POST(request: Request) {
  return connectionStatusResponse(request, async () => (await session()).user.id, vault);
}
