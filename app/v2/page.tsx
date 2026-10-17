import { environment } from '@/lib/gatherly-2/integration/environment';
import { isVercel } from '@/lib/gatherly-2/integration/platform';
import { enabled, IntegrationError } from '@/lib/gatherly-2/integration/config';
import { session } from '@/lib/gatherly-2/auth/server';
import { REFERENCE_SHA, SupabaseCatalog } from '@/lib/gatherly-2/integration/catalog';
import { GoogleConnection } from '@/components/gatherly-2/google-connection';
import { ConnectedField } from '@/components/gatherly-2/connected-field';
export const dynamic = 'force-dynamic';
const button = 'min-h-12 rounded-xl border p-3';
export default async function V2Page({ searchParams }: { searchParams: Promise<{ exhibition?: string }> }) {
  if (!enabled()) return <main className="p-8"><h1>Gatherly 2.0 연결 준비</h1><p>외부 연동은 비활성 상태입니다. 승인된 환경 설정 후 이용할 수 있습니다.</p><a href="/phase-one">로컬 기능 미리보기</a></main>;
  async function load() {
    const { user, client } = await session();
    // Login pilot skips catalogue/Vault reads; the explicit consent form is independent.
    if (process.env.GATHERLY_V2_AUTH_ONLY === 'true') return { user, data: [], selected: undefined, exhibitors: [], hotspots: [], authOnly: true };
    const { exhibition } = await searchParams;
    const { data, error } = await client.from('g2_exhibitions').select('id,name');
    if (error) throw new IntegrationError('RETRY', 503);
    const selected = data?.find(e => e.id === exhibition) ?? data?.[0];
    const catalog = new SupabaseCatalog(client);
    const exhibitors = selected ? await catalog.list(selected.id) : [];
    const hotspots = selected ? await catalog.hotspots(selected.id, exhibitors, REFERENCE_SHA) : [];
    return { user, data, selected, exhibitors, hotspots };
  }
  const result = await load().then(data => ({ data, error: null as unknown }), error => ({ data: null, error: error as unknown }));
  if (result.error) {
    const error = result.error;
    const login = error instanceof IntegrationError && error.code === 'UNAUTHORIZED';
    return <main className="p-8"><h1>Gatherly 2.0</h1><p>{login ? 'Google 로그인 후 개인 파일 접근에 별도로 동의할 수 있습니다.' : '승인 계정과 카탈로그 환경 설정을 확인해 주세요.'}</p><form action="/api/v2/auth/login" method="post"><button className={button}>Google 로그인</button></form></main>;
  }
  const { user, data, selected, exhibitors, hotspots } = result.data!;
  const connection = <GoogleConnection consentEnabled={process.env.GATHERLY_V2_GOOGLE_CONSENT_ENABLED === 'true'} writesEnabled={process.env.GATHERLY_V2_GOOGLE_WRITES_ENABLED === 'true'} />;
  if ('authOnly' in result.data! && result.data.authOnly) return <main className="p-8"><h1>Google 로그인 확인 완료</h1><p>승인된 사용자입니다. 아래에서 개인 파일 접근에 별도로 동의할 수 있습니다.</p>{connection}<form action="/api/v2/auth/logout" method="post"><button className={button}>로그아웃</button></form></main>;
  return <main className="bg-[#f7f4e9] text-[#173e32]"><div className="mx-auto flex max-w-5xl flex-wrap gap-3 p-4">{connection}<form action="/api/v2/auth/logout" method="post"><button className={button}>로그아웃</button></form>{data?.map(e => <a className={button} key={e.id} href={`/v2?exhibition=${e.id}`}>{e.name}</a>)}</div>{exhibitors.length ? <ConnectedField namespace={environment()} chunkedMedia={isVercel()} userId={user.id} fieldDayId={selected!.id} exhibitors={exhibitors} hotspots={hotspots} /> : <p className="p-8">승인·발행된 참가기업이 없습니다. 미검증 기업과 좌표는 표시하지 않습니다.</p>}</main>;
}
