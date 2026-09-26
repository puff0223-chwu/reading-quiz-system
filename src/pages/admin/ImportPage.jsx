import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../supabaseClient.js'

export default function ImportPage() {
  const [assignments, setAssignments] = useState([])
  const [targetAssignment, setTargetAssignment] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    supabase.from('assignments').select('id, title').then(({ data }) => setAssignments(data || []))
  }, [])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setResult('')
    setError('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      setRows(json)
    }
    reader.readAsBinaryString(file)
  }

  async function runImport() {
    if (!targetAssignment) {
      setError('請先選擇要匯入到哪一份作業')
      return
    }
    if (rows.length === 0) {
      setError('請先選擇檔案')
      return
    }
    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/import-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: targetAssignment, rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '匯入失敗')
      setResult(`匯入完成，共 ${data.inserted} 筆紀錄。`)
    } catch (err) {
      setError(err.message || '匯入失敗，請確認欄位名稱是否正確。')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="paper section">
      <h2>匯入舊資料</h2>
      <p className="muted">
        請將舊系統匯出的 Excel/CSV 整理成以下欄位（欄位名稱需完全一致）：
        <br />
        <code>題目, 用途, 年級, 班級, 座號, 姓名, 嘗試次數, 作答內容, 是否過關, 老師回饋</code>
      </p>

      <div className="filter-grid">
        <div className="field">
          <label>匯入到哪份作業</label>
          <select value={targetAssignment} onChange={(e) => setTargetAssignment(e.target.value)}>
            <option value="">請選擇</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>選擇檔案（.xlsx / .xls / .csv）</label>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
        </div>
      </div>

      {fileName && rows.length > 0 && <p className="muted">已讀取「{fileName}」，共 {rows.length} 筆資料，確認無誤後按下方按鈕匯入。</p>}
      {error && <p className="error-text">{error}</p>}
      {result && <p style={{ color: 'var(--pass)' }}>{result}</p>}
      <button onClick={runImport} disabled={importing}>{importing ? '匯入中...' : '開始匯入'}</button>
    </div>
  )
}
