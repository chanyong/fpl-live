-- 회원의 FPL 팀 등록·교체(이슈 #47): journal_profiles 에 team_changed_at 열 1개, 팀 교체 함수 1개.
-- 이 파일은 코드 저장소에만 있고 아직 어떤 DB에도 적용하지 않았다. 적용은 관제 창이 L2 절차로 한다(대표 사전 위임: 추가형 마이그레이션).
--
-- [추가형이라 이전 코드와 충돌하지 않는 이유]
--   null 허용 열 1개(기본값 없음)와 새 함수 1개만 더한다. 기존 열·표·정책·함수는 바꾸지도 지우지도 않는다.
--   null 허용 열이라 기존 행은 그대로 유효하고(team_changed_at = null: 아직 한 번도 바꾸지 않음 = 바로 바꿀 수 있음),
--   지금 배포돼 있는 코드는 이 열을 읽지도 쓰지도 않으므로 적용만으로는 아무 영향이 없다. 가입·자동 저장·일지 코드도 그대로 돈다.
--   새 함수는 이 파일 이후의 코드만 부른다. 빌드·프리렌더는 이 표를 읽지 않는다.
-- [적용 순서] 운영 DB에 이 파일을 먼저 적용(관제 창, L2) -> 그 뒤에 #47 PR 병합. 새 코드는 team_changed_at 열을 읽으므로
--   열이 없는 채로 병합하면 회원 프로필 조회가 실패한다.
-- [롤백] 0003_journal_team_change.rollback.sql (함수와 열을 지운다. 지우기 전에 코드 쪽 #47 변경을 먼저 되돌릴 것. 열을 지우면 '바꾼 시각'이 사라져 30일 제한이 초기화된다).
-- [권한] 함수는 security definer + search_path 고정(0002 와 같은 방식) + public·anon·authenticated 실행 회수, service_role 만 실행.
--   journal_profiles 의 RLS·정책·권한(회원은 자기 행 읽기만)은 그대로이므로 회원이 직접 팀을 바꿀 길은 열리지 않는다. 바꾸기는 서버(service role)가 이 함수로만 한다.
-- 적용은 SQL 편집기나 psql로 한다(파일에 begin/commit 포함). supabase CLI migration 흐름은 쓰지 않는다.
begin;

alter table public.journal_profiles add column if not exists team_changed_at timestamptz;

-- 팀 교체: 한 트랜잭션에서 프로필 행 잠금 -> 같은 팀 -> 대기 기간 -> 갱신 -> 자동 저장 기록 삭제.
-- p_cooldown_days 일 안에 다시 바꾸는 것은 막는다(남의 팀을 차례로 분석하는 통로가 되지 않도록). 첫 변경(team_changed_at 이 null)은 바로 된다.
-- 자동 저장 기록(journal_snapshots)은 옛 팀 것이라 지운다. 직접 쓴 메모(journal_notes)는 남긴다.
-- 프로필이 없는 회원(가입 때 프로필 저장이 실패한 경우)에게는 새로 만들어 준다(team_changed_at = null).
-- 돌려주는 값: {ok:true} 또는 {ok:false, reason: same_team|team_taken|too_soon, next_change_at?: timestamptz(too_soon 일 때)}
create or replace function public.journal_change_team(
  p_user uuid,
  p_team integer,
  p_cooldown_days integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_found boolean;
  v_current integer;
  v_changed timestamptz;
  v_next timestamptz;
  v_constraint text;
begin
  if p_user is null or p_team is null or p_team <= 0 or p_cooldown_days is null or p_cooldown_days < 0 then
    raise exception 'journal_change_team: bad arguments';
  end if;

  select fpl_team_id, team_changed_at into v_current, v_changed
    from public.journal_profiles
    where user_id = p_user
    for update;
  v_found := found;

  if v_found then
    if v_current = p_team then
      return jsonb_build_object('ok', false, 'reason', 'same_team');
    end if;

    if v_changed is not null then
      v_next := v_changed + make_interval(days => p_cooldown_days);
      if v_next > now() then
        return jsonb_build_object('ok', false, 'reason', 'too_soon', 'next_change_at', v_next);
      end if;
    end if;

    begin
      update public.journal_profiles
        set fpl_team_id = p_team, team_changed_at = now()
        where user_id = p_user;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'journal_profiles_team_unique' then
        return jsonb_build_object('ok', false, 'reason', 'team_taken');
      end if;
      raise;
    end;

    delete from public.journal_snapshots where user_id = p_user;
    return jsonb_build_object('ok', true);
  end if;

  -- 프로필이 없는 회원: 새로 만든다. 처음 등록이므로 team_changed_at 은 비워 둔다(30일 제한은 첫 '바꾸기'부터).
  begin
    insert into public.journal_profiles (user_id, fpl_team_id) values (p_user, p_team);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'journal_profiles_team_unique' then
      return jsonb_build_object('ok', false, 'reason', 'team_taken');
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true);
end;
$$;

-- 함수 실행 권한: 기본값은 public 실행 가능이므로 회수하고 서비스 역할만 허용한다.
revoke all on function public.journal_change_team(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.journal_change_team(uuid, integer, integer) to service_role;

commit;
