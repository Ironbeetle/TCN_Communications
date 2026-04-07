import { useState, useEffect, useRef } from 'react'
import { getHelpForView } from '../config/helpContent'

/**
 * Floating help drawer — adapted for Electron's activeView-based navigation.
 * Renders a floating "?" FAB that slides open a side panel with contextual help.
 *
 * Props:
 *   activeView  — current view name (e.g. 'home', 'sms', 'timesheets')
 */
function HelpDrawer({ activeView }) {
  const [isOpen, setIsOpen] = useState(false)
  const [openFaqs, setOpenFaqs] = useState({})
  const [visited, setVisited] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tcn_help_visited') || '[]') } catch { return [] }
  })
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tcn_help_dismissed') || '[]') } catch { return [] }
  })
  const drawerRef = useRef(null)

  const helpEntry = getHelpForView(activeView)
  const isDismissed = dismissed.includes(activeView)

  // Auto-open on first visit to a view with help content
  useEffect(() => {
    if (!helpEntry) {
      setIsOpen(false)
      return
    }
    if (!visited.includes(activeView) && !isDismissed) {
      setIsOpen(true)
      const updated = [...visited, activeView]
      setVisited(updated)
      localStorage.setItem('tcn_help_visited', JSON.stringify(updated))
    } else {
      setIsOpen(false)
    }
    setOpenFaqs({})
  }, [activeView])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (isOpen && drawerRef.current && !drawerRef.current.contains(e.target) && !e.target.closest('.help-fab')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  if (!helpEntry) return null

  const toggleFaq = (idx) => {
    setOpenFaqs(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleDismiss = () => {
    if (isDismissed) {
      const updated = dismissed.filter(v => v !== activeView)
      setDismissed(updated)
      localStorage.setItem('tcn_help_dismissed', JSON.stringify(updated))
    } else {
      const updated = [...dismissed, activeView]
      setDismissed(updated)
      localStorage.setItem('tcn_help_dismissed', JSON.stringify(updated))
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`help-fab ${isOpen ? 'help-fab-active' : ''} ${isDismissed ? 'help-fab-dimmed' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Help"
        aria-label="Toggle help panel"
      >
        ?
      </button>

      {/* Backdrop */}
      {isOpen && <div className="help-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Drawer panel */}
      <div ref={drawerRef} className={`help-drawer ${isOpen ? 'help-drawer-open' : ''}`}>
        <div className="help-drawer-inner">
          {/* Header */}
          <div className="help-drawer-header">
            <span className="help-drawer-title">
              <span className="help-icon">?</span> {helpEntry.title}
            </span>
            <button className="help-close-btn" onClick={() => setIsOpen(false)} aria-label="Close help">
              ✕
            </button>
          </div>

          {/* Description */}
          {helpEntry.description && (
            <p className="help-description">{helpEntry.description}</p>
          )}

          {/* Steps */}
          {helpEntry.steps?.length > 0 && (
            <div className="help-section">
              <h4 className="help-section-title">📋 How To Use</h4>
              <ol className="help-steps">
                {helpEntry.steps.map((step, i) => (
                  <li key={i} className="help-step">
                    <span className="help-step-number">{i + 1}</span>
                    <div>
                      <span className="help-step-label">{step.label}</span>
                      <span className="help-step-detail">{step.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tips */}
          {helpEntry.tips?.length > 0 && (
            <div className="help-section">
              <h4 className="help-section-title">💡 Tips</h4>
              <ul className="help-tips">
                {helpEntry.tips.map((tip, i) => (
                  <li key={i} className="help-tip">{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* FAQs */}
          {helpEntry.faqs?.length > 0 && (
            <div className="help-section">
              <h4 className="help-section-title">❓ Common Questions</h4>
              <div className="help-faqs">
                {helpEntry.faqs.map((faq, i) => (
                  <div key={i} className="help-faq-item">
                    <button className="help-faq-question" onClick={() => toggleFaq(i)}>
                      <span>{openFaqs[i] ? '▼' : '▶'}</span> {faq.question}
                    </button>
                    {openFaqs[i] && (
                      <p className="help-faq-answer">{faq.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="help-footer">
            <button className="help-dismiss-btn" onClick={handleDismiss}>
              {isDismissed ? 'Show help on this page again' : "Don't show on this page"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default HelpDrawer
