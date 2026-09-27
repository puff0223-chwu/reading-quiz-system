import { getSupabaseAdmin } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count: monthCount, error: monthErr } = await supabase
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart)

  const { count: totalCount, error: totalErr } = await supabase
    .from('ai_usage_logs')
    .select('id', { count: 'exact', head: true })

  if (monthErr || totalErr) {
    return res.status(500).json({ error: (monthErr || totalErr).message })
  }

  return res.status(200).json({
    month_count: monthCount || 0,
    total_count: totalCount || 0,
    month_label: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`,
  })
}
