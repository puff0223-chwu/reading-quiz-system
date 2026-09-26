import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import * as XLSX from 'xlsx'

export default function RecordsPage() {
  const [assignments, setAssignments] = useState([])
  const [records, setRecords] = useState([])
  const [filterAssignment, setFilterAssignment] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('assignments').select('id, title').then(({ data }) => setAssignments(data || []))
  }, [])

  useEffect(() => {
    load()
  }, [filterAssignment])

  async function load() {
    let query = supabase
      .from('student_records')
      .select('*, questions(title, order_index), assignments(title)')
      .order('created_at', { ascending: false })
    if (filterAssignment) query = query.eq('assignment_id', filterAssignment)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setRecords(data || [])
  }

  const filtered = records.filter((r) => {
    if (filterClass && !r.class_name?.includes(filterClass)) return false
    if (filterName && !r.student_name?.includes(filterName)) return false
    if (filterResult === 'passed' && !r.passed) return false
    if (filterResult === 'failed' && r.passed) return false
    return true
  })

  function exportExcel() {
    const rows = filtered.map((r) => ({
      作業: r.assignments?.title,
      題目: r.questions?.title,
      用途: r.purpose,
      年級: r.grade,
      班級: r.class_name,
      座號: r.seat_number,
      姓名: r.student_name,
      嘗試次數: r.attempt_number,
      作答內容: r.answer_text,
      是否過關: r.passed ? '過關' : '未過關',
      AI回饋: r.ai_feedback,
      時間: new Date(r.created_at).toLocaleString('zh-TW'),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '學生紀錄')
    XLSX.writeFile(wb, `學生紀錄_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="paper section">
      <h2>學生紀錄</h2>
      <div className="filters">
        <select value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}>
          <option value="">所有作業</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        <input type="text" placeholder="篩選班級" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} />
        <input type="text" placeholder="篩選姓名" value={filterName} onChange={(e) => setFilterName(e.target.value)} />
        <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
          <option value="">所有結果</option>
          <option value="passed">✅ 過關</option>
          <option value="failed">未過關</option>
        </select>
        <button className="secondary" onClick={exportExcel}>匯出 Excel</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>作業</th>
            <th>題目</th>
            <th>班級座號</th>
            <th>姓名</th>
            <th>次數</th>
            <th>結果</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{r.assignments?.title}</td>
              <td>{r.questions?.title}</td>
              <td>{r.class_name} {r.seat_number}號</td>
              <td>{r.student_name}</td>
              <td>{r.attempt_number}</td>
              <td>{r.passed ? '✅ 過關' : '未過關'}</td>
              <td className="muted">{new Date(r.created_at).toLocaleString('zh-TW')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty-note">沒有符合條件的紀錄</p>}
    </div>
  )
}
