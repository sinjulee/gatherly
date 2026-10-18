'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserWorkspace } from '@/lib/gatherly-2/browser-storage';
import type { SyncItem } from '@/lib/gatherly-2/contracts';
import { pilotReadiness, type PilotKind } from '@/lib/gatherly-2/pilot-ui';
import { syncPilot, pilotStatus } from '@/lib/gatherly-2/integration/pilot-browser';
import type { PilotSessionView } from '@/lib/gatherly-2/integration/pilot-session';
export function PilotActions({ userId, namespace, enabled, blockedReason, run }: { userId: string; namespace: string; enabled: boolean; blockedReason?: string; run?: PilotSessionView }) {
  const [workspace] = useState(() => new BrowserWorkspace(`gatherly-v2-${namespace}-storage-test`));
  const [rows, setRows] = useState<SyncItem[]>([]), [deleted, setDeleted] = useState<PilotKind[]>([]);
  const [loaded, setLoaded] = useState(false), [localError, setLocalError] = useState('');
  const [supported, setSupported] = useState(false), [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [notice, setNotice] = useState('사진 1장·녹음 1건·메모 1건을 준비해 주세요. 전송 후에도 로컬 원본은 유지됩니다.');
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [items, removed] = await Promise.all([workspace.list(userId), workspace.deletedPilotKinds(userId)]);
        if (alive) { setRows(items); setDeleted(removed); setLoaded(true); setLocalError(''); setSupported(!!navigator.locks); }
      } catch { if (alive) { setLoaded(false); setLocalError('기기 자료 조회 실패. 브라우저 저장소 권한을 확인해 주세요.'); } }
    };
    const update = () => { void refresh(); };
    update(); window.addEventListener('gatherly-pilot-updated', update); window.addEventListener('focus', update);
    return () => { alive = false; window.removeEventListener('gatherly-pilot-updated', update); window.removeEventListener('focus', update); };
  }, [workspace, userId]);
  const readiness = pilotReadiness(rows, deleted, enabled, busy);
  const reasons = [...readiness.reasons];
  if (!enabled && blockedReason) reasons[0] = blockedReason;
  if (!loaded) reasons.push(localError || '기기 자료를 확인 중입니다.');
  if (loaded && !supported) reasons.push('안전한 동기화 잠금을 지원하지 않는 브라우저입니다. 최신 Safari에서 다시 열어 주세요.');
  const canUpload = loaded && supported && readiness.canUpload;
  async function execute(check: boolean) {
    if (!enabled || running.current || (!check && !canUpload)) return;
    running.current = true; setBusy(true);
    setNotice(check ? 'Google에서 다시 확인 중…' : '업로드 및 원격 저장 확인 중…');
    try {
      if (check) {
        const states = await pilotStatus(userId, run);
        const labels: Record<string, string> = { VERIFIED: '원격 재조회 성공', NOT_UPLOADED: '미전송', PENDING: '저장 대기', SHEET_PENDING: 'Drive 확인 완료 · Sheets 반영 재시도 필요' };
        setNotice(['photo', 'audio', 'note'].map((k, i) => `${['사진', '녹음', '메모'][i]}: ${labels[states[k]] ?? '확인 실패'}`).join(' · '));
      } else {
        const current = pilotReadiness(await workspace.list(userId), await workspace.deletedPilotKinds(userId), enabled, false);
        if (!current.canUpload) throw new Error(current.reasons.join(' '));
        setNotice(await syncPilot(workspace, userId, fetch, run));
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : '확인 실패. 원본은 보관됩니다.'); }
    finally { running.current = false; setBusy(false); window.dispatchEvent(new Event('gatherly-pilot-updated')); }
  }
  return <section className="v2-card" aria-labelledby="pilot-title"><h2 id="pilot-title" className="text-lg font-bold">3건 Google 실저장 테스트</h2><p>전용 테스트 폴더와 Sheets를 사용합니다. 전송을 시도한 자료는 원격 슬롯 확인 없이 교체할 수 없습니다.</p><p role="status" className="v2-status">{notice}</p><div id="pilot-upload-reasons" aria-live="polite">{reasons.length ? <ul className="grid gap-2">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>사진·녹음·메모 준비 완료. 업로드 버튼을 눌러 주세요.</p>}</div><div className="v2-actions"><button type="button" data-pilot-upload className="v2-button v2-button-primary" aria-describedby="pilot-upload-reasons" disabled={!canUpload} onClick={() => void execute(false)}>3건 업로드 · 실패 재시도</button><button type="button" className="v2-button" disabled={!enabled || busy} onClick={() => void execute(true)}>Google에서 저장 결과 다시 조회</button></div></section>;
}
