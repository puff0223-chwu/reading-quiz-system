import { Routes, Route } from 'react-router-dom'
import StudentHome from './pages/StudentHome.jsx'
import AssignmentPage from './pages/AssignmentPage.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AssignmentsList from './pages/admin/AssignmentsList.jsx'
import AssignmentEditor from './pages/admin/AssignmentEditor.jsx'
import RecordsPage from './pages/admin/RecordsPage.jsx'
import ImportPage from './pages/admin/ImportPage.jsx'
import ErrorsPage from './pages/admin/ErrorsPage.jsx'
import AppearancePage from './pages/admin/AppearancePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StudentHome />} />
      <Route path="/assignment/:id" element={<AssignmentPage />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AssignmentsList />} />
        <Route path="assignments" element={<AssignmentsList />} />
        <Route path="assignments/:id" element={<AssignmentEditor />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="errors" element={<ErrorsPage />} />
        <Route path="appearance" element={<AppearancePage />} />
      </Route>
    </Routes>
  )
}
