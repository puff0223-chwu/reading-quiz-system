const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { article_context, count } = req.body || {}
  if (!article_context) return res.status(400).json({ error: '請先填寫文章摘要，再產生題目' })

  const n = Math.min(Math.max(Number(count) || 4, 1), 8)

  const prompt = `你是一位很會出「素養題」的高中老師，正在為以下這篇科普文章設計閱讀測驗題目。

【文章摘要】
${article_context}

請設計 ${n} 題簡答題（不要選擇題），符合以下原則：
1. 題目類型盡量多樣：包含「概念說明」「機制延伸」「情境應用」「因果說明」「科學思辨」等不同類型，不要都問同一種角度
2. 題目要能引導學生用自己的話統整、思考，而不是直接從文章找一句話抄下來就能回答
3. 每一題都要附上「評分規準」，說明怎樣的回答內容算是過關（重點涵蓋哪些概念），規準要具體但保有彈性，不要求學生使用精確術語，只要意思到位即可
4. 「科學思辨」類型的題目，評分規準不應限定特定立場，只要求學生有合理論述即可

請直接回傳一個 JSON 陣列，不要有任何其他文字、不要用 markdown 包裹，格式如下：
[
  {"title": "小標題（4個字以內，例如：概念說明）", "prompt": "完整題目文字", "criteria": "評分規準說明"}
]`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 },
      }),
    })
    if (!geminiRes.ok) throw new Error(`HTTP ${geminiRes.status}`)
    const data = await geminiRes.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const questions = JSON.parse(cleaned)
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('empty')
    return res.status(200).json({ questions })
  } catch (err) {
    return res.status(500).json({ error: 'AI 出題失敗，請稍後再試一次，或手動新增題目。' })
  }
}
