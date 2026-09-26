import { getSupabaseAdmin } from './_supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { assignment_id, rows } = req.body || {}
  if (!assignment_id || !Array.isArray(rows)) return res.status(400).json({ error: 'missing params' })

  const supabase = getSupabaseAdmin()

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, title')
    .eq('assignment_id', assignment_id)
  if (qErr) return res.status(500).json({ error: qErr.message })

  const titleToId = {}
  for (const q of questions) titleToId[q.title] = q.id

  const toInsert = []
  for (const row of rows) {
    const questionTitle = row['題目']
    const questionId = titleToId[questionTitle]
    if (!questionId) continue // 找不到對應題目的資料略過
    toInsert.push({
      assignment_id,
      question_id: questionId,
      purpose: row['用途'] || '進度學習',
      grade: row['年級'] || '',
      class_name: String(row['班級'] || ''),
      seat_number: String(row['座號'] || ''),
      student_name: String(row['姓名'] || ''),
      attempt_number: Number(row['嘗試次數']) || 1,
      answer_text: String(row['作答內容'] || ''),
      passed: row['是否過關'] === '過關' || row['是否過關'] === true,
      ai_feedback: String(row['AI回饋'] || ''),
    })
  }

  if (toInsert.length === 0) {
    return res.status(400).json({ error: '沒有任何資料可以匯入，請確認欄位名稱與題目標題是否對應正確。' })
  }

  const { error: insertErr } = await supabase.from('student_records').insert(toInsert)
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  return res.status(200).json({ inserted: toInsert.length })
}
