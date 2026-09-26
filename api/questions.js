import { getSupabaseAdmin } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { assignment_id } = req.query
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('questions')
    .select('id, order_index, title, prompt') // criteria 絕不回傳前端
    .eq('assignment_id', assignment_id)
    .order('order_index', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
