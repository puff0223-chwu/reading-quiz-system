import { getSupabaseAdmin } from './_supabaseAdmin.js'
import { logAiUsage } from './_usageLog.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { article_context, title, prompt: questionPrompt } = req.body || {}
  if (!article_context || !questionPrompt) {
    return res.status(400).json({ error: '請先填寫文章摘要與題目內容，AI 才能設計評分規準' })
  }

  // 「重新產生」要能給出不一樣的結果。以前是靠調高 temperature 參數讓 AI 隨機一點，
  // 但 Gemini 之後的新模型會讓這種參數直接噴錯，所以改用「每次換一個角度切入」的提示詞來製造變化。
  const angles = [
    '這次請特別著重「學生要能具體指出文章中的哪些關鍵資訊」這個角度來寫規準',
    '這次請特別著重「學生的推理或因果邏輯要說得通」這個角度來寫規準',
    '這次請用比較精簡扼要的方式來寫規準，抓最核心的 1-2 個重點就好',
    '這次請用比較完整涵蓋多個面向的方式來寫規準，盡量把不同可能的切入點都考慮進去',
    '這次請特別著重「用詞是否精準、是否有誤解文章內容」這個角度來寫規準',
  ]
  const angle = angles[Math.floor(Math.random() * angles.length)]

  const prompt = `你是一位很會設計評分規準的高中老師。以下是一篇科普文章的摘要，以及老師自己出的一道簡答題，請你幫這一題設計「評分規準」。${angle}。

【文章摘要】
${article_context}

【題目小標題】
${title || '（無）'}

【題目內容】
${questionPrompt}

請設計評分規準，符合以下原則：
1. 具體說明學生的回答要涵蓋哪些重點概念才算過關，但保有彈性，不要求學生使用精確的專有名詞，只要意思到位即可
2. 如果這題屬於開放性的思辨、立場討論類型，規準不應限定特定立場，只要求學生有合理論述即可
3. 規準是要給 AI 批改系統參考用的，寫得具體、可操作，但不要寫成另一份「範例答案」（不要直接寫出一句可以照抄的完整答案）
4. 長度約 2-4 句話即可

請直接回傳評分規準文字，不要有任何其他說明或 markdown 格式符號。`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })
    if (!geminiRes.ok) throw new Error(`HTTP ${geminiRes.status}`)
    const data = await geminiRes.json()
    const criteria = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    if (!criteria) throw new Error('empty')
    await logAiUsage(getSupabaseAdmin(), 'generate-criteria')
    return res.status(200).json({ criteria })
  } catch (err) {
    return res.status(500).json({ error: 'AI 產生評分規準失敗，請稍後再試一次。' })
  }
}
