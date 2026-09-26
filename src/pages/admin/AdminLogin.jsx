import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError('登入失敗，請確認帳號密碼是否正確。')
      return
    }
    navigate('/admin/assignments')
  }

  return (
    <div className="page">
      <div className="paper">
        <div className="masthead">
          <h1>老師後台登入</h1>
        </div>
        <form className="section" onSubmit={handleSubmit} style={{ maxWidth: 360, margin: '0 auto' }}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>密碼</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? '登入中...' : '登入'}
          </button>
          <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/">回學生首頁</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
