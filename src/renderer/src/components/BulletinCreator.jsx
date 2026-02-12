import { useState, lazy, Suspense } from 'react'
import './Composer.css'

// Lazy load bulletin forms (TextBulletinForm includes heavy React-Quill editor)
const PosterBulletinForm = lazy(() => import('./PosterBulletinForm'))
const TextBulletinForm = lazy(() => import('./TextBulletinForm'))

const LoadingFallback = () => (
  <div className="composer">
    <div className="loading-form">
      <div className="loading-spinner"></div>
      <p>Loading editor...</p>
    </div>
  </div>
)

function BulletinCreator({ user }) {
  const [selectedType, setSelectedType] = useState(null) // null = selector view, 'poster' or 'text' = form view

  // Show poster form
  if (selectedType === 'poster') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <PosterBulletinForm user={user} onBack={() => setSelectedType(null)} />
      </Suspense>
    )
  }

  // Show text form
  if (selectedType === 'text') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TextBulletinForm user={user} onBack={() => setSelectedType(null)} />
      </Suspense>
    )
  }

  // Selector view
  return (
    <div className="composer">
      <div className="composer-header">
        <h2>Create Bulletin</h2>
        <p>Choose the type of bulletin you want to create</p>
      </div>

      <div className="composer-body">
        <div className="bulletin-type-selector">
          <button 
            className="bulletin-type-card"
            onClick={() => setSelectedType('poster')}
          >
            <div className="type-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
            </div>
            <h3>Poster Bulletin</h3>
            <p>Upload a poster image (8.5" × 11" format)</p>
          </button>

          <button 
            className="bulletin-type-card"
            onClick={() => setSelectedType('text')}
          >
            <div className="type-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <h3>Text Bulletin</h3>
            <p>Create a text-based announcement</p>
          </button>
        </div>
      </div>
    </div>
  )
}

export default BulletinCreator
