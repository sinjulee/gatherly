import { FieldPrototype } from "@/components/gatherly-2/field-prototype";
import { session } from "@/lib/gatherly-2/auth/server";
import { environment } from "@/lib/gatherly-2/integration/environment";
import { redirect } from "next/navigation";
export const dynamic = 'force-dynamic';
export const metadata = { title: "Gatherly 2.0 내부 미리보기", robots: { index: false, follow: false } };
export default async function PhaseOnePage() {
  const access = await session().catch(() => null);
  if (!access) redirect('/v2');
  return <FieldPrototype localUserId={access.user.id} namespace={environment()} />;
}
