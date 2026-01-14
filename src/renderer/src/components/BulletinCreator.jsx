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
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
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

  const handlePost = async () => {
    if (!title.trim() || !subject.trim()) {
      setResult({ success: false, message: 'Please fill in title and subject' })
      return
    }

    if (!posterFile) {
      setResult({ success: false, message: 'Please upload a poster image' })
      return
    }

    setIsPosting(true)
    setResult(null)

    try {
      // Convert file to base64 for IPC transfer
      const reader = new FileReader()
      const base64Data = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(posterFile)
      })

      // Create bulletin - the service handles upload + sync internally
      const response = await window.electronAPI.bulletin.create({
        title,
        subject,
        category,
        posterFile: {
          filename: posterFile.name,
          data: base64Data,
          mimeType: posterFile.type
        },
        userId: user.id
      })
      
      setResult(response)
      
      if (response.success) {
        setTitle('')
        setSubject('')
        setCategory('ANNOUNCEMENTS')
        setPosterFile(null)
        setPosterPreview(null)
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
        <h2>Create Bulletin Poster</h2>
        <p>Upload a poster to publish on the community portal</p>
      </div>

      <div className="composer-body">
        {/* Poster Upload Section - Primary Focus */}
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
            disabled={isPosting || !title.trim() || !subject.trim() || !posterFile}
          >
            {isPosting ? 'Publishing...' : 'Publish Bulletin'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulletinCreator
