# 科普閱讀測驗系統（reading-quiz-system）

AI 批改的科普文章閱讀測驗系統。學生用自己的話回答簡答題，AI 只給過關/引導回饋，絕不洩漏正確答案，可不限次數修正重新提交。

## 技術棧
- 前端：React + Vite
- 後端：Vercel Serverless Functions（`/api`）
- 資料庫＋Auth：Supabase
- AI 批改：Gemini API

## 初次設定

1. **資料庫**：到 Supabase 專案的 SQL Editor，貼上並執行 `supabase/schema.sql`
2. **建立老師帳號**：Supabase 後台 → Authentication → Users → Add user，用 Email + 密碼建立老師登入帳號
3. **Vercel 環境變數**（Project Settings → Environment Variables）：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`（後端專用，絕不可用 `VITE_` 前綴）
   - `GEMINI_API_KEY`
   - `VITE_SUPABASE_URL`（前端用，值同 `SUPABASE_URL`）
   - `VITE_SUPABASE_ANON_KEY`（前端用，值同 `SUPABASE_ANON_KEY`）
   - `GEMINI_MODEL`（選填，預設 `gemini-flash-latest`）
4. 環境變數設定完後，到 Vercel 專案點 **Redeploy** 重新部署一次

## 本機開發
\`\`\`
npm install
npm run dev
\`\`\`
