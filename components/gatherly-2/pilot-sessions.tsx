'use client';
import { useEffect, useState } from 'react';
import type { PilotSessionView } from '@/lib/gatherly-2/integration/pilot-session';
import { FieldPrototype } from './field-prototype';
import { PilotActions } from './pilot-actions';
export function PilotSessions({ userId, namespace, enabled, blockedReason }: { userId: string; namespace: string; enabled: boolean; blockedReason: string }) {
  const [run, setRun] = useState<PilotSessionView | null>(null), [legacy, setLegacy] = useState(true);
  const [history, setHistory] = useState<PilotSessionView[]>([]);
  async function showHistory() {
    setBusy(true);
    try { const response = await fetch('/api/v2/storage-test/session?action=history', { method: 'POST' }); if (!response.ok) throw new Error(); setHistory(await response.json()); setNotice('이전 승인 회차는 보관 모드로 열립니다. 원격 전송은 차단됩니다.'); }
    catch { setNotice('회차 이력을 확인하지 못했습니다. 로컬 자료는 유지됩니다.'); } finally { setBusy(false); }
  }
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('기존 회차의 실패 이력과 삭제 표식은 유지됩니다. 새 회차는 서버 승인이 있어야 열립니다.');
  async function change(action: 'open' | 'close') {
    if (busy) return;
    if (action === 'close' && !window.confirm('이 회차를 종료할까요? 원본과 이력은 유지되며 같은 회차를 다시 열거나 업로드할 수 없습니다.')) return;
    setBusy(true);
    try {
      const result = await fetch('/api/v2/storage-test/session?action=' + action + (action === 'close' ? '&sessionId=' + encodeURIComponent(run!.id) : ''), { method: 'POST' });
      if (!result.ok) throw new Error(result.status === 503 ? '서버에서 승인된 실증 회차 또는 기간이 없습니다. 원격 쓰기는 활성화하지 않습니다.' : '회차 처리 실패. 승인 계정·기한을 확인해 주세요. 기존 자료는 유지됩니다.');
      const row: PilotSessionView = await result.json(); setRun(row); setLegacy(false);
      setNotice(row.status === 'OPEN' ? '서버 승인 회차입니다. Google 쓰기 비활성 상태에서는 업로드할 수 없습니다.' : '종료된 회차입니다. 원본과 이력은 유지되며 재발급되지 않습니다.');
    } catch (error) { setNotice(error instanceof Error ? error.message : '회차 확인 실패'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!run || run.status !== 'OPEN') return;
    const timer = setTimeout(() => setRun(current => current?.id === run.id ? { ...current, status: 'CLOSED' } : current), Math.max(0, Math.min(2147483647, run.endsAt - Date.now())));
    return () => clearTimeout(timer);
  }, [run]);
  const currentNamespace = !legacy && run ? `${namespace}-pilot-${run.id}` : namespace;
  const canWrite = !legacy && !!run && run.status === 'OPEN' && !run.readOnly && enabled;
  return <><section className="v2-shell"><div className="v2-card"><h2 className="text-lg font-bold">실증 회차</h2><p role="status">{notice}</p><p>{legacy ? '기존 회차 · 원격 재전송 차단' : `서버 승인 회차 ${run?.id.slice(0, 8)} · ${run?.readOnly ? '보관 보기 · 전송 차단' : run?.status === 'OPEN' ? '진행 가능' : '종료'}`}</p><div className="v2-actions"><button data-pilot-session-open type="button" className="v2-button" disabled={busy} onClick={() => void change('open')}>서버 승인 회차 열기 · 이어가기</button><button type="button" className="v2-button" disabled={busy} onClick={() => void showHistory()}>이전 승인 회차 목록</button>{history.map(row => <button type="button" className="v2-button" key={row.id} onClick={() => { setRun(row); setLegacy(false); }}>보관 회차 {row.id.slice(0, 8)} 보기</button>)}<button type="button" className="v2-button" onClick={() => setLegacy(true)}>기존 회차 자료 보기</button>{run && <button type="button" className="v2-button" onClick={() => setLegacy(false)}>새 회차 자료 보기</button>}{run?.status === 'OPEN' && !run.readOnly && <button type="button" className="v2-button" disabled={busy} onClick={() => void change('close')}>새 회차 종료</button>}</div></div></section><div data-pilot-namespace={currentNamespace}><FieldPrototype key={currentNamespace} localUserId={userId} namespace={currentNamespace} collectionTest remoteTest={canWrite} /><div className="v2-shell"><PilotActions key={currentNamespace} userId={userId} namespace={currentNamespace} enabled={canWrite} run={!legacy && run ? run : undefined} blockedReason={legacy ? '기존 회차는 보존용입니다. 원격 교체·재전송은 차단됩니다.' : !run || run.status !== 'OPEN' || run.readOnly ? '보관 회차는 전송할 수 없습니다. 서버 승인된 열린 회차가 필요합니다.' : blockedReason} /></div></div></>;
}
