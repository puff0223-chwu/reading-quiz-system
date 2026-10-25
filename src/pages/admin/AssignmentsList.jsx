import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AssignmentsList() {
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')
  const [sortAsc, setSortAsc] = useState(false) // 預設由新到舊
  const [editingId, setEditingId] = useState(null)
  const navigate = useNavigate()

  async function load(ascending = sortAsc) {
    const { data, error: err } = await supabase
      .from('assignments')
      .select('*')
      .order('seq_no', { ascending })
    if (err) setError(err.message)
    else setAssignments(data)
  }

  useEffect(() => {
    load(sortAsc)
  }, [sortAsc])

  async function createNew() {
    const { data, error: err } = await supabase
      .from('assignments')
      .insert({ title: '未命名作業', article_url: '', article_context: '' })
      .select()
      .single()
    if (err) {
      setError(err.message)
      return
    }
    navigate(`/admin/assignments/${data.id}`)
  }

  async function togglePublish(a) {
    const nextStatus = a.status === 'published' ? 'draft' : 'published'
    const { error: err } = await supabase.from('assignments').update({ status: nextStatus }).eq('id', a.id)
    if (err) setError(err.message)
    else load()
  }

  // 老師手動改編號：把這份作業移到指定位置，其他作業自動順移
  async function changeNo(a, value) {
    const n = parseInt(value, 10)
    setEditingId(null)
    if (!Number.isFinite(n) || n < 1 || n === a.seq_no) return
    const { error: err } = await supabase.rpc('move_assignment', { p_id: a.id, p_new_no: n })
    if (err) setError(err.message)
    else load()
  }

  async function remove(a) {
    if (!confirm(`確定要刪除「${a.title}」嗎？此動作無法復原，底下所有題目與學生紀錄也會一併刪除。`)) return
    const { error: err } = await supabase.from('assignments').delete().eq('id', a.id)
    if (err) setError(err.message)
    else load()
  }

  return (
    <div className="paper">
      <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>作業管理</h2>
        <button onClick={createNew}>+ 新增作業</button>
      </div>
      <div className="section">
        {error && <p className="error-text">{error}</p>}
        {assignments && assignments.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="muted" style={{ margin: '0 0 8px' }}>
              新增的作業會自動排在最後；刪除後編號會自動遞補。點編號可以改成想要的位置，其他作業會自動順移。
            </p>
            <button className="secondary" onClick={() => setSortAsc(!sortAsc)}>
              {sortAsc ? '目前：編號 舊 → 新' : '目前：編號 新 → 舊'}（點擊切換）
            </button>
          </div>
        )}
        {!assignments && <p className="empty-note">載入中...</p>}
        {assignments && assignments.length === 0 && <p className="empty-note">還沒有任何作業，點右上角新增一個吧。</p>}
        {assignments && assignments.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>編號</th>
                <th>標題</th>
                <th>狀態</th>
                <th>建立時間</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="muted">
                    {editingId === a.id ? (
                      <input
                        type="number"
                        min="1"
                        max={assignments.length}
                        defaultValue={a.seq_no}
                        autoFocus
                        style={{ width: 64 }}
                        onBlur={(e) => changeNo(a, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      <button
                        className="secondary"
                        title="點一下可以修改編號（會移到該位置，其他作業自動順移）"
                        onClick={() => setEditingId(a.id)}
                        style={{ minWidth: 40, padding: '2px 10px' }}
                      >
                        {a.seq_no}
                      </button>
                    )}
                  </td>
                  <td><Link to={`/admin/assignments/${a.id}`}>{a.title}</Link></td>
                  <td>
                    <span className={`status-pill ${a.status}`}>
                      {a.status === 'published' ? '已發布' : '草稿'}
                    </span>
                  </td>
                  <td className="muted">{new Date(a.created_at).toLocaleDateString('zh-TW')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="secondary" onClick={() => togglePublish(a)}>
                      {a.status === 'published' ? '取消發布' : '發布'}
                    </button>{' '}
                    <button className="danger" onClick={() => remove(a)}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
