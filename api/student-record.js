import { getSupabaseAdmin } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { assignment_id, question_id, student_name } = req.query
  if (!assignment_id || !question_id || !student_name) {
    return res.status(400).json({ error: 'missing params' })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('student_records')
    .select('passed, attempt_number, created_at')
    .eq('assignment_id', assignment_id)
    .eq('question_id', question_id)
    .eq('student_name', student_name)
    .order('attempt_number', { ascending: false })
    .limit(1)

  if (error) return res.status(500).json({ error: error.message })

  const record = data?.[0]
  const passedRes = await supabase
    .from('student_records')
    .select('id')
    .eq('assignment_id', assignment_id)
    .eq('question_id', question_id)
    .eq('student_name', student_name)
    .eq('passed', true)
    .limit(1)

  return res.status(200).json({
    passed: (passedRes.data && passedRes.data.length > 0) || false,
    attempts: record?.attempt_number || 0,
  })
}
