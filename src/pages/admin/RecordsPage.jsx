import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 30

export default function RecordsPage() {
  const [assignments, setAssignments] = useState([])
  const [records, setRecords] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [filterAssignment, setFilterAssignment] = useState('')
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
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAssignment, filterPurpose, filterGrade, filterClass, filterName, filterResult, dateFrom, dateTo])

  // 統一套用所有篩選條件到同一個 query 上（列表載入、匯出都會用到，避免兩邊邏輯兜不起來）
  function applyFilters(query) {
    let q = query
    if (filterAssignment) q = q.eq('assignment_id', filterAssignment)
    if (filterPurpose) q = q.eq('purpose', filterPurpose)
    if (filterGrade) q = q.eq('grade', filterGrade)
    if (filterClass) q = q.ilike('class_name', `%${filterClass}%`)
    if (filterName) q = q.ilike('student_name', `%${filterName}%`)
    if (filterResult === 'passed') q = q.eq('passed', true)
    if (filterResult === 'failed') q = q.eq('passed', false)
    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`)
    return q
  }

  async function load(pageArg) {
    setLoading(true)
    setError('')
    let query = supabase
      .from('student_records')
      .select('*, questions(title, order_index), assignments(title)', { count: 'exact' })
      .order('created_at', { ascending: false })
    query = applyFilters(query)

    const from = (pageArg - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, error: err, count } = await query
    if (err) {
      setError(err.message)
    } else {
      setRecords(data || [])
      setTotalCount(count || 0)
    }
    setSelected(new Set())
    setLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function updateFilter(setter, value) {
    setter(value)
    setPage(1) // 篩選條件一變，回到第一頁，避免留在一個可能已經沒有資料的頁碼
  }

  function resetFilters() {
    setFilterAssignment('')
    setFilterPurpose('')
    setFilterGrade('')
    setFilterClass('')
    setFilterName('')
    setFilterResult('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
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
    if (selected.size === records.length) setSelected(new Set())
    else setSelected(new Set(records.map((r) => r.id)))
  }

  async function deleteOne(id) {
    if (!confirm('確定要刪除這一筆紀錄嗎？此動作無法復原。')) return
    const { error: err } = await supabase.from('student_records').delete().eq('id', id)
    if (err) setError(err.message)
    else load(page)
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`確定要刪除這 ${selected.size} 筆紀錄嗎？此動作無法復原。`)) return
    const { error: err } = await supabase.from('student_records').delete().in('id', [...selected])
    if (err) setError(err.message)
    else load(page)
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
      setPage(1)
      load(1)
    } catch (err) {
      setBatchNote(`刪除失敗：${err.message}`)
    } finally {
      setBatchBusy(false)
    }
  }

  async function exportExcel() {
    setExporting(true)
    setError('')
    try {
      // 匯出要包含「目前篩選條件下的全部資料」，不能只匯出畫面上這一頁，所以這裡不加 range 分頁限制
      let query = supabase
        .from('student_records')
        .select('*, questions(title, order_index), assignments(title)')
        .order('created_at', { ascending: false })
      query = applyFilters(query).range(0, 9999)

      const { data, error: err } = await query
      if (err) throw err

      const rows = (data || []).map((r) => ({
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
    } catch (err) {
      setError(err.message || '匯出失敗，請稍後再試一次。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="paper section">
      <h2>學生紀錄</h2>

      <div className="filter-grid">
        <div className="field">
          <label>作業</label>
          <select value={filterAssignment} onChange={(e) => updateFilter(setFilterAssignment, e.target.value)}>
            <option value="">所有作業</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>用途</label>
          <select value={filterPurpose} onChange={(e) => updateFilter(setFilterPurpose, e.target.value)}>
            <option value="">所有用途</option>
            <option value="進度繳交">進度繳交</option>
            <option value="補繳">補繳</option>
          </select>
        </div>
        <div className="field">
          <label>年級</label>
          <select value={filterGrade} onChange={(e) => updateFilter(setFilterGrade, e.target.value)}>
            <option value="">所有年級</option>
            <option value="國中">國中</option>
            <option value="高一">高一</option>
            <option value="高二">高二</option>
            <option value="高三">高三</option>
          </select>
        </div>
        <div className="field">
          <label>班級</label>
          <input type="text" value={filterClass} onChange={(e) => updateFilter(setFilterClass, e.target.value)} placeholder="例如：高二忠" />
        </div>
        <div className="field">
          <label>姓名</label>
          <input type="text" value={filterName} onChange={(e) => updateFilter(setFilterName, e.target.value)} placeholder="輸入姓名關鍵字" />
        </div>
        <div className="field">
          <label>作答結果</label>
          <select value={filterResult} onChange={(e) => updateFilter(setFilterResult, e.target.value)}>
            <option value="">所有結果</option>
            <option value="passed">✅ 過關</option>
            <option value="failed">未過關</option>
          </select>
        </div>
        <div className="field">
          <label>作答日期（起）</label>
          <input type="date" value={dateFrom} onChange={(e) => updateFilter(setDateFrom, e.target.value)} />
        </div>
        <div className="field">
          <label>作答日期（迄）</label>
          <input type="date" value={dateTo} onChange={(e) => updateFilter(setDateTo, e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <button className="ghost" onClick={resetFilters}>清除篩選</button>{' '}
          <button className="secondary" onClick={exportExcel} disabled={exporting}>
            {exporting ? '匯出中...' : '匯出 Excel（依目前篩選，含所有頁）'}
          </button>{' '}
          <button className="danger" onClick={deleteSelected} disabled={selected.size === 0}>
            刪除所選（{selected.size}）
          </button>
        </div>
        <span className="muted" style={{ fontSize: '0.9rem' }}>符合條件共 {totalCount} 筆</span>
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
                  checked={records.length > 0 && selected.size === records.length}
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
            {records.map((r) => (
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
      {!loading && records.length === 0 && <p className="empty-note">沒有符合條件的紀錄</p>}

      {!loading && totalCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, margin: '20px 0' }}>
          <button className="secondary" onClick={() => setPage(page - 1)} disabled={page <= 1}>← 上一頁</button>
          <span className="muted">第 {page} / {totalPages} 頁</span>
          <button className="secondary" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>下一頁 →</button>
        </div>
      )}

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
