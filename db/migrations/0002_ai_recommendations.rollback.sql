-- 주의: AI 층의 작업 결과·사용량 기록·추천 기록이 영구 삭제된다. 실행 전 백업할 것.
-- 사용량 표를 지우면 이번 달 누적이 0으로 돌아가므로, 코드 쪽 AI_RECOMMEND_ENABLED 를 먼저 끄고(또는 키를 폐기하고) 실행한다.
-- 기존 표(journal_*)와 auth.users 는 건드리지 않는다.
begin;
drop function if exists public.ai_reserve_usage(uuid, numeric, numeric, numeric, integer);
drop function if exists public.ai_start_job(integer, integer, text, text, text, text, text, jsonb, numeric, numeric, numeric, integer, integer, integer);
drop function if exists public.ai_budget_refusal(numeric, numeric, numeric, integer);
drop table if exists public.ai_usage;
drop table if exists public.ai_recommendation_log;
drop table if exists public.ai_recommendations;
commit;
