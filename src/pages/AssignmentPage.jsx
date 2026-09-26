import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'

const STUDENT_INFO_KEY = 'reading-quiz-student-info'

function loadStudentInfo() {
  try {
    const raw = sessionStorage.getItem(STUDENT_INFO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function AssignmentPage() {
  const { id } = useParams()
  const [studentInfo, setStudentInfo] = useState(loadStudentInfo())
  const [questions, setQuestions] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [answer, setAnswer] = useState('')
  const [statusMap, setStatusMap] = useState({}) // question_id -> { passed, attempts }
  const [feedback, setFeedback] = useState(null) // { passed, feedback, attempt_number }
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch(`/api/questions?assignment_id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data)
        if (data.length > 0) setActiveId(data[0].id)
      })
      .catch(() => setLoadError('題目載入失敗，請重新整理頁面試試看。'))
  }, [id])

  const refreshStatus = useCallback(
    (qid, name) => {
      if (!name) return
      fetch(
        `/api/student-record?assignment_id=${id}&question_id=${qid}&student_name=${encodeURIComponent(name)}`
      )
        .then((r) => r.json())
        .then((data) => {
          setStatusMap((prev) => ({ ...prev, [qid]: data }))
        })
        .catch(() => {})
    },
    [id]
  )

  useEffect(() => {
    if (questions && studentInfo) {
      questions.forEach((q) => refreshStatus(q.id, studentInfo.student_name))
    }
  }, [questions, studentInfo, refreshStatus])

  useEffect(() => {
    setFeedback(null)
    setAnswer('')
  }, [activeId])

  function handleStudentInfoSubmit(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    const info = {
      purpose: form.get('purpose'),
      grade: form.get('grade'),
      class_name: form.get('class_name'),
      seat_number: form.get('seat_number'),
      student_name: form.get('student_name'),
    }
    sessionStorage.setItem(STUDENT_INFO_KEY, JSON.stringify(info))
    setStudentInfo(info)
  }

  function changeInfo() {
    sessionStorage.removeItem(STUDENT_INFO_KEY)
    setStudentInfo(null)
    setStatusMap({})
  }

  async function submitAnswer() {
    if (!answer.trim()) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: id,
          question_id: activeId,
          ...studentInfo,
          answer_text: answer,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '提交失敗')
      setFeedback(data)
      setStatusMap((prev) => ({
        ...prev,
        [activeId]: { passed: data.passed, attempts: data.attempt_number },
      }))
    } catch (err) {
      setFeedback({ error: '系統目前比較忙碌，請稍等一下再重新提交一次看看。' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <div className="paper section">
          <p className="error-text">{loadError}</p>
        </div>
      </div>
    )
  }

  if (!studentInfo) {
    return (
      <div className="page">
        <div className="paper">
          <div className="masthead">
            <h1>作答前，請先填寫資料</h1>
          </div>
          <form className="section" onSubmit={handleStudentInfoSubmit}>
            <div className="row">
              <div className="field">
                <label>用途</label>
                <select name="purpose" required>
                  <option value="進度學習">進度學習</option>
                  <option value="考試複習">考試複習</option>
                  <option value="重補修">重補修</option>
                </select>
              </div>
              <div className="field">
                <label>年級</label>
                <select name="grade" required>
                  <option value="國中">國中</option>
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>班級</label>
                <input type="text" name="class_name" required placeholder="例如：高二忠" />
              </div>
              <div className="field">
                <label>座號</label>
                <input type="text" name="seat_number" required placeholder="例如：12" />
              </div>
            </div>
            <div className="field">
              <label>姓名</label>
              <input type="text" name="student_name" required placeholder="請輸入你的姓名" />
            </div>
            <button type="submit">開始作答</button>
          </form>
        </div>
      </div>
    )
  }

  const activeQuestion = questions?.find((q) => q.id === activeId)
  const activeStatus = statusMap[activeId]

  return (
    <div className="page">
      <div className="paper">
        <div className="masthead" style={{ paddingBottom: 16 }}>
          <h1>科普閱讀測驗</h1>
          <p>
            {studentInfo.grade} {studentInfo.class_name} {studentInfo.seat_number}號 {studentInfo.student_name}
            {' · '}
            <button type="button" className="ghost" style={{ padding: '2px 10px', fontSize: '0.8rem' }} onClick={changeInfo}>
              修改資訊
            </button>
          </p>
        </div>
        <div className="section">
          {!questions && <p className="empty-note">題目載入中...</p>}
          {questions && (
            <div className="question-grid">
              {questions.map((q, idx) => {
                const st = statusMap[q.id]
                return (
                  <div
                    key={q.id}
                    className={`q-tile ${q.id === activeId ? 'active' : ''} ${st?.passed ? 'passed' : ''}`}
                    onClick={() => setActiveId(q.id)}
                  >
                    第{idx + 1}題
                    <span className="status-dot">
                      {st?.passed ? '✅ 已過關' : st?.attempts ? '作答中' : '未作答'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {activeQuestion && (
          <div className="section">
            <h2>{activeQuestion.title}</h2>
            <p>{activeQuestion.prompt}</p>
            <div className="field" style={{ marginTop: 16 }}>
              <label>你的回答</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="請用自己的話回答，盡量說明完整一點"
              />
            </div>
            <button onClick={submitAnswer} disabled={submitting || !answer.trim()}>
              {submitting ? '評分中...' : '提交答案'}
            </button>
            {activeStatus?.attempts > 0 && (
              <p className="attempt-count">已嘗試 {activeStatus.attempts} 次</p>
            )}

            {feedback?.error && <p className="error-text">{feedback.error}</p>}
            {feedback && !feedback.error && (
              <div className={`feedback-box ${feedback.passed ? 'pass' : 'retry'}`}>
                <strong>{feedback.passed ? '✅ 過關' : '🔄 再想想看'}</strong>
                <p style={{ margin: '6px 0 0' }}>{feedback.feedback}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
