"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { RecommendPanel } from "@/components/recommend-panel";
import { SiteHeader } from "@/components/site-header";
import { SquadList } from "@/components/squad-list";
import { SquadPitch } from "@/components/squad-pitch";
import { SquadStatusBar } from "@/components/squad-status-bar";
import { TeamIdForm } from "@/components/team-id-form";
import { isAllowedEntry } from "@/lib/ai/allowed-entry";
import { chipLabel } from "@/lib/chips";
import { clearMyTeam, loadMyTeam, saveMyTeam, type MyTeam } from "@/lib/my-team";
import type { EntrySquadPayload } from "@/lib/squad-types";
import {
  metricLabel,
  parseSquadView,
  SQUAD_METRICS,
  SQUAD_VIEW_KEY,
  type SquadMetric,
  type SquadViewMode
} from "@/lib/squad-view";

class SquadRequestError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds: number | null
  ) {
    super(`squad request failed (${status})`);
  }
}

async function fetchSquad(entryId: number, refresh: boolean): Promise<EntrySquadPayload> {
  const response = await fetch(`/api/entry-squad?entryId=${entryId}${refresh ? "&refresh=1" : ""}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { retryAfterSeconds?: number };
    throw new SquadRequestError(response.status, body.retryAfterSeconds ?? null);
  }
  return (await response.json()) as EntrySquadPayload;
}

const queryKey = (entryId: number) => ["entry-squad", entryId] as const;

function ErrorNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { tr } = useLocale();
  const status = error instanceof SquadRequestError ? error.status : 0;
  const wait = error instanceof SquadRequestError ? error.retryAfterSeconds : null;

  let message: string;
  if (status === 404) {
    message = tr("이 팀 ID를 FPL에서 찾을 수 없습니다. 숫자를 다시 확인해 주세요.", "FPL has no team with this ID. Check the number.");
  } else if (status === 400) {
    message = tr("팀 ID가 올바르지 않습니다.", "That team ID is not valid.");
  } else if (status === 429) {
    message = tr(
      `요청이 많아 잠시 막혔습니다. ${wait ?? 60}초 뒤 다시 시도해 주세요.`,
      `Too many requests. Try again in ${wait ?? 60} seconds.`
    );
  } else {
    message = tr(
      "팀 정보를 불러오지 못했습니다. FPL 서버가 응답하지 않을 수 있습니다. 잠시 후 다시 시도해 주세요.",
      "Could not load the team. The FPL server may not be responding. Try again in a moment."
    );
  }

  return (
    <div role="alert" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center">
      <p className="text-body">{message}</p>
      {status !== 404 && status !== 400 ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-body font-semibold"
        >
          {tr("다시 시도", "Retry")}
        </button>
      ) : null}
    </div>
  );
}

export function SquadPage({ entryId }: { entryId: number }) {
  const { tr, locale } = useLocale();
  const queryClient = useQueryClient();
  const [view, setView] = useState<{ mode: SquadViewMode; metric: SquadMetric }>({ mode: "pitch", metric: "opponent" });
  const [mine, setMine] = useState<MyTeam | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<number | null>(null);

  const query = useQuery({
    queryKey: queryKey(entryId),
    queryFn: () => fetchSquad(entryId, false),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false
  });

  // Saved view and "my team" live in this browser only; read them after mount so server and client agree.
  useEffect(() => {
    try {
      setView(parseSquadView(window.localStorage.getItem(SQUAD_VIEW_KEY)));
    } catch {
      // Storage can be blocked; the default view then lasts for this visit.
    }
    setMine(loadMyTeam());
  }, []);

  // Keep the remembered team's name current once it loads.
  const loadedName = query.data?.teamName;
  useEffect(() => {
    if (loadedName && mine && mine.id === entryId && mine.name !== loadedName) {
      const next = { id: entryId, name: loadedName };
      saveMyTeam(next);
      setMine(next);
    }
  }, [loadedName, mine, entryId]);

  function changeView(next: Partial<{ mode: SquadViewMode; metric: SquadMetric }>) {
    const merged = { ...view, ...next };
    setView(merged);
    try {
      window.localStorage.setItem(SQUAD_VIEW_KEY, JSON.stringify(merged));
    } catch {
      // See above.
    }
  }

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      queryClient.setQueryData(queryKey(entryId), await fetchSquad(entryId, true));
    } catch (error) {
      setRefreshError(error instanceof SquadRequestError ? error.status : 0);
    } finally {
      setRefreshing(false);
    }
  }

  const data = query.data;
  const isMine = mine?.id === entryId;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-2 px-2 py-2 md:px-4 md:py-3">
      <SiteHeader>
        <LocaleToggle />
      </SiteHeader>

      <header className="flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
            {data ? data.teamName || tr(`팀 ${entryId}`, `Team ${entryId}`) : tr("내 스쿼드", "My squad")}
          </h1>
          <p className="mt-1 text-body text-[var(--muted)]">
            {data
              ? `${data.managerName ? `${data.managerName} · ` : ""}${tr(`팀 ID ${entryId}`, `Team ID ${entryId}`)}`
              : tr(`팀 ID ${entryId}`, `Team ID ${entryId}`)}
          </p>
        </div>
        <div className="w-full md:w-96">
          <TeamIdForm compact />
        </div>
      </header>

      {query.isPending ? (
        <div role="status" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-body text-[var(--muted)]">
          {tr("스쿼드를 불러오는 중…", "Loading the squad…")}
        </div>
      ) : query.isError ? (
        <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-meta">
            <button
              type="button"
              onClick={() => {
                if (isMine) {
                  clearMyTeam();
                  setMine(null);
                } else {
                  const next = { id: entryId, name: data.teamName || null };
                  saveMyTeam(next);
                  setMine(next);
                }
              }}
              aria-pressed={isMine}
              className={`min-h-9 rounded-md border px-3 font-semibold ${isMine ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
            >
              {isMine ? tr("내 팀으로 기억함 · 해제", "Remembered as my team · forget") : tr("내 팀으로 기억하기", "Remember as my team")}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="min-h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 font-semibold disabled:opacity-60"
            >
              {refreshing ? tr("새로 불러오는 중…", "Refreshing…") : tr("새로고침", "Refresh")}
            </button>
            {refreshError !== null ? (
              <span role="alert" className="text-caption text-[var(--danger)]">
                {refreshError === 429
                  ? tr("새로고침은 30초에 한 번만 됩니다.", "Refresh works once every 30 seconds.")
                  : tr("새로고침에 실패했습니다.", "Refresh failed.")}
              </span>
            ) : null}
            <span className="text-caption text-[var(--muted)]">
              {isMine
                ? tr("이 브라우저에만 저장됩니다.", "Saved in this browser only.")
                : tr("로그인 없이, 이 브라우저에만 저장됩니다.", "No login; saved in this browser only.")}
            </span>
          </div>

          {data.gw === null ? (
            <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-body text-[var(--muted)]">
              {tr("이 팀은 아직 마감이 지난 게임위크가 없어 보여 줄 스쿼드가 없습니다.", "This team has no gameweek past its deadline yet, so there is no squad to show.")}
            </p>
          ) : (
            <>
              <p role="note" className="rounded-md border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2 text-meta leading-5">
                {tr(
                  `GW${data.gw} 마감 때의 팀입니다. 이번 마감 전에 바꾼 선발·주장·칩은 로그인 없이는 볼 수 없어 반영되지 않습니다. 판매가와 무료 이적 수는 공개 기록으로 계산한 추정값이라 FPL 공식 화면과 다를 수 있습니다.`,
                  `This is the squad as it stood at the GW${data.gw} deadline. Lineup, captain and chip changes made since then cannot be seen without logging in to FPL, so they are not shown. Selling prices and free transfers are estimates worked out from public records and may differ from FPL's own screen.`
                )}
                {data.freeHitFallback
                  ? tr(
                      ` 그 주에 프리 힛을 써서, 프리 힛 이전 주(GW${data.gw})의 팀을 보여 줍니다.`,
                      ` A Free Hit was played in the following week, so the squad before it (GW${data.gw}) is shown.`
                    )
                  : null}
                {data.activeChip && !data.freeHitFallback
                  ? tr(` 이 주에는 ${chipLabel(data.activeChip, false, locale)}을(를) 썼습니다.`, ` ${chipLabel(data.activeChip, false, locale)} was played this week.`)
                  : null}
              </p>

              {!data.transfers.freeTransfersMatchHistory ? (
                <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-meta text-[var(--warning)]">
                  {tr(
                    "무료 이적 수를 다시 계산해 보니 지난 이적 비용 기록과 맞지 않는 주가 있어, 이 값은 특히 부정확할 수 있습니다.",
                    "The rebuilt free-transfer count disagrees with a recorded transfer cost in one week, so this value may be especially off."
                  )}
                </p>
              ) : null}

              {/* One column on a narrow screen; from lg the pitch (left) and the team status (right) sit side by side so the pitch is not stretched across the page. */}
              <div
                role="group"
                aria-label={tr("스쿼드", "Squad")}
                className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-3 xl:grid-cols-[minmax(0,760px)_minmax(0,1fr)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 lg:contents">
                  <div role="group" aria-label={tr("보기 방식", "View")} className="inline-flex justify-self-start overflow-hidden rounded-md border border-[var(--border)] lg:col-start-1 lg:row-start-1">
                    {(["pitch", "list"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={view.mode === mode}
                        onClick={() => changeView({ mode })}
                        className={`min-h-9 px-4 text-meta font-semibold ${view.mode === mode ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)]"}`}
                      >
                        {mode === "pitch" ? tr("피치", "Pitch") : tr("리스트", "List")}
                      </button>
                    ))}
                  </div>
                  {view.mode === "pitch" ? (
                    <label className="flex items-center gap-2 text-meta lg:col-start-2 lg:row-start-1">
                      <span className="text-[var(--muted)]">{tr("카드에 표시", "Card shows")}</span>
                      <select
                        value={view.metric}
                        onChange={(event) => changeView({ metric: event.target.value as SquadMetric })}
                        className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-body-lg"
                      >
                        {SQUAD_METRICS.map((metric) => (
                          <option key={metric} value={metric}>
                            {metricLabel(metric, locale)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                  {view.mode === "pitch" ? <SquadPitch squad={data.squad} metric={view.metric} /> : <SquadList squad={data.squad} />}
                </div>

                <p className="text-caption text-[var(--muted)] lg:col-start-1">
                  {tr(
                    `점수는 GW${data.gw} 선수 점수(주장 배수 제외), 상대·FDR은 ${data.nextGw ? `GW${data.nextGw}` : "다음 게임위크"} 기준, 가격 변동은 시즌 시작가 대비입니다. 판매가는 구매가 + 오른 폭의 절반(내림)으로 계산한 추정값입니다.`,
                    `Points are each player's GW${data.gw} score (captain multiplier not applied); opponent and FDR are for ${data.nextGw ? `GW${data.nextGw}` : "the next gameweek"}; price change is since the season's opening price. Selling price is estimated as purchase price plus half of any rise, rounded down.`
                  )}
                </p>

                <SquadStatusBar data={data} className="lg:col-start-2 lg:row-start-2 lg:row-span-2" />
              </div>

              {/* Issue #43 stage 4: lineup, captain, transfer and AI recommendations for the allowed team only (personal transfer analysis is members-only, #47). Every other team ID gets the screen as it was, with no extra request. */}
              {isAllowedEntry(entryId) ? <RecommendPanel entryId={entryId} /> : null}
            </>
          )}

          <p className="px-1 text-caption text-[var(--muted)]">
            <Link href="/privacy" className="underline underline-offset-2">
              {tr("개인정보처리방침", "Privacy policy")}
            </Link>
            {" · "}
            {isAllowedEntry(entryId)
              ? tr(
                  "데이터 출처: Fantasy Premier League 공개 데이터. FPL Live는 비공식 서비스이며 Premier League·FPL과 제휴 관계가 없습니다. 이 팀은 추천 결과와 GW별 추천 기록만 서버에 저장합니다.",
                  "Source: Fantasy Premier League public data. FPL Live is unofficial and not affiliated with the Premier League or FPL. For this team only the recommendations and the per-gameweek recommendation log are stored."
                )
              : tr(
                  "데이터 출처: Fantasy Premier League 공개 데이터. FPL Live는 비공식 서비스이며 Premier League·FPL과 제휴 관계가 없습니다. 팀 정보는 그때그때 불러와 보여 줄 뿐 저장하지 않습니다.",
                  "Source: Fantasy Premier League public data. FPL Live is unofficial and not affiliated with the Premier League or FPL. Team data is fetched on demand and not stored."
                )}
          </p>
        </>
      ) : null}
    </main>
  );
}
