import { getSupabaseAdmin } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ascending = req.query.sort === 'asc'

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('assignments')
    .select('id, title, seq_no')
    .eq('status', 'published')
    .order('seq_no', { ascending })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
