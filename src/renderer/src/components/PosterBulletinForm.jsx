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

function PosterBulletinForm({ user, onBack }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('ANNOUNCEMENTS')
  const [posterFile, setPosterFile] = useState(null)
  const [posterPreview, setPosterPreview] = useState(null)
  const [optimizedPoster, setOptimizedPoster] = useState(null)
  const [isPosting, setIsPosting] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [result, setResult] = useState(null)
  const [optimizationStats, setOptimizationStats] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setResult({ success: false, message: 'Please select an image file (PNG, JPG, etc.)' })
        return
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setResult({ success: false, message: 'Image must be less than 10MB' })
        return
      }

      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Data = reader.result
        
        setIsOptimizing(true)
        setResult({ success: true, message: 'Validating and optimizing image...' })
        setPosterPreview(base64Data)
        
        try {
          const optimizeResult = await window.electronAPI.image.optimizePoster(base64Data)
          
          if (!optimizeResult.success) {
            setResult({ 
              success: false, 
              message: optimizeResult.error || 'Image validation failed. Please use an 8.5" × 11" (portrait) image.'
            })
            setPosterFile(null)
            setPosterPreview(null)
            setOptimizedPoster(null)
            setOptimizationStats(null)
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
            return
          }
          
          setPosterFile(file)
          setPosterPreview(optimizeResult.data)
          setOptimizedPoster(optimizeResult.data)
          setOptimizationStats(optimizeResult.stats)
          setResult({ 
            success: true, 
            message: `Image optimized! ${optimizeResult.stats?.savings || ''} (${optimizeResult.stats?.dimensions?.width}×${optimizeResult.stats?.dimensions?.height}px)`
          })
        } catch (error) {
          console.error('Image optimization error:', error)
          setResult({ success: false, message: 'Failed to process image. Please try again.' })
          setPosterFile(null)
          setPosterPreview(null)
          setOptimizedPoster(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } finally {
          setIsOptimizing(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePoster = () => {
    setPosterFile(null)
    setPosterPreview(null)
    setOptimizedPoster(null)
    setOptimizationStats(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePost = async () => {
    if (!title.trim() || !subject.trim()) {
      setResult({ success: false, message: 'Please fill in title and subject' })
      return
    }

    if (!posterFile || !optimizedPoster) {
      setResult({ success: false, message: 'Please upload a valid poster image (8.5" × 11" format)' })
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
        posterFile: {
          filename: posterFile.name.replace(/\.[^.]+$/, '.jpg'),
          data: optimizedPoster,
          mimeType: 'image/jpeg'
        }
      }

      const response = await window.electronAPI.bulletin.create(bulletinData)
      
      setResult(response)
      
      if (response.success) {
        setTitle('')
        setSubject('')
        setCategory('ANNOUNCEMENTS')
        setPosterFile(null)
        setPosterPreview(null)
        setOptimizedPoster(null)
        setOptimizationStats(null)
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
        <div className="header-with-back">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h2>Poster Bulletin</h2>
            <p>Upload a poster image to the community portal</p>
          </div>
        </div>
      </div>

      <div className="composer-body">
        <div className="composer-section poster-upload-section">
          <label>Poster Image <span className="required">*</span></label>
          <p className="field-hint">Upload the poster you've created (PNG, JPG - max 10MB, 8.5" × 11" format)</p>
          
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
            disabled={isPosting || isOptimizing || !title.trim() || !subject.trim() || !optimizedPoster}
          >
            {isPosting ? 'Publishing...' : isOptimizing ? 'Optimizing Image...' : 'Publish Poster Bulletin'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PosterBulletinForm
