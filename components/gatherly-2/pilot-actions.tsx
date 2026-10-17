'use client';
import { useState } from 'react';
import { BrowserWorkspace } from '@/lib/gatherly-2/browser-storage';
import { syncPilot, pilotStatus } from '@/lib/gatherly-2/integration/pilot-browser';
export function PilotActions({ userId, namespace, enabled }: { userId: string; namespace: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('사진 1장·녹음 1건·메모 1건만 전송합니다. 전송 후에도 로컬 원본은 유지됩니다.');
  async function run(check: boolean) {
    if (!enabled || busy) return;
    setBusy(true); setNotice(check ? 'Google에서 다시 확인 중…' : '업로드 및 원격 저장 확인 중…');
    try {
      if (check) {
        const states = await pilotStatus(userId);
        const labels: Record<string, string> = { VERIFIED: '원격 재조회 성공', NOT_UPLOADED: '미전송', PENDING: '저장 대기', SHEET_PENDING: 'Drive 확인 완료 · Sheets 반영 재시도 필요' };
        setNotice(['photo', 'audio', 'note'].map((k, i) => `${['사진', '녹음', '메모'][i]}: ${labels[states[k]] ?? '확인 실패'}`).join(' · '));
      } else setNotice(await syncPilot(new BrowserWorkspace(`gatherly-v2-${namespace}-storage-test`), userId));
    } catch (error) { setNotice(error instanceof Error ? error.message : '확인 실패. 원본은 보관됩니다.'); }
    finally { setBusy(false); window.dispatchEvent(new Event('gatherly-pilot-updated')); }
  }
  return <section className="v2-card" aria-labelledby="pilot-title"><h2 id="pilot-title" className="text-lg font-bold">3건 Google 실저장 테스트</h2><p>전용 테스트 폴더와 Sheets를 사용합니다. 처음 전송한 자료는 다른 자료로 교체할 수 없습니다.</p><p role="status" className="v2-status">{notice}</p>{!enabled && <p>현재 원격 쓰기 비활성 또는 실증 대상 계정이 아닙니다.</p>}<div className="v2-actions"><button className="v2-button v2-button-primary" disabled={!enabled || busy} onClick={() => void run(false)}>3건 업로드 · 실패 재시도</button><button className="v2-button" disabled={!enabled || busy} onClick={() => void run(true)}>Google에서 저장 결과 다시 조회</button></div></section>;
}
