-- 科普閱讀測驗系統 資料庫結構
-- 使用方式：在 Supabase 後台 SQL Editor 貼上整份執行一次即可

-- 作業（每份閱讀文章對應一筆）
create table assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  article_url text not null,
  article_context text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 題目（每題歸屬一份作業，數量不限）
create table questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  order_index int not null default 0,
  title text not null,
  prompt text not null,
  criteria text not null,
  created_at timestamptz not null default now()
);

-- 學生作答紀錄
create table student_records (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  purpose text not null,
  grade text not null,
  class_name text not null,
  seat_number text not null,
  student_name text not null,
  attempt_number int not null,
  answer_text text not null,
  passed boolean not null,
  ai_feedback text not null,
  created_at timestamptz not null default now()
);

-- 錯誤紀錄
create table error_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid,
  question_id uuid,
  student_name text,
  error_detail text not null,
  created_at timestamptz not null default now()
);

-- 外觀設定（首頁主題色、背景圖片網址等，key-value 儲存）
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create index idx_student_records_assignment on student_records(assignment_id);
create index idx_student_records_question on student_records(question_id);
create index idx_questions_assignment on questions(assignment_id);

-- Row Level Security
alter table assignments enable row level security;
alter table questions enable row level security;
alter table student_records enable row level security;
alter table error_logs enable row level security;
alter table settings enable row level security;

create policy "public can read published assignments" on assignments
  for select using (status = 'published');
create policy "authenticated can manage assignments" on assignments
  for all using (auth.role() = 'authenticated');

create policy "public can read questions of published assignments" on questions
  for select using (
    exists (select 1 from assignments a where a.id = assignment_id and a.status = 'published')
  );
create policy "authenticated can manage questions" on questions
  for all using (auth.role() = 'authenticated');

create policy "anon can insert student records" on student_records
  for insert with check (true);
create policy "authenticated can read student records" on student_records
  for select using (auth.role() = 'authenticated');
create policy "authenticated can delete student records" on student_records
  for delete using (auth.role() = 'authenticated');

create policy "authenticated can read error logs" on error_logs
  for select using (auth.role() = 'authenticated');

-- settings：所有人（含學生端）可讀，只有登入老師可修改
create policy "public can read settings" on settings
  for select using (true);
create policy "authenticated can manage settings" on settings
  for all using (auth.role() = 'authenticated');

-- 基本資料表權限（RLS 政策生效前，角色本身要先有這些權限）
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
