import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../lib/settings.jsx'

export default function StudentHome() {
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')
  const [sortAsc, setSortAsc] = useState(false) // 預設由新到舊
  const { settings } = useSettings()

  useEffect(() => {
    setAssignments(null)
    fetch(`/api/assignments?sort=${sortAsc ? 'asc' : 'desc'}`)
      .then((r) => r.json())
      .then((data) => setAssignments(data))
      .catch(() => setError('目前無法載入作業列表，請稍後再試一次。'))
  }, [sortAsc])

  const bgStyle = settings.bg_image_url
    ? { backgroundImage: `url("${settings.bg_image_url}")` }
    : undefined

  return (
    <div className={`home-wrap ${settings.bg_image_url ? 'home-bg' : ''}`} style={bgStyle}>
      <div className="home-topbar">
        <span className="home-brand">📖 科普閱讀測驗</span>
        <Link to="/admin/login" className="teacher-link">教師後台</Link>
      </div>

      <div className="home-hero">
        <span className="home-kicker">閱讀 · 思考 · 表達</span>
        <h1>用自己的話，說出你讀懂了什麼</h1>
        <p className="home-sub">
          每篇測驗都由你親自作答，老師會給予引導式回饋——答對方向就過關，
          還沒到位也能不限次數修正，直到真正想清楚為止。
        </p>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        <div className="paper">
          <div className="section" style={{ paddingTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>選擇測驗</h2>
              {assignments && assignments.length > 0 && (
                <button className="secondary" onClick={() => setSortAsc(!sortAsc)}>
                  {sortAsc ? '編號 舊 → 新' : '編號 新 → 舊'}
                </button>
              )}
            </div>
            {error && <p className="error-text">{error}</p>}
            {!error && assignments === null && <p className="empty-note">載入中...</p>}
            {assignments && assignments.length === 0 && (
              <p className="empty-note">目前還沒有已發布的測驗，請稍後再回來看看。</p>
            )}
            {assignments && assignments.length > 0 && (
              <div className="assignment-list">
                {assignments.map((a) => (
                  <Link key={a.id} to={`/assignment/${a.id}`} className="assignment-card paper">
                    <span className="assignment-index">{String(a.seq_no).padStart(2, '0')}</span>
                    <span className="assignment-body">
                      <h3>{a.title}</h3>
                      <span>點選開始作答</span>
                    </span>
                    <span className="assignment-arrow">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="home-footer">© {new Date().getFullYear()} 巫魚子老師 科普閱讀測驗系統</p>
    </div>
  )
}
