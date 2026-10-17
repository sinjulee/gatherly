import { ownLoginIdentity, serverClient } from '@/lib/gatherly-2/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google 인증 확인', robots: { index: false, follow: false } };

export default async function AuthCompletePage() {
  const identity = await (async () => {
    const client = await serverClient();
    return ownLoginIdentity(client.auth);
  })().catch(() => null);
  if (!identity) redirect('/v2');
  return <main className="min-h-screen bg-[#f7f4e9] p-8 text-[#173e32]">
    <h1 className="text-xl font-bold">Google 인증이 완료되었습니다</h1>
    <p className="my-4">아래 UID는 현재 로그인한 본인의 식별자입니다. 인증만으로 관리자 또는 내부 자료 접근 권한이 부여되지는 않습니다.</p>
    <dl><dt className="font-bold">내 UID</dt><dd className="my-2 break-all font-mono">{identity.id}</dd></dl>
    <p className="my-4">운영자에게 승인된 비공개 경로로 전달해 주세요. UUID 등록 전에는 지도·카탈로그·개인 자료를 이용할 수 없습니다.</p>
    <form action="/api/v2/auth/logout" method="post"><button className="min-h-12 rounded-xl border p-3">로그아웃</button></form>
  </main>;
}
