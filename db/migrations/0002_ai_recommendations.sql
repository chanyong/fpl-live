-- AI 추천 층(이슈 #43 2·3단계): 작업·결과 표, 사용량 표, 추천 기록 표, 상한 집행 함수 2개.
-- 이 파일은 코드 저장소에만 있고 아직 어떤 DB에도 적용하지 않았다. 적용은 관제 창이 L2 절차로 한다(대표 사전 위임: 추가형 마이그레이션).
--
-- [추가형이라 이전 코드와 충돌하지 않는 이유]
--   새 표 3개·인덱스·함수 4개만 만든다. 기존 표(journal_*)와 기존 함수는 건드리지 않는다. 이 파일을 적용해도
--   지금 배포돼 있는 코드는 이 표를 읽지도 쓰지도 않으므로 아무 영향이 없고, 빌드·프리렌더도 이 표를 읽지 않는다.
--   AI 층은 코드에서 기본 꺼짐(AI_RECOMMEND_ENABLED=true 와 ANTHROPIC_API_KEY 가 모두 있어야 켜짐)이라, 적용만으로는 호출이 시작되지 않는다.
-- [적용 순서] 운영 DB에 이 파일을 먼저 적용(관제 창, L2) -> 그 뒤에 AI 층 PR을 병합. 코드가 먼저 병합돼도 꺼져 있어 안전하지만,
--   표가 없는 채로 켜면 호출 전에 표 읽기가 실패해 호출을 하지 않는다(fail closed).
-- [롤백] 0002_ai_recommendations.rollback.sql (표·함수만 지운다. 기록된 사용량·추천 기록이 사라지므로 실행 전 백업).
-- [권한] 세 표 모두 RLS 켜고 정책 없음 = 서비스 역할(서버)만 접근. 함수는 security definer + search_path 고정 + anon·authenticated 실행 회수.
-- 적용은 SQL 편집기나 psql로 한다(파일에 begin/commit 포함). supabase CLI migration 흐름은 쓰지 않는다.
begin;

-- 1) AI 작업·결과. 조회 키는 (entry_id, target_gw, locale). 같은 키에 세대(generation)가 쌓인다(첫 생성 + 다시 분석, 키당 최대 3회는 함수가 지킨다).
create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  entry_id integer not null check (entry_id > 0),
  target_gw integer not null check (target_gw between 1 and 38),
  locale text not null check (locale in ('ko', 'en')),
  generation integer not null check (generation >= 1),
  request_kind text not null check (request_kind in ('first', 'manual')),
  status text not null check (status in ('running', 'done', 'failed')),
  -- 기록용 열: 조회 키가 아니다. 모델에 보낸 입력의 해시.
  input_hash text not null,
  model_id text not null,
  -- 규칙 기반 모델 버전(xp1 ...).
  model_version text not null,
  -- 그때의 규칙 기반 후보(선발 L1~L3, 캡틴 후보와 비중, 이적 시나리오, 선수 이름 색인). 화면의 수치는 이것을 쓴다.
  basis jsonb not null,
  -- 서버가 검증하고 이름을 채운 모델 답. status = 'done' 일 때만 있다.
  result jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_recommendations_key_generation_unique unique (entry_id, target_gw, locale, generation),
  constraint ai_recommendations_done_has_result check ((status = 'done') = (result is not null))
);

-- 같은 키로 진행 중인 작업은 1개.
create unique index if not exists ai_recommendations_one_running
  on public.ai_recommendations (entry_id, target_gw, locale)
  where status = 'running';

create index if not exists ai_recommendations_key_created
  on public.ai_recommendations (entry_id, target_gw, locale, created_at desc);

-- 2) 사용량: 호출마다 한 행. 호출 전에 예약 금액으로 넣고, 호출 뒤 실제 usage로 cost_usd 를 고친다.
--    cost_usd 는 "지금 누적에 들어가는 금액"이다: 예약 상태에서는 예약 금액, 확정되면 실제 비용.
--    실패·미확정(프로세스가 죽음 포함) 행은 예약 금액 그대로 남아 누적에 계속 들어간다(보수적).
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_recommendations (id) on delete restrict,
  attempt integer not null default 1 check (attempt >= 1),
  reserved_usd numeric(12, 6) not null check (reserved_usd >= 0),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  input_tokens integer,
  output_tokens integer,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists ai_usage_created on public.ai_usage (created_at);
create index if not exists ai_usage_job on public.ai_usage (job_id);

-- 3) 추천 기록(이슈 범위 5번). 이번 PR에서는 표만 만든다. 쓰는 코드는 다음 PR.
create table if not exists public.ai_recommendation_log (
  id uuid primary key default gen_random_uuid(),
  entry_id integer not null check (entry_id > 0),
  target_gw integer not null check (target_gw between 1 and 38),
  model_version text not null,
  -- 그 GW의 규칙 기반 추천 요약(선발 L1, 캡틴 1순위 ...).
  rules_summary jsonb not null,
  -- 마감 뒤 실제 결과. 아직 없으면 null.
  actual_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_recommendation_log_key_unique unique (entry_id, target_gw)
);

alter table public.ai_recommendations enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_recommendation_log enable row level security;

-- 정책을 만들지 않는다: anon·authenticated 는 아무것도 못 한다. 서버(service role)만 쓴다.
revoke all on public.ai_recommendations, public.ai_usage, public.ai_recommendation_log from anon, authenticated;
grant select, insert, update on public.ai_recommendations, public.ai_usage, public.ai_recommendation_log to service_role;

-- 상한 검사: 이번 달(UTC)·오늘(UTC)의 누적(예약+확정)에 이번 예약을 더해 본다. 호출하는 쪽이 이미 잠금을 잡고 있어야 한다.
create or replace function public.ai_budget_refusal(
  p_reserve_usd numeric,
  p_month_cap_usd numeric,
  p_day_cap_usd numeric,
  p_day_call_cap integer
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_month numeric;
  v_day numeric;
  v_calls integer;
begin
  select coalesce(sum(cost_usd), 0) into v_month
    from public.ai_usage
    where created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  select coalesce(sum(cost_usd), 0), count(*) into v_day, v_calls
    from public.ai_usage
    where created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_month + p_reserve_usd > p_month_cap_usd then
    return 'month_limit';
  end if;
  if v_day + p_reserve_usd > p_day_cap_usd then
    return 'day_limit';
  end if;
  if v_calls >= p_day_call_cap then
    return 'day_calls_limit';
  end if;
  return null;
end;
$$;

-- 작업 시작: 한 트랜잭션에서 전역 잠금을 잡고 진행 중 작업 여부 -> 세대·다시 분석 한도 -> 예산 -> 작업 행과 예약 행 삽입.
-- 돌려주는 값: {ok:true, job_id, usage_id, generation} 또는 {ok:false, reason: busy|exists|regen_limit|month_limit|day_limit|day_calls_limit}
create or replace function public.ai_start_job(
  p_entry_id integer,
  p_target_gw integer,
  p_locale text,
  p_kind text,
  p_input_hash text,
  p_model_id text,
  p_model_version text,
  p_basis jsonb,
  p_reserve_usd numeric,
  p_month_cap_usd numeric,
  p_day_cap_usd numeric,
  p_day_call_cap integer,
  p_max_generations integer,
  p_manual_per_day integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_manual integer;
  v_done boolean;
  v_generation integer;
  v_refusal text;
  v_job uuid;
  v_usage uuid;
begin
  if p_kind not in ('first', 'manual') or p_locale not in ('ko', 'en') or p_reserve_usd < 0 then
    raise exception 'ai_start_job: bad arguments';
  end if;

  -- 예산 합산과 삽입이 서로 끼어들지 않도록 전역 잠금(트랜잭션이 끝나면 풀린다).
  perform pg_advisory_xact_lock(hashtext('ai_budget'));

  if exists (
    select 1 from public.ai_recommendations
    where entry_id = p_entry_id and target_gw = p_target_gw and locale = p_locale and status = 'running'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  select count(*),
         count(*) filter (where request_kind = 'manual' and created_at > now() - interval '24 hours'),
         coalesce(bool_or(status = 'done'), false),
         coalesce(max(generation), 0)
    into v_total, v_manual, v_done, v_generation
    from public.ai_recommendations
    where entry_id = p_entry_id and target_gw = p_target_gw and locale = p_locale;

  if p_kind = 'first' and v_done then
    return jsonb_build_object('ok', false, 'reason', 'exists');
  end if;
  if v_total >= p_max_generations then
    return jsonb_build_object('ok', false, 'reason', 'regen_limit');
  end if;
  if p_kind = 'manual' and v_manual >= p_manual_per_day then
    return jsonb_build_object('ok', false, 'reason', 'regen_limit');
  end if;

  v_refusal := public.ai_budget_refusal(p_reserve_usd, p_month_cap_usd, p_day_cap_usd, p_day_call_cap);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
  end if;

  insert into public.ai_recommendations (
    entry_id, target_gw, locale, generation, request_kind, status, input_hash, model_id, model_version, basis
  ) values (
    p_entry_id, p_target_gw, p_locale, v_generation + 1, p_kind, 'running', p_input_hash, p_model_id, p_model_version, p_basis
  ) returning id into v_job;

  insert into public.ai_usage (job_id, attempt, reserved_usd, cost_usd, status)
    values (v_job, 1, p_reserve_usd, p_reserve_usd, 'reserved')
    returning id into v_usage;

  return jsonb_build_object('ok', true, 'job_id', v_job, 'usage_id', v_usage, 'generation', v_generation + 1);
end;
$$;

-- 재시도 호출의 예약: 진행 중인 작업에 사용량 행을 하나 더 넣는다(예산 검사 포함).
-- 돌려주는 값: {ok:true, usage_id} 또는 {ok:false, reason: job_not_running|month_limit|day_limit|day_calls_limit}
create or replace function public.ai_reserve_usage(
  p_job_id uuid,
  p_reserve_usd numeric,
  p_month_cap_usd numeric,
  p_day_cap_usd numeric,
  p_day_call_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_attempt integer;
  v_refusal text;
  v_usage uuid;
begin
  if p_reserve_usd < 0 then
    raise exception 'ai_reserve_usage: bad arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_budget'));

  select status into v_status from public.ai_recommendations where id = p_job_id;
  if v_status is distinct from 'running' then
    return jsonb_build_object('ok', false, 'reason', 'job_not_running');
  end if;

  v_refusal := public.ai_budget_refusal(p_reserve_usd, p_month_cap_usd, p_day_cap_usd, p_day_call_cap);
  if v_refusal is not null then
    return jsonb_build_object('ok', false, 'reason', v_refusal);
  end if;

  select coalesce(max(attempt), 0) + 1 into v_attempt from public.ai_usage where job_id = p_job_id;

  insert into public.ai_usage (job_id, attempt, reserved_usd, cost_usd, status)
    values (p_job_id, v_attempt, p_reserve_usd, p_reserve_usd, 'reserved')
    returning id into v_usage;

  return jsonb_build_object('ok', true, 'usage_id', v_usage);
end;
$$;

-- 함수 실행 권한: 기본값은 public 실행 가능이므로 회수하고 서비스 역할만 허용한다.
revoke all on function public.ai_budget_refusal(numeric, numeric, numeric, integer) from public, anon, authenticated;
revoke all on function public.ai_start_job(integer, integer, text, text, text, text, text, jsonb, numeric, numeric, numeric, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_reserve_usage(uuid, numeric, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.ai_budget_refusal(numeric, numeric, numeric, integer) to service_role;
grant execute on function public.ai_start_job(integer, integer, text, text, text, text, text, jsonb, numeric, numeric, numeric, integer, integer, integer) to service_role;
grant execute on function public.ai_reserve_usage(uuid, numeric, numeric, numeric, integer) to service_role;

commit;
