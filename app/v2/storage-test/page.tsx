import { session } from '@/lib/gatherly-2/auth/server';
import { environment } from '@/lib/gatherly-2/integration/environment';
import { FieldPrototype } from '@/components/gatherly-2/field-prototype';
import { GoogleConnection } from '@/components/gatherly-2/google-connection';
export const dynamic = 'force-dynamic';
export default async function StorageTestPage() {
  const result = await session().then(value => value, () => null);
  if (!result) return <main className="p-8"><h1>승인 사용자 전용</h1><p>로그인과 내부 접근 승인이 필요합니다.</p><a href="/v2">로그인 화면으로</a></main>;
  return <main className="bg-[#f7f4e9] text-[#173e32]"><div className="mx-auto max-w-5xl p-4"><a href="/v2">돌아가기</a><GoogleConnection consentEnabled={process.env.GATHERLY_V2_GOOGLE_CONSENT_ENABLED === 'true'} writesEnabled={false} /></div><FieldPrototype key={result.user.id} localUserId={result.user.id} namespace={environment()} collectionTest /></main>;
}
