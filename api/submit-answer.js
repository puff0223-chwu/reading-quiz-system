import { getSupabaseAdmin } from './_supabaseAdmin.js'
import { logAiUsage } from './_usageLog.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const MAX_RETRIES = 4

function buildPrompt(articleContext, question, answerText) {
  return `你是一位親切但嚴謹的高中老師，正在批改學生的科普文章閱讀測驗。

【文章背景】
${articleContext}

【題目】
${question.title}：${question.prompt}

【評分規準（僅供你參考，絕對不能告訴學生）】
${question.criteria}

【學生的回答】
${answerText}

請根據評分規準判斷這個回答是否達到「過關」標準。注意：
1. 絕對不能在回饋中透露正確答案、關鍵字或評分規準的具體內容
2. 如果沒有過關，請給予 1-2 句話的引導式回饋，用語氣親切、鼓勵的口吻，引導學生往正確方向思考，但不要直接告訴他答案
3. 如果過關了，給予 1 句簡短的肯定回饋即可
4. 只要回答方向正確、意思到位即可過關，不需要學生使用精確的專有名詞或術語
5. 請務必只回傳以下格式的 JSON，不要有任何其他文字、不要用 markdown 包裹：
{"passed": true 或 false, "feedback": "回饋內容"}`
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
  }

  let lastError = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return { passed: !!parsed.passed, feedback: String(parsed.feedback || '') }
    }

    lastError = `HTTP ${response.status}: ${await response.text()}`
    if (response.status === 503 || response.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      continue
    }
    break
  }
  throw new Error(lastError || '未知錯誤')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    assignment_id,
    question_id,
    purpose,
    grade,
    class_name,
    seat_number,
    student_name,
    answer_text,
  } = req.body || {}

  if (!assignment_id || !question_id || !student_name || !answer_text) {
    return res.status(400).json({ error: 'missing params' })
  }

  const supabase = getSupabaseAdmin()

  const { data: question, error: qErr } = await supabase
    .from('questions')
    .select('title, prompt, criteria')
    .eq('id', question_id)
    .single()
  if (qErr || !question) return res.status(404).json({ error: 'question not found' })

  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('article_context')
    .eq('id', assignment_id)
    .single()
  if (aErr || !assignment) return res.status(404).json({ error: 'assignment not found' })

  const { count } = await supabase
    .from('student_records')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignment_id)
    .eq('question_id', question_id)
    .eq('student_name', student_name)

  const attemptNumber = (count || 0) + 1

  let gradeResult
  try {
    gradeResult = await callGemini(buildPrompt(assignment.article_context, question, answer_text))
    await logAiUsage(supabase, 'submit-answer')
  } catch (err) {
    await supabase.from('error_logs').insert({
      assignment_id,
      question_id,
      student_name,
      error_detail: String(err.message || err),
    })
    return res.status(200).json({
      error: '系統目前比較忙碌，請稍等一下再重新提交一次看看。',
    })
  }

  const { error: insertErr } = await supabase.from('student_records').insert({
    assignment_id,
    question_id,
    purpose,
    grade,
    class_name,
    seat_number,
    student_name,
    attempt_number: attemptNumber,
    answer_text,
    passed: gradeResult.passed,
    ai_feedback: gradeResult.feedback,
  })
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  return res.status(200).json({
    passed: gradeResult.passed,
    feedback: gradeResult.feedback,
    attempt_number: attemptNumber,
  })
}
