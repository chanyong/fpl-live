-- 주의: 먼저 코드 쪽 #47 변경(팀 교체 API·team_changed_at 읽기)을 되돌릴 것. 되돌린 뒤에 실행한다.
-- team_changed_at 을 지우면 '바꾼 시각'이 사라져 30일 제한이 초기화된다. 팀 번호(fpl_team_id)와 다른 열·표는 건드리지 않는다.
begin;
drop function if exists public.journal_change_team(uuid, integer, integer);
alter table public.journal_profiles drop column if exists team_changed_at;
commit;
