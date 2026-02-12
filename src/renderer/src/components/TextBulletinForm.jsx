import { useState } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import './Composer.css'

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ]
}

const QUILL_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet', 'indent',
  'align',
  'link'
]

const CATEGORIES = [
  { value: 'CHIEFNCOUNCIL', label: 'Chief & Council' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'PROGRAM_EVENTS', label: 'Programs & Events' },
  { value: 'ANNOUNCEMENTS', label: 'Announcements' }
]

function TextBulletinForm({ user, onBack }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('ANNOUNCEMENTS')
  const [textContent, setTextContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [result, setResult] = useState(null)

  // Helper to check if Quill content is empty
  const isContentEmpty = (content) => {
    if (!content) return true
    const strippedContent = content.replace(/<[^>]*>/g, '').trim()
    return strippedContent.length === 0
  }

  const handlePost = async () => {
    if (!title.trim() || !subject.trim()) {
      setResult({ success: false, message: 'Please fill in title and subject' })
      return
    }

    if (isContentEmpty(textContent)) {
      setResult({ success: false, message: 'Please enter text content' })
      return
    }

    setIsPosting(true)
    setResult(null)

    try {
      const bulletinData = {
        title,
        subject,
        category,
        userId: user.id,
        content: textContent
      }

      const response = await window.electronAPI.bulletin.create(bulletinData)
      
      setResult(response)
      
      if (response.success) {
        setTitle('')
        setSubject('')
        setCategory('ANNOUNCEMENTS')
        setTextContent('')
      }
    } catch (error) {
      setResult({ success: false, message: error.message })
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <div className="composer">
      <div className="composer-header">
        <div className="header-with-back">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h2>Text Bulletin</h2>
            <p>Post a text bulletin to the community portal</p>
          </div>
        </div>
      </div>

      <div className="composer-body">
        <div className="composer-section">
          <label htmlFor="textContent">Bulletin Text <span className="required">*</span></label>
          <p className="field-hint">Enter the text content for your bulletin</p>
          <div className="quill-wrapper">
            <ReactQuill
              theme="snow"
              value={textContent}
              onChange={setTextContent}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Enter bulletin content here..."
            />
          </div>
        </div>

        <div className="composer-row">
          <div className="composer-section" style={{ flex: 2 }}>
            <label htmlFor="title">Title <span className="required">*</span></label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Community Announcement"
            />
          </div>

          <div className="composer-section" style={{ flex: 1 }}>
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="composer-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="composer-section">
          <label htmlFor="subject">Subject / Summary <span className="required">*</span></label>
          <input
            type="text"
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description that appears in the bulletin list..."
          />
        </div>

        {result && (
          <div className={`result-message ${result.success ? 'success' : 'error'}`}>
            {result.message}
          </div>
        )}

        <div className="composer-actions">
          <button 
            className="send-button"
            onClick={handlePost}
            disabled={isPosting || !title.trim() || !subject.trim() || isContentEmpty(textContent)}
          >
            {isPosting ? 'Publishing...' : 'Publish Text Bulletin'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TextBulletinForm
