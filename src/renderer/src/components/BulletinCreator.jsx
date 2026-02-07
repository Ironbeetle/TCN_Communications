import { useState, useRef } from 'react'
import './Composer.css'

const CATEGORIES = [
  { value: 'CHIEFNCOUNCIL', label: 'Chief & Council' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'PROGRAM_EVENTS', label: 'Programs & Events' },
  { value: 'ANNOUNCEMENTS', label: 'Announcements' }
]

function BulletinCreator({ user }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('ANNOUNCEMENTS')
  const [contentType, setContentType] = useState('poster') // 'poster' or 'text'
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setResult({ success: false, message: 'Please select an image file (PNG, JPG, etc.)' })
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setResult({ success: false, message: 'Image must be less than 10MB' })
        return
      }

      setPosterFile(file)
      setResult(null)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPosterPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePoster = () => {
    setPosterFile(null)
    setPosterPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleContentTypeChange = (type) => {
    setContentType(type)
    setResult(null)
    if (type === 'text') {
      setPosterFile(null)
      setPosterPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } else {
      setTextContent('')
    }
  }

  const handlePost = async () => {
    if (!title.trim() || !subject.trim()) {
      setResult({ success: false, message: 'Please fill in title and subject' })
      return
    }

    if (contentType === 'poster' && !posterFile) {
      setResult({ success: false, message: 'Please upload a poster image' })
      return
    }

    if (contentType === 'text' && !textContent.trim()) {
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
        userId: user.id
      }

      // Add poster file if selected
      if (contentType === 'poster' && posterFile) {
        const reader = new FileReader()
        const base64Data = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(posterFile)
        })
        bulletinData.posterFile = {
          filename: posterFile.name,
          data: base64Data,
          mimeType: posterFile.type
        }
      }

      // Add text content if selected
      if (contentType === 'text' && textContent.trim()) {
        bulletinData.content = textContent.trim()
      }

      const response = await window.electronAPI.bulletin.create(bulletinData)
      
      setResult(response)
      
      if (response.success) {
        setTitle('')
        setSubject('')
        setCategory('ANNOUNCEMENTS')
        setContentType('poster')
        setPosterFile(null)
        setPosterPreview(null)
        setTextContent('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
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
        <h2>Create Bulletin</h2>
        <p>Post a bulletin to the community portal</p>
      </div>

      <div className="composer-body">
        {/* Content Type Toggle */}
        <div className="composer-section">
          <label>Bulletin Type</label>
          <div className="content-type-toggle">
            <button 
              type="button"
              className={`toggle-btn ${contentType === 'poster' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('poster')}
            >
              Poster Image
            </button>
            <button 
              type="button"
              className={`toggle-btn ${contentType === 'text' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('text')}
            >
              Text Content
            </button>
          </div>
        </div>

        {/* Poster Upload Section */}
        {contentType === 'poster' && (
          <div className="composer-section poster-upload-section">
            <label>Poster Image <span className="required">*</span></label>
            <p className="field-hint">Upload the poster you've created (PNG, JPG - max 10MB)</p>
            
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="poster-upload"
            />
            
            {!posterPreview ? (
              <div 
                className="poster-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-content">
                  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17,8 12,3 7,8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Click to select poster image</span>
                  <span className="dropzone-hint">or drag and drop</span>
                </div>
              </div>
            ) : (
            <div className="poster-preview-container">
              <img src={posterPreview} alt="Poster preview" className="poster-preview-image" />
              <div className="poster-preview-overlay">
                <button 
                  type="button" 
                  className="change-poster-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </button>
                <button 
                  type="button" 
                  className="remove-poster-btn"
                  onClick={handleRemovePoster}
                >
                  Remove
                </button>
              </div>
              <p className="poster-filename">{posterFile?.name}</p>
            </div>
          )}
          </div>
        )}

        {/* Text Content Section */}
        {contentType === 'text' && (
          <div className="composer-section">
            <label htmlFor="textContent">Bulletin Text <span className="required">*</span></label>
            <p className="field-hint">Enter the text content for your bulletin</p>
            <textarea
              id="textContent"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Enter bulletin content here..."
              rows={8}
              className="composer-textarea"
            />
          </div>
        )}

        <div className="composer-row">
          <div className="composer-section" style={{ flex: 2 }}>
            <label htmlFor="title">Title <span className="required">*</span></label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Community Feast - March 15th"
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
            disabled={isPosting || !title.trim() || !subject.trim() || (contentType === 'poster' ? !posterFile : !textContent.trim())}
          >
            {isPosting ? 'Publishing...' : 'Publish Bulletin'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulletinCreator
