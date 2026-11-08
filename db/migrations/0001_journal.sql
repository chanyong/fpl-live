-- 주간 경기 리뷰 일지 (이슈 #21). 적용 전 대표 승인 필요. 이 파일은 코드 저장소에만 있고 아직 어떤 DB에도 적용하지 않았다.
-- Supabase Postgres + Supabase Auth(이메일 가입). 저장하는 개인정보는 이메일(auth.users)과 FPL 팀 번호뿐이다.

create table if not exists public.journal_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  fpl_team_id integer not null,
  created_at timestamptz not null default now(),
  constraint journal_profiles_team_unique unique (fpl_team_id),
  constraint journal_profiles_team_positive check (fpl_team_id > 0)
);

-- 자동 저장분: 서버(service role)만 쓴다. 회원은 읽기만 가능.
create table if not exists public.journal_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  gw integer not null check (gw between 1 and 38),
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, gw)
);

-- 수기 작성분: 회원 본인이 읽고 쓴다.
create table if not exists public.journal_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  gw integer not null check (gw between 1 and 38),
  review text not null default '' check (char_length(review) <= 4000),
  good text not null default '' check (char_length(good) <= 4000),
  bad text not null default '' check (char_length(bad) <= 4000),
  plan text not null default '' check (char_length(plan) <= 4000),
  principles text not null default '' check (char_length(principles) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, gw)
);

alter table public.journal_profiles enable row level security;
alter table public.journal_snapshots enable row level security;
alter table public.journal_notes enable row level security;

create policy journal_profiles_select_own on public.journal_profiles
  for select using (auth.uid() = user_id);

create policy journal_snapshots_select_own on public.journal_snapshots
  for select using (auth.uid() = user_id);

create policy journal_notes_select_own on public.journal_notes
  for select using (auth.uid() = user_id);
create policy journal_notes_insert_own on public.journal_notes
  for insert with check (auth.uid() = user_id);
create policy journal_notes_update_own on public.journal_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy journal_notes_delete_own on public.journal_notes
  for delete using (auth.uid() = user_id);

-- profiles와 snapshots는 회원용 쓰기 정책이 없다. 가입 처리와 자동 저장은 서버의 service role 키로만 한다.
