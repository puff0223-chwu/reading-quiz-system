import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient.js'

export default function AssignmentEditor() {
  const { id } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [questions, setQuestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [generatingCriteriaId, setGeneratingCriteriaId] = useState(null)
  const [error, setError] = useState('')
  const [savedNote, setSavedNote] = useState('')

  async function load() {
    const { data: a } = await supabase.from('assignments').select('*').eq('id', id).single()
    const { data: qs } = await supabase
      .from('questions')
      .select('*')
      .eq('assignment_id', id)
      .order('order_index', { ascending: true })
    setAssignment(a)
    setQuestions(qs || [])
  }

  useEffect(() => {
    load()
  }, [id])

  async function saveAssignment() {
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('assignments')
      .update({
        title: assignment.title,
        article_url: assignment.article_url,
        article_context: assignment.article_context,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSaving(false)
    if (err) setError(err.message)
    else {
      setSavedNote('已儲存')
      setTimeout(() => setSavedNote(''), 2000)
    }
  }

  async function togglePublish() {
    const nextStatus = assignment.status === 'published' ? 'draft' : 'published'
    const { error: err } = await supabase.from('assignments').update({ status: nextStatus }).eq('id', id)
    if (err) setError(err.message)
    else setAssignment({ ...assignment, status: nextStatus })
  }

  async function generateSummary() {
    if (!assignment.article_url) {
      setError('請先填寫文章網址')
      return
    }
    setSummarizing(true)
    setError('')
    try {
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_url: assignment.article_url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '生成失敗')
      setAssignment({ ...assignment, article_context: data.summary })
    } catch (err) {
      setError('自動生成摘要失敗，請確認網址是否正確，或直接手動輸入摘要。')
    } finally {
      setSummarizing(false)
    }
  }

  async function generateQuestions() {
    if (!assignment.article_context?.trim()) {
      setError('請先填寫或自動生成文章摘要，AI 才有依據可以出題')
      return
    }
    const countStr = prompt('要請 AI 出幾題草稿？（1-8 題，之後都可以再自己增刪修改）', '4')
    if (!countStr) return
    setGeneratingQuestions(true)
    setError('')
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_context: assignment.article_context, count: countStr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 出題失敗')

      const toInsert = data.questions.map((q, idx) => ({
        assignment_id: id,
        order_index: questions.length + idx,
        title: q.title || `第 ${questions.length + idx + 1} 題`,
        prompt: q.prompt || '',
        criteria: q.criteria || '',
      }))
      const { data: inserted, error: insertErr } = await supabase.from('questions').insert(toInsert).select()
      if (insertErr) throw insertErr
      setQuestions([...questions, ...inserted])
    } catch (err) {
      setError(err.message || 'AI 出題失敗，請稍後再試一次。')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  async function addQuestion() {
    const { data, error: err } = await supabase
      .from('questions')
      .insert({
        assignment_id: id,
        order_index: questions.length,
        title: `第 ${questions.length + 1} 題`,
        prompt: '',
        criteria: '',
      })
      .select()
      .single()
    if (err) setError(err.message)
    else setQuestions([...questions, data])
  }

  function updateLocalQuestion(qid, field, value) {
    setQuestions(questions.map((q) => (q.id === qid ? { ...q, [field]: value } : q)))
  }

  async function saveQuestion(q) {
    const { error: err } = await supabase
      .from('questions')
      .update({ title: q.title, prompt: q.prompt, criteria: q.criteria })
      .eq('id', q.id)
    if (err) setError(err.message)
  }

  async function generateCriteria(q) {
    if (!assignment.article_context?.trim()) {
      setError('請先填寫或自動生成文章摘要，AI 才有依據可以設計評分規準')
      return
    }
    if (!q.prompt?.trim()) {
      setError('請先填寫題目內容，AI 才知道要針對什麼設計評分規準')
      return
    }
    setGeneratingCriteriaId(q.id)
    setError('')
    try {
      const res = await fetch('/api/generate-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_context: assignment.article_context,
          title: q.title,
          prompt: q.prompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 產生評分規準失敗')
      const updated = { ...q, criteria: data.criteria }
      updateLocalQuestion(q.id, 'criteria', data.criteria)
      await saveQuestion(updated)
    } catch (err) {
      setError(err.message || 'AI 產生評分規準失敗，請稍後再試一次。')
    } finally {
      setGeneratingCriteriaId(null)
    }
  }

  async function removeQuestion(qid) {
    if (!confirm('確定要刪除這一題嗎？')) return
    const { error: err } = await supabase.from('questions').delete().eq('id', qid)
    if (err) setError(err.message)
    else setQuestions(questions.filter((q) => q.id !== qid))
  }

  if (!assignment) return <div className="paper section"><p className="empty-note">載入中...</p></div>

  return (
    <div>
      <div className="paper section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>編輯作業</h2>
          <span className={`status-pill ${assignment.status}`}>
            {assignment.status === 'published' ? '已發布' : '草稿'}
          </span>
        </div>
        <div className="field">
          <label>標題</label>
          <input
            type="text"
            value={assignment.title}
            onChange={(e) => setAssignment({ ...assignment, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>文章網址</label>
          <input
            type="url"
            value={assignment.article_url}
            onChange={(e) => setAssignment({ ...assignment, article_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="field">
          <label>
            文章摘要（AI 評分依據，學生不會看到）{' '}
            <button
              type="button"
              className="secondary"
              style={{ padding: '2px 10px', fontSize: '0.8rem' }}
              onClick={generateSummary}
              disabled={summarizing}
            >
              {summarizing ? '生成中...' : '自動生成摘要'}
            </button>
          </label>
          <textarea
            value={assignment.article_context}
            onChange={(e) => setAssignment({ ...assignment, article_context: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button onClick={saveAssignment} disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>{' '}
        <button className="secondary" onClick={togglePublish}>
          {assignment.status === 'published' ? '取消發布' : '發布'}
        </button>{' '}
        {savedNote && <span className="muted">{savedNote}</span>}
      </div>

      <div className="paper section" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>題目（{questions.length}）</h2>
          <div>
            <button className="secondary" onClick={generateQuestions} disabled={generatingQuestions}>
              {generatingQuestions ? 'AI 出題中...' : '🪄 AI 幫我出題'}
            </button>{' '}
            <button onClick={addQuestion}>+ 手動新增題目</button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: -8, marginBottom: 18 }}>
          AI 出的題目會直接加到下方清單，記得逐題檢查、修改到您滿意再發布。
        </p>
        {questions.map((q, idx) => (
          <div key={q.id} className="paper" style={{ padding: 18, marginBottom: 14 }}>
            <div className="field">
              <label>小標題（第 {idx + 1} 題）</label>
              <input
                type="text"
                value={q.title}
                onChange={(e) => updateLocalQuestion(q.id, 'title', e.target.value)}
                onBlur={() => saveQuestion(q)}
              />
            </div>
            <div className="field">
              <label>題目內容（學生看得到）</label>
              <textarea
                value={q.prompt}
                onChange={(e) => updateLocalQuestion(q.id, 'prompt', e.target.value)}
                onBlur={() => saveQuestion(q)}
              />
            </div>
            <div className="field">
              <label>
                評分規準（僅老師與 AI 看得到，絕不會回傳給學生）{' '}
                <button
                  type="button"
                  className="secondary"
                  style={{ padding: '2px 10px', fontSize: '0.8rem' }}
                  onClick={() => generateCriteria(q)}
                  disabled={generatingCriteriaId === q.id}
                >
                  {generatingCriteriaId === q.id
                    ? 'AI 產生中...'
                    : q.criteria?.trim()
                      ? '🪄 重新產生'
                      : '🪄 AI 產生評分規準'}
                </button>
              </label>
              <textarea
                value={q.criteria}
                onChange={(e) => updateLocalQuestion(q.id, 'criteria', e.target.value)}
                onBlur={() => saveQuestion(q)}
              />
            </div>
            <button className="danger" onClick={() => removeQuestion(q.id)}>刪除這一題</button>
          </div>
        ))}
      </div>
    </div>
  )
}
