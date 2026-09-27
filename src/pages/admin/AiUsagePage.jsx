import { useEffect, useState } from 'react'

export default function AiUsagePage() {
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ai-usage')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setUsage(data)
      })
      .catch(() => setError('目前無法讀取用量統計，請稍後再試一次。'))
  }, [])

  return (
    <div className="paper section">
      <h2>AI 用量統計</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        這裡統計的是系統呼叫 AI（批改回饋、自動摘要、AI 出題、AI 產生評分規準）的「次數」，
        方便您大致掌握使用量的成長趨勢。這不是即時的費用或餘額，實際花費請以 Google AI Studio /
        Google Cloud 帳單為準。
      </p>

      {error && <p className="error-text">{error}</p>}

      {!error && !usage && <p className="empty-note">載入中...</p>}

      {usage && (
        <div className="row" style={{ marginTop: 20, marginBottom: 24 }}>
          <div className="paper" style={{ padding: '22px 26px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{usage.month_label} AI 呼叫次數</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', margin: '6px 0 0', color: 'var(--accent)' }}>
              {usage.month_count}
            </p>
          </div>
          <div className="paper" style={{ padding: '22px 26px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>累計總呼叫次數</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', margin: '6px 0 0' }}>
              {usage.total_count}
            </p>
          </div>
        </div>
      )}

      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
        className="teacher-link"
        style={{ display: 'inline-block' }}
      >
        前往 AI Studio 查餘額 / 帳單 ↗
      </a>
      <p className="muted" style={{ marginTop: 14, fontSize: '0.85rem' }}>
        提醒：如果您已升級到 Google Cloud 付費帳單，實際餘額與用量請在
        Google Cloud Console 的「帳單」頁面查看會更準確；上面這個連結會帶您到
        AI Studio，可以從那裡再連到完整的帳單管理頁面。
      </p>
    </div>
  )
}
