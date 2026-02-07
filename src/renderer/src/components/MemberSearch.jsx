import { useState, useEffect, useRef, useCallback } from 'react'
import './MemberSearch.css'

function MemberSearch({ type, selected, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [showResults, setShowResults] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [showAllSelected, setShowAllSelected] = useState(false)
  
  const inputRef = useRef(null)
  const resultsRef = useRef(null)
  const searchContainerRef = useRef(null)

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false)
        setFocusedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        performSearch()
      } else {
        setSearchResults([])
        setHasSearched(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultsRef.current) {
      const focusedElement = resultsRef.current.children[focusedIndex]
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

  const performSearch = async () => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const response = await window.electronAPI.contacts.search(searchTerm, 50)
      if (response.success) {
        // Filter by type (phone or email)
        const filtered = response.members.filter(m => 
          type === 'phone' ? m.phone : m.email
        )
        setSearchResults(filtered)
        setShowResults(true)
        setFocusedIndex(-1)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelect = useCallback((member) => {
    const isSelected = selected.some(s => s.id === member.id)
    if (isSelected) {
      onSelect(selected.filter(s => s.id !== member.id))
    } else {
      onSelect([...selected, member])
    }
  }, [selected, onSelect])

  const handleRemove = (member) => {
    onSelect(selected.filter(s => s.id !== member.id))
  }

  const handleClearAll = () => {
    onSelect([])
  }

  const handleSelectAllVisible = () => {
    const unselectedResults = searchResults.filter(
      member => !selected.some(s => s.id === member.id)
    )
    onSelect([...selected, ...unselectedResults])
  }

  const handleDeselectAllVisible = () => {
    const resultIds = new Set(searchResults.map(r => r.id))
    onSelect(selected.filter(s => !resultIds.has(s.id)))
  }

  const handleKeyDown = (e) => {
    if (!showResults || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < searchResults.length) {
          handleSelect(searchResults[focusedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setFocusedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getAvatarColor = (name) => {
    if (!name) return '#666'
    const colors = [
      '#00d9ff', '#ff6b6b', '#4ecdc4', '#45b7d1', 
      '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8',
      '#a29bfe', '#6c5ce7', '#00b894', '#e17055'
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const selectedCount = selected.length
  const visibleSelectedCount = Math.min(showAllSelected ? selectedCount : 8, selectedCount)
  const hiddenCount = selectedCount - visibleSelectedCount
  const displayedSelected = showAllSelected ? selected : selected.slice(0, 8)

  // Check how many visible results are selected
  const selectedVisibleCount = searchResults.filter(
    member => selected.some(s => s.id === member.id)
  ).length

  return (
    <div className="member-search" ref={searchContainerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={`Search members by name, community, or address...`}
          className="search-input"
        />
        {isSearching && <span className="search-spinner"></span>}
        {searchTerm && !isSearching && (
          <button 
            className="clear-search" 
            onClick={() => {
              setSearchTerm('')
              setSearchResults([])
              setHasSearched(false)
              inputRef.current?.focus()
            }}
            title="Clear search"
          >
            ×
          </button>
        )}

        {/* Search Results Dropdown - positioned absolute */}
        {showResults && searchResults.length > 0 && (
          <div className="search-results-container">
            <div className="search-results-header">
              <span className="results-count">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                {selectedVisibleCount > 0 && ` • ${selectedVisibleCount} selected`}
              </span>
              <div className="results-actions" style={{ display: 'flex', gap: '8px' }}>
                {selectedVisibleCount < searchResults.length && (
                  <button 
                    className="results-action-btn"
                    onClick={handleSelectAllVisible}
                    title="Select all visible results"
                    style={{
                      background: 'rgba(0,217,255,0.2)',
                      border: '1px solid #00d9ff',
                      color: '#00d9ff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Select All
                  </button>
                )}
                {selectedVisibleCount > 0 && (
                  <button 
                    className="results-action-btn"
                    onClick={handleDeselectAllVisible}
                    title="Deselect all visible results"
                    style={{
                      background: 'rgba(0,217,255,0.2)',
                      border: '1px solid #00d9ff',
                      color: '#00d9ff',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Deselect All
                  </button>
                )}
              </div>
            </div>
          <div 
            className="search-results" 
            ref={resultsRef}
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              background: '#1e1e3a'
            }}
          >
            {searchResults.map((member, index) => {
              const isSelected = selected.some(s => s.id === member.id)
              const isFocused = index === focusedIndex
              return (
                <div 
                  key={member.id}
                  className={`search-result-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                  onClick={() => handleSelect(member)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isSelected ? '#1a3040' : isFocused ? '#2a2a4a' : '#1e1e3a',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div 
                    className="member-avatar" 
                    style={{ 
                      backgroundColor: getAvatarColor(member.name),
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#111',
                      flexShrink: 0
                    }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="member-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="member-name-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '15px' }}>{member.name}</span>
                    </div>
                    <span style={{ color: '#b0b0d0', fontSize: '13px' }}>
                      {type === 'phone' ? member.phone : member.email}
                    </span>
                    {member.community && (
                      <span style={{ color: '#8888aa', fontSize: '12px', fontStyle: 'italic', display: 'block' }}>
                        {member.community}
                      </span>
                    )}
                  </div>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    color: isSelected ? '#00ff88' : 'rgba(255,255,255,0.5)'
                  }}>
                    {isSelected ? '✓' : '+'}
                  </span>
                </div>
              )
            })}
          </div>
          <div 
            className="search-results-footer"
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.03)',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              ↑↓ Navigate • Enter Select • Esc Close
            </span>
          </div>
        </div>
        )}
      </div>

      {showResults && hasSearched && searchResults.length === 0 && !isSearching && searchTerm.length >= 2 && (
        <div className="search-no-results">
          <span className="no-results-icon">🔍</span>
          <span className="no-results-text">No members found for "{searchTerm}"</span>
          <span className="no-results-hint">Try a different name, community, or address</span>
        </div>
      )}

      {selected.length > 0 && (
        <div className="selected-members-container">
          <div className="selected-members-header">
            <span className="selected-count">
              {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button className="clear-all-btn" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
          <div className="selected-members">
            {displayedSelected.map((member) => (
              <span key={member.id} className="selected-tag" title={type === 'phone' ? member.phone : member.email}>
                <span 
                  className="tag-avatar" 
                  style={{ backgroundColor: getAvatarColor(member.name) }}
                >
                  {getInitials(member.name)}
                </span>
                <span className="tag-name">{member.name}</span>
                <button onClick={() => handleRemove(member)} className="remove-tag" title="Remove">×</button>
              </span>
            ))}
            {!showAllSelected && hiddenCount > 0 && (
              <button 
                className="show-more-btn"
                onClick={() => setShowAllSelected(true)}
              >
                +{hiddenCount} more
              </button>
            )}
            {showAllSelected && selectedCount > 8 && (
              <button 
                className="show-less-btn"
                onClick={() => setShowAllSelected(false)}
              >
                Show less
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MemberSearch
