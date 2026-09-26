import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AdminLayout() {
  const [session, setSession] = useState(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null) navigate('/admin/login')
  }, [session, navigate])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (session === undefined) return <div className="page"><p className="empty-note">載入中...</p></div>
  if (!session) return null

  return (
    <div>
      <div className="top-bar">
        <nav>
          <NavLink to="/admin/assignments">作業管理</NavLink>
          <NavLink to="/admin/records">學生紀錄</NavLink>
          <NavLink to="/admin/import">匯入資料</NavLink>
          <NavLink to="/admin/errors">錯誤紀錄</NavLink>
          <NavLink to="/admin/appearance">外觀設定</NavLink>
        </nav>
        <button className="ghost" onClick={handleLogout}>登出</button>
      </div>
      <div className="page">
        <Outlet />
      </div>
    </div>
  )
}
