export function GoogleConnection({ consentEnabled, writesEnabled }: { consentEnabled: boolean; writesEnabled: boolean }) {
  return <section aria-labelledby="google-connection-title" className="my-6 rounded-2xl border border-[#173e32]/20 bg-[#f7f4e9] p-5 text-[#173e32]">
    <h2 id="google-connection-title" className="text-lg font-bold">개인 Google Drive·Sheets 연결</h2>
    <p className="my-3">Google 로그인과 별도로 파일 접근에 동의합니다. 연결 정보는 암호화해 보관하며, 이 버튼으로 사진·녹음·메모 파일을 만들지 않습니다.</p>
    {!writesEnabled && <p className="mb-3 font-medium">현재 Google 파일 저장은 비활성 상태입니다.</p>}
    <form action="/api/v2/google/connect" method="post">
      <button disabled={!consentEnabled} className="min-h-12 w-full rounded-xl bg-[#173e32] px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50">Google Drive·Sheets 연결</button>
    </form>
    <p className="mt-3 text-sm">{consentEnabled ? '같은 탭에서 Google 동의 화면으로 이동합니다. 완료 후 연결 정보 저장 결과를 확인해 주세요. 다시 연결할 때도 이 버튼을 사용합니다.' : '연결 설정을 준비 중입니다. 운영자가 접근 동의를 활성화하면 연결할 수 있습니다.'}</p>
  </section>;
}
