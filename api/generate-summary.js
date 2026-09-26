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

  const prompt = `以下是一篇科普文章的網頁內容，請你幫忙寫一段 3-4 句話的摘要，說明這篇文章討論的主題與重點，用語氣中性、客觀的方式描述，這段摘要之後會被用來當作 AI 批改學生閱讀測驗答案的參考依據（學生看不到這段摘要）：

${articleText}

請直接回傳摘要文字，不要有任何其他說明或格式符號。`

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
    return res.status(200).json({ summary })
  } catch (err) {
    return res.status(500).json({ error: '生成摘要失敗，請稍後再試，或手動輸入摘要。' })
  }
}
