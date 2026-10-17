'use client';
import { useEffect, useState } from 'react';
import type { ConnectionStatus } from '@/lib/gatherly-2/integration/connection-status';
async function readStatus(signal?: AbortSignal): Promise<ConnectionStatus['status']> {
  try {
    const response = await fetch('/api/v2/google/status', { method: 'POST', cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const data = await response.json();
    return response.ok && ['CONNECTED', 'NOT_CONNECTED', 'REAUTH_REQUIRED'].includes(data.status) ? data.status : 'ERROR';
  } catch { return 'ERROR'; }
}
export function GoogleConnection({ consentEnabled, writesEnabled }: { consentEnabled: boolean; writesEnabled: boolean }) {
  const [status, setStatus] = useState<ConnectionStatus['status'] | null>(null);
  const [busy, setBusy] = useState(true);
  function check(signal?: AbortSignal) {
    return readStatus(signal).then(value => { if (!signal?.aborted) { setStatus(value); setBusy(false); } });
  }
  useEffect(() => {
    const controller = new AbortController();
    readStatus(controller.signal).then(value => { if (!controller.signal.aborted) { setStatus(value); setBusy(false); } });
    return () => controller.abort();
  }, []);
  const label = status === 'CONNECTED' ? '연결됨 · 연결 정보 저장 확인' : status === 'NOT_CONNECTED' ? '연결되지 않음' : status === 'REAUTH_REQUIRED' ? '다시 연결 필요' : status === 'ERROR' ? '연결 상태 확인 오류' : '연결 상태 확인 중…';
  return <section aria-labelledby="google-connection-title" className="my-6 rounded-2xl border border-[#173e32]/20 bg-[#f7f4e9] p-5 text-[#173e32]">
    <h2 id="google-connection-title" className="text-lg font-bold">개인 Google Drive·Sheets 연결</h2>
    <p className="my-3">Google 로그인과 별도로 파일 접근에 동의합니다. 연결 정보는 암호화해 보관하며, 이 버튼으로 사진·녹음·메모 파일을 만들지 않습니다.</p>
    {!writesEnabled && <p className="mb-3 font-medium">현재 Google 파일 저장은 비활성 상태입니다.</p>}
    <p role="status" className="my-3 font-semibold">{label}</p>
    <p className="my-3 text-sm">저장된 연결 정보만 확인합니다. Google API 사용 가능 여부는 아직 검사하지 않았으며 토큰을 자동 갱신하지 않습니다.</p>
    <button type="button" disabled={busy} onClick={() => { setBusy(true); void check(); }} className="mb-3 min-h-12 w-full rounded-xl border p-3 disabled:opacity-50">{busy ? '확인 중…' : '연결 상태 확인'}</button>
    <form action="/api/v2/google/connect" method="post">
      <button disabled={!consentEnabled} className="min-h-12 w-full rounded-xl bg-[#173e32] px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50">{status === 'CONNECTED' || status === 'REAUTH_REQUIRED' ? 'Google Drive·Sheets 다시 연결' : 'Google Drive·Sheets 연결하기'}</button>
    </form>
    <p className="mt-3 text-sm">{consentEnabled ? '같은 탭에서 Google 동의 화면으로 이동합니다. 완료 후 연결 정보 저장 결과를 확인해 주세요. 다시 연결할 때도 이 버튼을 사용합니다.' : '연결 설정을 준비 중입니다. 운영자가 접근 동의를 활성화하면 연결할 수 있습니다.'}</p>
  </section>;
}
