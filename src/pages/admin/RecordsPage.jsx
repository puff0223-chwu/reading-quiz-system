import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import * as XLSX from 'xlsx'

export default function RecordsPage() {
  const [assignments, setAssignments] = useState([])
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [filterAssignment, setFilterAssignment] = useState('')
  const [filterQuestion, setFilterQuestion] = useState('')
  const [filterPurpose, setFilterPurpose] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [batchFrom, setBatchFrom] = useState('')
  const [batchTo, setBatchTo] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchNote, setBatchNote] = useState('')

  useEffect(() => {
    supabase.from('assignments').select('id, title').then(({ data }) => setAssignments(data || []))
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAssignment, dateFrom, dateTo])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('student_records')
      .select('*, questions(title, order_index), assignments(title)')
      .order('created_at', { ascending: false })
    if (filterAssignment) query = query.eq('assignment_id', filterAssignment)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setRecords(data || [])
    setSelected(new Set())
    setLoading(false)
  }

  const questionOptions = [...new Map(records.map((r) => [r.questions?.title, r.questions?.title])).keys()].filter(Boolean)

  const filtered = records.filter((r) => {
    if (filterQuestion && r.questions?.title !== filterQuestion) return false
    if (filterPurpose && r.purpose !== filterPurpose) return false
    if (filterGrade && r.grade !== filterGrade) return false
    if (filterClass && !r.class_name?.includes(filterClass)) return false
    if (filterName && !r.student_name?.includes(filterName)) return false
    if (filterResult === 'passed' && !r.passed) return false
    if (filterResult === 'failed' && r.passed) return false
    return true
  })

  function resetFilters() {
    setFilterAssignment('')
    setFilterQuestion('')
    setFilterPurpose('')
    setFilterGrade('')
    setFilterClass('')
    setFilterName('')
    setFilterResult('')
    setDateFrom('')
    setDateTo('')
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((r) => r.id)))
  }

  async function deleteOne(id) {
    if (!confirm('確定要刪除這一筆紀錄嗎？此動作無法復原。')) return
    const { error: err } = await supabase.from('student_records').delete().eq('id', id)
    if (err) setError(err.message)
    else load()
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`確定要刪除這 ${selected.size} 筆紀錄嗎？此動作無法復原。`)) return
    const { error: err } = await supabase.from('student_records').delete().in('id', [...selected])
    if (err) setError(err.message)
    else load()
  }

  async function batchDeleteByDate() {
    if (!batchFrom || !batchTo) {
      setBatchNote('請先選擇起訖日期')
      return
    }
    if (
      !confirm(
        `確定要刪除 ${batchFrom} ～ ${batchTo} 這段期間的所有學生紀錄嗎？${
          filterAssignment ? '（只會刪除目前選擇的作業）' : '（會刪除所有作業的紀錄）'
        }此動作無法復原。`
      )
    )
      return
    setBatchBusy(true)
    setBatchNote('')
    try {
      let query = supabase
        .from('student_records')
        .delete()
        .gte('created_at', `${batchFrom}T00:00:00`)
        .lte('created_at', `${batchTo}T23:59:59`)
      if (filterAssignment) query = query.eq('assignment_id', filterAssignment)
      const { error: err } = await query
      if (err) throw err
      setBatchNote('已刪除完成')
      load()
    } catch (err) {
      setBatchNote(`刪除失敗：${err.message}`)
    } finally {
      setBatchBusy(false)
    }
  }

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
      老師回饋: r.ai_feedback,
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

      <div className="filter-grid">
        <div className="field">
          <label>作業</label>
          <select value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}>
            <option value="">所有作業</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>題目</label>
          <select value={filterQuestion} onChange={(e) => setFilterQuestion(e.target.value)}>
            <option value="">所有題目</option>
            {questionOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>用途</label>
          <select value={filterPurpose} onChange={(e) => setFilterPurpose(e.target.value)}>
            <option value="">所有用途</option>
            <option value="進度繳交">進度繳交</option>
            <option value="補繳">補繳</option>
          </select>
        </div>
        <div className="field">
          <label>年級</label>
          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
            <option value="">所有年級</option>
            <option value="國中">國中</option>
            <option value="高一">高一</option>
            <option value="高二">高二</option>
            <option value="高三">高三</option>
          </select>
        </div>
        <div className="field">
          <label>班級</label>
          <input type="text" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} placeholder="例如：高二忠" />
        </div>
        <div className="field">
          <label>姓名</label>
          <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="輸入姓名關鍵字" />
        </div>
        <div className="field">
          <label>作答結果</label>
          <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
            <option value="">所有結果</option>
            <option value="passed">✅ 過關</option>
            <option value="failed">未過關</option>
          </select>
        </div>
        <div className="field">
          <label>作答日期（起）</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>作答日期（迄）</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <button className="ghost" onClick={resetFilters}>清除篩選</button>{' '}
        <button className="secondary" onClick={exportExcel}>匯出 Excel（依目前篩選）</button>{' '}
        <button className="danger" onClick={deleteSelected} disabled={selected.size === 0}>
          刪除所選（{selected.size}）
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="empty-note">載入中...</p>}

      {!loading && (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>作業</th>
              <th>題目</th>
              <th>用途</th>
              <th>班級座號</th>
              <th>姓名</th>
              <th>次數</th>
              <th>結果</th>
              <th>時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td>{r.assignments?.title}</td>
                <td>{r.questions?.title}</td>
                <td>{r.purpose}</td>
                <td>{r.class_name} {r.seat_number}號</td>
                <td>{r.student_name}</td>
                <td>{r.attempt_number}</td>
                <td>{r.passed ? '✅ 過關' : '未過關'}</td>
                <td className="muted">{new Date(r.created_at).toLocaleString('zh-TW')}</td>
                <td><button className="ghost" style={{ padding: '2px 10px', fontSize: '0.8rem' }} onClick={() => deleteOne(r.id)}>刪除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && filtered.length === 0 && <p className="empty-note">沒有符合條件的紀錄</p>}

      <div className="paper" style={{ marginTop: 28, padding: 20 }}>
        <h3 style={{ fontSize: '1rem', marginTop: 0 }}>批次刪除（依作答日期區間）</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          會刪除區間內所有符合條件的紀錄{filterAssignment ? '（僅限上方選擇的作業）' : '（涵蓋所有作業）'}，與上方其他篩選條件無關，請小心操作。
        </p>
        <div className="row" style={{ maxWidth: 420 }}>
          <div className="field">
            <label>起</label>
            <input type="date" value={batchFrom} onChange={(e) => setBatchFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>迄</label>
            <input type="date" value={batchTo} onChange={(e) => setBatchTo(e.target.value)} />
          </div>
        </div>
        <button className="danger" onClick={batchDeleteByDate} disabled={batchBusy}>
          {batchBusy ? '刪除中...' : '刪除此區間紀錄'}
        </button>
        {batchNote && <p className="muted" style={{ marginTop: 8 }}>{batchNote}</p>}
      </div>
    </div>
  )
}
