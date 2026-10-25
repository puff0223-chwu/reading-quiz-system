-- 作業編號改成「自動遞補＋老師可自行調整」（2026-10-26）
-- 在 Supabase → SQL Editor 貼上整段執行一次即可（可重複執行，不會壞）。
--
-- 規則：
--   1. 新增作業：自動排在最後（目前最大編號 + 1）
--   2. 刪除作業：後面的編號自動往前遞補，不留空號
--   3. 老師在後台點編號可以改：把這份作業「移到」指定位置，其他作業自動順移（不會有重複編號）

-- 不再用 sequence 發號，也不再要求編號唯一（順移時會暫時重複，由函式一次整理好）
drop index if exists assignments_seq_no_idx;
alter table assignments alter column seq_no drop default;
create index if not exists assignments_seq_no_order_idx on assignments (seq_no);

-- 1. 新增時自動排最後
create or replace function assignments_set_seq_no() returns trigger
language plpgsql as $$
begin
  if new.seq_no is null then
    select coalesce(max(seq_no), 0) + 1 into new.seq_no from assignments;
  end if;
  return new;
end $$;

drop trigger if exists trg_assignments_set_seq_no on assignments;
create trigger trg_assignments_set_seq_no
  before insert on assignments
  for each row execute function assignments_set_seq_no();

-- 2. 刪除後，後面的編號往前遞補
create or replace function assignments_close_gap() returns trigger
language plpgsql as $$
begin
  update assignments set seq_no = seq_no - 1 where seq_no > old.seq_no;
  return old;
end $$;

drop trigger if exists trg_assignments_close_gap on assignments;
create trigger trg_assignments_close_gap
  after delete on assignments
  for each row execute function assignments_close_gap();

-- 3. 老師手動調整編號：把作業移到指定位置，其他作業順移
create or replace function move_assignment(p_id uuid, p_new_no int) returns void
language plpgsql as $$
declare
  v_old int;
  v_max int;
  v_new int;
begin
  select seq_no into v_old from assignments where id = p_id;
  if v_old is null then raise exception '找不到這份作業'; end if;
  select count(*) into v_max from assignments;
  v_new := greatest(1, least(p_new_no, v_max));
  if v_new = v_old then return; end if;

  if v_new < v_old then
    update assignments set seq_no = seq_no + 1 where seq_no >= v_new and seq_no < v_old;
  else
    update assignments set seq_no = seq_no - 1 where seq_no > v_old and seq_no <= v_new;
  end if;
  update assignments set seq_no = v_new where id = p_id;
end $$;

grant execute on function move_assignment(uuid, int) to authenticated, service_role;

-- 一次性整理：把現有編號依原本順序重排成 1、2、3…（補上已刪除留下的空號）
with ordered as (
  select id, row_number() over (order by seq_no asc, created_at asc) as rn
  from assignments
)
update assignments a set seq_no = ordered.rn
from ordered where a.id = ordered.id and a.seq_no <> ordered.rn;
