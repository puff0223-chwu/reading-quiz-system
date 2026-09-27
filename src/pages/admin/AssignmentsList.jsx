import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AssignmentsList() {
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')
  const [sortAsc, setSortAsc] = useState(false) // 預設由新到舊
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
                  <td className="muted">{a.seq_no}</td>
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
