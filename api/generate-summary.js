import { getSupabaseAdmin } from './_supabaseAdmin.js'
import { logAiUsage } from './_usageLog.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { article_url } = req.body || {}
  if (!article_url) return res.status(400).json({ error: 'article_url is required' })

  let articleText
  try {
    const pageRes = await fetch(article_url)
    const html = await pageRes.text()
    articleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)
  } catch (err) {
    return res.status(400).json({ error: '無法抓取這個網址的內容，請確認網址是否正確。' })
  }

  const prompt = `以下是一篇科普文章的網頁內容，請你幫忙寫一份「詳細摘要」。這份摘要之後會被用來當作 AI 批改學生閱讀測驗答案的唯一參考依據（學生看不到這段摘要，出題與評分都只會根據這份摘要，不會再回頭讀原文），所以請盡量完整、具體地保留文章的實質內容，寫作時請遵守：

1. 依照文章的論述脈絡分段整理（例如：背景／核心機制或原理／關鍵數據或研究結果／因果關係／結論或建議），每個重點都要寫出具體內容，不要只寫「文章提到了...」這種空泛帶過的句子
2. 保留文章中重要的專有名詞、數據、因果邏輯、比較關係，這些是之後出題與評分的依據
3. 若文章中有分正反面、優缺點、或不同立場的討論，都要完整保留，不要只取其中一面
4. 長度不限，寫到能完整涵蓋文章重點即可，通常會是 200-400 字

文章網頁內容如下：

${articleText}

請直接回傳摘要文字（可以用換行分段），不要有任何其他說明或 markdown 格式符號。`

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    if (!geminiRes.ok) throw new Error(`HTTP ${geminiRes.status}`)
    const data = await geminiRes.json()
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    if (!summary) throw new Error('empty summary')
    await logAiUsage(getSupabaseAdmin(), 'generate-summary')
    return res.status(200).json({ summary })
  } catch (err) {
    return res.status(500).json({ error: '生成摘要失敗，請稍後再試，或手動輸入摘要。' })
  }
}
