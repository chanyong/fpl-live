/**
 * Browser side of GET /api/journal/me (issue #47): who is signed in and which FPL team the account registered.
 * Nothing here touches storage; the answer is read from the server every time it is needed.
 */
export type MemberInfo = { member: false } | { member: true; teamId: number | null; nextTeamChangeAt: string | null };

/** Tolerates any body: anything that is not a clear member answer counts as a visitor. */
export function parseMember(body: unknown): MemberInfo {
  if (typeof body !== "object" || body === null) return { member: false };
  const { member, teamId, nextTeamChangeAt } = body as { member?: unknown; teamId?: unknown; nextTeamChangeAt?: unknown };
  if (member !== true) return { member: false };
  return {
    member: true,
    teamId: typeof teamId === "number" && Number.isInteger(teamId) && teamId > 0 ? teamId : null,
    nextTeamChangeAt: typeof nextTeamChangeAt === "string" ? nextTeamChangeAt : null
  };
}

export async function fetchMember(): Promise<MemberInfo> {
  try {
    const response = await fetch("/api/journal/me", { cache: "no-store" });
    if (!response.ok) return { member: false };
    return parseMember(await response.json());
  } catch {
    return { member: false };
  }
}

/** The registered team when the visitor is a signed-in member who has one. */
export function registeredTeam(info: MemberInfo | undefined): number | null {
  return info && info.member ? info.teamId : null;
}
