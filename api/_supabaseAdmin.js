import { createClient } from '@supabase/supabase-js'

// 後端專用的 Supabase client，使用 service role key，繞過 RLS。
// 絕對不能把這把金鑰放到任何 VITE_ 開頭的前端環境變數。
export function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}
