import { useState, useEffect, useRef } from 'react'

/**
 * Inline help tooltip — place next to any label or field for contextual help.
 *
 * Props:
 *   text      — tooltip text (required)
 *   size      — icon size in px (default 14)
 *   position  — 'top' | 'bottom' | 'left' | 'right' (default 'top')
 */
function HelpTooltip({ text, size = 14, position = 'top' }) {
  const [visible, setVisible] = useState(false)
  const wrapperRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    function handleOutside(e) {
      if (visible && wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [visible])

  return (
    <span className="help-tooltip-wrapper" ref={wrapperRef}>
      <button
        className="help-tooltip-trigger"
        style={{ width: size + 6, height: size + 6, fontSize: size - 2 }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        type="button"
        aria-label="Help"
      >
        ?
      </button>
      {visible && (
        <span className={`help-tooltip-bubble help-tooltip-${position}`}>
          {text}
        </span>
      )}
    </span>
  )
}

export default HelpTooltip
