import { failure, IntegrationError } from './config';

export type ConsentOutcome = 'connected' | 'declined';
/** No query parameters, OAuth values, user IDs or provider errors are rendered. */
export function consentPage(outcome: ConsentOutcome | 'error', error?: unknown) {
  const code = error instanceof IntegrationError ? error.code : 'RETRY';
  const message = outcome === 'connected'
    ? ['Google Drive·Sheets 연결 완료', '접근 동의가 완료되어 연결 정보를 암호화해 안전하게 저장했습니다. 이번 연결 과정에서 사진·녹음·메모 파일을 생성하지 않았습니다.']
    : outcome === 'declined'
      ? ['Google 파일 접근 동의를 취소했습니다', '이번 동의로 새 연결 정보를 저장하지 않았습니다. 기존 연결이 있다면 그대로 유지됩니다. 원할 때 다시 연결할 수 있습니다.']
      : code === 'DISABLED'
        ? ['Google 연결을 준비 중입니다', '아직 접근 동의를 시작할 수 없습니다. 운영자의 설정 확인 후 다시 시도해 주세요.']
        : code === 'UNAUTHORIZED'
          ? ['로그인이 필요합니다', '로그인 시간이 만료됐을 수 있습니다. Google 로그인 후 다시 연결해 주세요.']
          : code === 'FORBIDDEN'
            ? ['연결 요청을 확인할 수 없습니다', '승인 계정을 확인해 주세요. 요청이 만료됐거나 이미 사용된 경우에는 연결 화면에서 다시 시작해 주세요.']
            : code === 'REAUTH'
              ? ['Google 인증을 다시 확인해 주세요', '필요한 권한이나 연결 정보를 확인하지 못했습니다. 연결 완료가 확인되지 않았으므로 다시 동의해 주세요.']
              : ['연결 정보 저장 완료를 확인하지 못했습니다', '연결이 완료됐다고 확인할 수 없습니다. 잠시 후 다시 시도해 주세요. 같은 문제가 계속되면 운영자에게 문의해 주세요.'];
  const status = outcome === 'error' ? (error instanceof IntegrationError ? error.status : 503) : 200;
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${message[0]}</title><style>body{margin:0;background:#f7f4e9;color:#173e32;font-family:system-ui,sans-serif;line-height:1.7}main{max-width:36rem;margin:auto;padding:32px 20px}h1{font-size:1.5rem}a{display:flex;align-items:center;justify-content:center;min-height:48px;margin-top:24px;border-radius:12px;background:#173e32;color:white;text-decoration:none;padding:8px 16px}</style></head><body><main><h1>${message[0]}</h1><p role="status">${message[1]}</p><a href="/v2">Gatherly 연결 화면으로 돌아가기</a></main></body></html>`, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  } });
}
export function consentFailure(request: Request, error: unknown) {
  return request.headers.get('accept')?.includes('text/html') ? consentPage('error', error) : failure(error);
}
