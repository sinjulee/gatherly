import { IntegrationError } from '@/lib/gatherly-2/integration/config';
import { PilotSessions } from '@/components/gatherly-2/pilot-sessions';
import { requireWriteUser } from '@/lib/gatherly-2/integration/write-access';
import { session } from '@/lib/gatherly-2/auth/server';
import { environment } from '@/lib/gatherly-2/integration/environment';
import { GoogleConnection } from '@/components/gatherly-2/google-connection';
export const dynamic = 'force-dynamic';
export default async function StorageTestPage() {
  const result = await session().then(value => value, () => null);
  if (!result) return <main className="v2-shell"><h1>승인 사용자 전용</h1><p>로그인과 내부 접근 승인이 필요합니다.</p><a href="/v2">로그인 화면으로</a></main>;
  let writes = false; let blockedReason = '서버 정책상 차단: 원격 쓰기 비활성 또는 실증 대상 계정이 아닙니다.';
  try { requireWriteUser(result.user.id); writes = true; } catch (error) {
    if (error instanceof IntegrationError && error.code === 'FORBIDDEN') blockedReason = '서버 정책상 차단: 이 계정 또는 환경은 단일 사용자 실증 대상이 아닙니다.';
    else if (process.env.GATHERLY_V2_GOOGLE_WRITES_ENABLED !== 'true') blockedReason = '서버 정책상 차단: Google 원격 쓰기 설정이 꺼져 있습니다.';
    else blockedReason = '서버 정책상 차단: 단일 쓰기 사용자 또는 서버 환경 설정을 확인해야 합니다.';
  }
  return <main className="bg-[#f7f4e9] text-[#173e32]"><div className="v2-shell"><nav className="v2-actions"><a className="v2-button" href="/v2">연결 화면으로 돌아가기</a></nav><GoogleConnection consentEnabled={process.env.GATHERLY_V2_GOOGLE_CONSENT_ENABLED === 'true'} writesEnabled={writes} /></div><PilotSessions userId={result.user.id} namespace={environment()} enabled={writes} blockedReason={blockedReason} /></main>;
}
