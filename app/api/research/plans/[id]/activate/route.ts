import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const activated = await prisma.$transaction(async (tx) => {
      const plan = await tx.researchPlan.findUnique({
        where: { id },
        include: { fieldDay: { select: { deletedAt: true } } },
      });

      if (!plan || plan.fieldDay.deletedAt) throw new Error("PLAN_NOT_FOUND");
      if (plan.status === "CLOSED" || plan.status === "ARCHIVED") throw new Error("PLAN_NOT_ACTIVATABLE");

      await tx.researchPlan.updateMany({
        where: { fieldDayId: plan.fieldDayId, isActive: true, id: { not: id } },
        data: { isActive: false },
      });

      return tx.researchPlan.update({
        where: { id },
        data: { status: "ACTIVE", isActive: true, activatedAt: new Date(), closedAt: null },
      });
    });

    return NextResponse.json({ plan: activated });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "PLAN_NOT_FOUND") {
      return NextResponse.json({ error: "Research Plan을 찾을 수 없습니다." }, { status: 404 });
    }
    if (cause instanceof Error && cause.message === "PLAN_NOT_ACTIVATABLE") {
      return NextResponse.json({ error: "종료되거나 보관된 Research Plan은 활성화할 수 없습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "Research Plan을 활성화하지 못했습니다." }, { status: 400 });
  }
}
