import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient.js'

export default function ErrorsPage() {
  const [errors, setErrors] = useState(null)

  useEffect(() => {
    supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setErrors(data || []))
  }, [])

  return (
    <div className="paper section">
      <h2>錯誤紀錄</h2>
      {!errors && <p className="empty-note">載入中...</p>}
      {errors && errors.length === 0 && <p className="empty-note">目前沒有錯誤紀錄，一切正常。</p>}
      {errors && errors.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>時間</th>
              <th>學生</th>
              <th>錯誤內容</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.id}>
                <td className="muted">{new Date(e.created_at).toLocaleString('zh-TW')}</td>
                <td>{e.student_name}</td>
                <td>{e.error_detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
