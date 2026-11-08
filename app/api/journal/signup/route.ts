import { NextRequest, NextResponse } from "next/server";
import { getEntry } from "@/lib/fpl-client";
import { isSameOrigin, requireStore } from "@/lib/journal/session";
import { signUpMember } from "@/lib/journal/service";
import { signupSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const result = await signUpMember(store, parsed.data, async (teamId) => {
    try {
      await getEntry(teamId);
      return true;
    } catch {
      return false;
    }
  });

  if (result.ok) return NextResponse.json({ ok: true, needsConfirmation: result.needsConfirmation });
  const status = result.code === "team_taken" ? 409 : result.code === "team_not_found" ? 404 : 400;
  return NextResponse.json({ error: result.code }, { status });
}
