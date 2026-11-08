-- 주의: 일지 데이터(프로필·자동 저장·수기 노트)가 영구 삭제된다. 실행 전 백업할 것.
-- auth.users의 가입자(이메일)는 지우지 않는다. 일지 테이블만 지운다.
begin;
drop table if exists public.journal_notes;
drop table if exists public.journal_snapshots;
drop table if exists public.journal_profiles;
commit;
