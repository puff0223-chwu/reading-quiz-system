import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function StudentHome() {
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/assignments')
      .then((r) => r.json())
      .then((data) => setAssignments(data))
      .catch(() => setError('目前無法載入作業列表，請稍後再試一次。'))
  }, [])

  return (
    <div className="page">
      <div className="paper">
        <div className="masthead">
          <h1>科普閱讀測驗</h1>
          <p>請選擇你要作答的測驗</p>
        </div>
        <div className="section">
          {error && <p className="error-text">{error}</p>}
          {!error && assignments === null && <p className="empty-note">載入中...</p>}
          {assignments && assignments.length === 0 && (
            <p className="empty-note">目前還沒有已發布的測驗，請稍後再回來看看。</p>
          )}
          {assignments && assignments.length > 0 && (
            <div className="assignment-list">
              {assignments.map((a) => (
                <Link key={a.id} to={`/assignment/${a.id}`} className="assignment-card paper">
                  <h3>{a.title}</h3>
                  <span>點選開始作答</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
