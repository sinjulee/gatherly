import type { SyncItem } from './contracts';
export function devUploadReasons(item: SyncItem, connected: boolean, enabled: boolean, busy: boolean, locks: boolean) {
  const reasons: string[] = [];
  if (!enabled) reasons.push('개발 저장 설정이 비활성입니다.');
  if (!connected) reasons.push('Google 연결 상태를 확인하거나 다시 연결해 주세요.');
  if (!locks) reasons.push('안전한 전송 잠금을 지원하는 Safari가 필요합니다.');
  if (busy) reasons.push('현재 작업이 끝날 때까지 기다려 주세요.');
  if (item.state === 'SYNCED') reasons.push('원격 저장 확인 완료 · 결과를 다시 조회할 수 있습니다.');
  if (item.blob && (item.blob.size === 0 || item.blob.size > 5*1024*1024)) reasons.push('파일은 0바이트 초과, 5MiB 이하여야 합니다.');
  return reasons;
}
