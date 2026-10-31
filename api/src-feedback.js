// 📜 出處失傳的秘文（巫魚子教課事務所 wuyutzu-tools）專用的 AI 回饋 API（2026-10-19）
// 為什麼放在這裡：教課事務所是 GitHub Pages 靜態網站，沒有地方藏 Gemini 金鑰；
// 科普閱讀測驗已經有 Vercel 後端＋金鑰＋用量統計，所以借這裡開一支 API，用量一起算在「AI 用量統計」頁。
//
// POST /api/src-feedback
//   { code: 任務代碼(6碼), sid: 學號, kind: 'para' | 'dossier', original?, source?, text }
//   para    ：改寫練習。original＝原文、source＝原文出處（作者，年）、text＝學生改寫（含文中引用）
//   dossier ：結案作業。text＝學生的文獻探討段落、source＝學生的參考文獻清單（純文字）
// 回傳 { passed, feedback }；AI 只給提示、不幫學生改寫（小論文規定改寫不得由 AI 生成）
//
// 防濫用：①只接受教課事務所網域 ②任務必須存在於 Firebase、沒關閉、沒關掉 AI ③字數上限 ④同一任務每 10 分鐘最多 200 次
import { getSupabaseAdmin } from './_supabaseAdmin.js'
import { logAiUsage } from './_usageLog.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const FIREBASE = 'https://point-collection-stash-default-rtdb.asia-southeast1.firebasedatabase.app'
const ORIGINS = ['https://puff0223-chwu.github.io']
const LIMIT_PER_10MIN = 200

function cors(req, res) {
  const o = req.headers.origin || ''
  if (ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o)) res.setHeader('Access-Control-Allow-Origin', o)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

const clip = (s, n) => String(s || '').slice(0, n)

// 2026-10-20：AI 只判「內容改寫」；出處（文中引用）格式由教課事務所網頁自己檢查，避免 AI 因為全形／半形誤判
function paraPrompt(original, source, text) {
  return `你是一位親切但嚴謹的高中老師，正在指導學生練習「用自己的話改寫文獻」（全國高級中等學校小論文寫作比賽的引用規則）。

【原文】（出處：${source}）
${original}

【學生的改寫】
${text}

你只需要判斷「內容改寫」，不要管出處（作者、年份、括號）的格式，也不要管全形或半形標點——那些系統已經另外檢查了。

「過關」要同時符合：
1. 意思正確：保留原文的主要意思，沒有明顯曲解；加一點點自己的連結說明（例如「所以要好好洗手」）不算曲解，只有和原文矛盾、或原文完全沒提到的新研究結果才算不符合
2. 用自己的話：句子結構與用詞和原文有明顯不同，不是只把幾個詞換成同義詞
判斷要寬鬆合理：高中生的改寫只要大意正確、不是照抄就算過關，不要求文筆完美、也不要求每個細節都寫到。

回饋規則：
- 絕對不能幫學生改寫、不能給出示範句子、不能寫出可以直接抄的句子（小論文規定改寫不得由 AI 生成）
- passed 和 feedback 一定要一致：過關時 feedback 以「過關！」開頭，再用 1 句話具體肯定；沒過關時以「還差一點：」開頭，用 1～2 句話指出是「意思」還是「自己的話」沒做到，引導學生自己修改
- 不要提到出處、括號、全形半形
- 語氣親切、像在跟高中生說話，使用繁體中文
- 只回傳 JSON，不要有其他文字、不要用 markdown：{"passed": true 或 false, "feedback": "回饋內容"}`
}

function dossierPrompt(text, refs) {
  return `你是一位親切但嚴謹的高中老師，正在看學生小論文的「文獻探討」草稿（150～300 字）。格式（引用標示、參考文獻格式、字數）系統已經另外檢查過了，你只需要看「內容」。

【學生的文獻探討】
${text}

【學生列的參考文獻】
${refs}

請從這三個面向給回饋：
1. 有沒有把文獻的重點「整理、比較或串連」起來，而不是一篇一篇照抄摘要
2. 句子是不是學生自己的話、段落讀起來通不通順
3. 引用的內容和研究主題有沒有關係

回饋規則：
- 絕對不能幫學生改寫、不能給出示範段落或句子（小論文規定文章內容不得由 AI 生成）
- 用 2～3 句話：先具體肯定一個優點，再提出一個最值得改進的方向
- passed：三個面向都大致做到就是 true；有明顯問題（例如整段像摘要拼貼、和主題無關）就是 false
- 語氣親切、使用繁體中文
- 只回傳 JSON，不要有其他文字、不要用 markdown：{"passed": true 或 false, "feedback": "回饋內容"}`
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) })
    if (r.ok) {
      const data = await r.json()
      const t = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const m = t.replace(/```json|```/g, '').match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(m ? m[0] : t)
      return { passed: !!parsed.passed, feedback: String(parsed.feedback || '').slice(0, 400) }
    }
    lastError = `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`
    if (r.status === 503 || r.status === 429) { await new Promise((ok) => setTimeout(ok, 1200 * attempt)); continue }
    break
  }
  throw new Error(lastError || '未知錯誤')
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method === 'GET') {
    // GET ?usage=任務代碼：給教課事務所老師頁看 AI 用量（只有次數，沒有學生資料）
    const code = String((req.query && req.query.usage) || '').toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return res.status(200).json({ ok: true, service: 'src-feedback' }) // 健康檢查
    const supabase = getSupabaseAdmin()
    const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const q = (pattern, since) => { let x = supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }).like('endpoint', pattern); if (since) x = x.gte('created_at', since); return x }
    try {
      const [a, b, c, d, e] = await Promise.all([q(`src-%:${code}`, monthStart), q(`src-%:${code}`), q('src-%', monthStart), q('src-%'), supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }).gte('created_at', monthStart)])
      return res.status(200).json({ month_label: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`, mission_month: a.count || 0, mission_total: b.count || 0, src_month: c.count || 0, src_total: d.count || 0, all_month: e.count || 0 })
    } catch (err) {
      return res.status(200).json({ error: '暫時讀不到用量' })
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const origin = req.headers.origin || ''
  if (origin && !ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) return res.status(403).json({ error: 'forbidden' })

  const b = req.body || {}
  const code = String(b.code || '').toUpperCase(), sid = String(b.sid || '').toUpperCase(), kind = b.kind
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || !/^[A-Z0-9]{3,12}$/.test(sid) || !['para', 'dossier'].includes(kind)) return res.status(400).json({ error: '參數不正確' })
  const text = clip(b.text, kind === 'para' ? 600 : 1500).trim()
  if (text.length < 10) return res.status(400).json({ error: '內容太短' })

  // 任務要存在、沒關閉、沒關掉 AI（任務設定是公開可讀的）
  try {
    const r = await fetch(`${FIREBASE}/secret-source/m/${code}/meta.json`)
    const meta = r.ok ? await r.json() : null
    if (!meta) return res.status(404).json({ error: '找不到任務' })
    if (meta.closed || meta.ai === false) return res.status(403).json({ error: '這個任務沒有開啟 AI 回饋' })
  } catch (e) {
    return res.status(200).json({ error: '暫時連不上任務資料，請稍後再試。' })
  }

  const supabase = getSupabaseAdmin()
  const tag = `src-${kind}:${code}`
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await supabase.from('ai_usage_logs').select('id', { count: 'exact', head: true }).like('endpoint', `src-%:${code}`).gte('created_at', since)
    if ((count || 0) >= LIMIT_PER_10MIN) return res.status(200).json({ error: '全班同時送出的人太多了，請等 1 分鐘再送一次。' })
  } catch (e) { /* 限流查詢失敗就放行，不影響上課 */ }

  try {
    const prompt = kind === 'para' ? paraPrompt(clip(b.original, 600), clip(b.source, 120), text) : dossierPrompt(text, clip(b.source, 3000))
    const out = await callGemini(prompt)
    await logAiUsage(supabase, tag)
    return res.status(200).json(out)
  } catch (err) {
    try { await supabase.from('error_logs').insert({ student_name: `[src ${code}] ${sid}`, error_detail: ((/^HTTP 402/.test(String(err.message || ''))) ? '【AI 額度用完，請到 AI Studio 儲值】' : '') + String(err.message || err).slice(0, 1000) }) } catch (e) { }
    if (/^HTTP 402/.test(String(err.message || ''))) return res.status(200).json({ error: '老師的 AI 批改額度暫時用完，請通知老師。' })
    return res.status(200).json({ error: 'AI 老師目前比較忙碌，請稍等一下再送出一次。' })
  }
}
