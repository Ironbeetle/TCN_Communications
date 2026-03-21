import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './MemberSearch.css'

const ITEMS_PER_PAGE = 25
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function MemberSearch({ type, selected, onSelect, compact = false }) {
  // All members (fetched once)
  const [allMembers, setAllMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedCommunity, setSelectedCommunity] = useState('')
  const [communities, setCommunities] = useState([])
  const [activeLetter, setActiveLetter] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  
  // UI state
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [showAllSelected, setShowAllSelected] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(false)
  
  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  // Load all members on mount
  useEffect(() => {
    loadAllMembers()
    loadCommunities()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
    setFocusedIndex(-1)
  }, [searchTerm, sortBy, sortOrder, selectedCommunity, activeLetter])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultsRef.current) {
      const focusedElement = resultsRef.current.children[focusedIndex]
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

  const loadAllMembers = async () => {
    setIsLoading(true)
    try {
      // API has max limit of 500, so fetch in batches
      const PAGE_SIZE = 500
      let allFetched = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const response = await window.electronAPI.contacts.search('', {
          limit: PAGE_SIZE,
          page,
          sortBy: 'name',
          sortOrder: 'asc'
        })
        
        if (response.success && response.members && response.members.length > 0) {
          allFetched = [...allFetched, ...response.members]
          // Check if we got a full page (meaning there might be more)
          if (response.members.length < PAGE_SIZE) {
            hasMore = false
          } else {
            page++
          }
        } else {
          hasMore = false
        }
      }
      
      // Filter by type (phone or email) at load time
      const filtered = allFetched.filter(m => 
        type === 'phone' ? m.phone : m.email
      )
      setAllMembers(filtered)
      setHasLoaded(true)
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCommunities = async () => {
    setIsLoadingCommunities(true)
    try {
      const response = await window.electronAPI.contacts.getCommunities()
      if (response.success && response.communities) {
        setCommunities(response.communities)
      }
    } catch (error) {
      console.error('Error loading communities:', error)
    } finally {
      setIsLoadingCommunities(false)
    }
  }

  // Client-side filtering, sorting, and pagination
  const filteredAndSortedMembers = useMemo(() => {
    let results = [...allMembers]
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      results = results.filter(m => 
        m.name?.toLowerCase().includes(term) ||
        m.firstName?.toLowerCase().includes(term) ||
        m.lastName?.toLowerCase().includes(term) ||
        m.email?.toLowerCase().includes(term) ||
        m.phone?.includes(term) ||
        m.community?.toLowerCase().includes(term)
      )
    }
    
    // Apply letter filter
    if (activeLetter) {
      results = results.filter(m => 
        m.name?.toUpperCase().startsWith(activeLetter) ||
        m.lastName?.toUpperCase().startsWith(activeLetter)
      )
    }
    
    // Apply community filter
    if (selectedCommunity) {
      results = results.filter(m => m.community === selectedCommunity)
    }
    
    // Apply sorting
    results.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'firstName':
          comparison = (a.firstName || '').localeCompare(b.firstName || '')
          break
        case 'lastName':
          comparison = (a.lastName || '').localeCompare(b.lastName || '')
          break
        case 'community':
          comparison = (a.community || '').localeCompare(b.community || '')
          break
        default:
          comparison = (a.name || '').localeCompare(b.name || '')
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return results
  }, [allMembers, searchTerm, activeLetter, selectedCommunity, sortBy, sortOrder])

  // Calculate pagination
  const totalResults = filteredAndSortedMembers.length
  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE)
  const searchResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredAndSortedMembers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredAndSortedMembers, currentPage])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      setFocusedIndex(-1)
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

  const handleLetterClick = (letter) => {
    if (activeLetter === letter) {
      setActiveLetter('')
    } else {
      setActiveLetter(letter)
      setSearchTerm('')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCommunity('')
    setActiveLetter('')
    setSortBy('name')
    setSortOrder('asc')
    setCurrentPage(1)
  }

  const handleKeyDown = (e) => {
    if (searchResults.length === 0) return

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

  const selectedVisibleCount = searchResults.filter(
    member => selected.some(s => s.id === member.id)
  ).length

  const hasActiveFilters = searchTerm || selectedCommunity || activeLetter

  // Compact vertical layout for side panels
  if (compact) {
    return (
      <div className="member-search-compact">
        {/* Compact Header */}
        <div className="compact-header">
          <h4>Select Recipients</h4>
          <span className="compact-stats">
            {selectedCount} selected / {totalResults} total
          </span>
        </div>

        {/* Compact Search Controls */}
        <div className="compact-controls">
          <div className="compact-search">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setActiveLetter('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search members..."
              className="search-input"
            />
            {isLoading && <span className="search-spinner"></span>}
            {searchTerm && !isLoading && (
              <button 
                className="clear-search" 
                onClick={() => setSearchTerm('')}
              >
                ×
              </button>
            )}
          </div>

          <div className="compact-filters">
            <select
              value={selectedCommunity}
              onChange={(e) => setSelectedCommunity(e.target.value)}
              className="filter-select compact-select"
              disabled={isLoadingCommunities}
            >
              <option value="">All Communities</option>
              {communities.map(community => (
                <option key={community} value={community}>{community}</option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select compact-select"
            >
              <option value="name">Name</option>
              <option value="firstName">First</option>
              <option value="lastName">Last</option>
              <option value="community">Community</option>
            </select>
            
            <button
              className={`sort-order-btn compact ${sortOrder === 'asc' ? 'asc' : 'desc'}`}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Compact Alphabet Filter */}
          <div className="compact-alphabet">
            {ALPHABET.map(letter => (
              <button
                key={letter}
                className={`letter-btn compact ${activeLetter === letter ? 'active' : ''}`}
                onClick={() => handleLetterClick(letter)}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Actions */}
        <div className="compact-actions">
          {searchResults.length > 0 && (
            <>
              <button 
                className="action-btn small"
                onClick={handleSelectAllVisible}
                disabled={selectedVisibleCount === searchResults.length}
              >
                Select All
              </button>
              <button 
                className="action-btn small"
                onClick={handleDeselectAllVisible}
                disabled={selectedVisibleCount === 0}
              >
                Deselect All
              </button>
            </>
          )}
          {hasActiveFilters && (
            <button className="action-btn small clear" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {/* Compact Results List */}
        <div className="compact-results" ref={resultsRef}>
          {isLoading ? (
            <div className="loading-state compact">
              <div className="loading-spinner"></div>
              <span>Loading members...</span>
            </div>
          ) : searchResults.length === 0 && hasLoaded ? (
            <div className="empty-state compact">
              <span>No members found</span>
            </div>
          ) : (
            searchResults.map((member, index) => {
              const isSelected = selected.some(s => s.id === member.id)
              const isFocused = index === focusedIndex
              return (
                <div 
                  key={member.id}
                  className={`member-item compact ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                  onClick={() => handleSelect(member)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <div 
                    className="member-avatar small" 
                    style={{ backgroundColor: getAvatarColor(member.name) }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="member-details compact">
                    <span className="member-name">{member.name}</span>
                    <span className="member-contact">
                      {type === 'phone' ? member.phone : member.email}
                    </span>
                  </div>
                  <span className={`member-check compact ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? '✓' : '+'}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Compact Pagination */}
        {totalPages > 1 && (
          <div className="pagination compact">
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ‹
            </button>
            <span className="page-info compact">
              {currentPage}/{totalPages}
            </span>
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        )}

        {/* Compact Selected Tags */}
        {selected.length > 0 && (
          <div className="compact-selected">
            <div className="compact-selected-header">
              <span>{selectedCount} selected</span>
              <button className="clear-all-btn small" onClick={handleClearAll}>
                Clear
              </button>
            </div>
            <div className="compact-selected-tags">
              {(showAllSelected ? selected : selected.slice(0, 6)).map((member) => (
                <span key={member.id} className="selected-tag compact" title={member.name}>
                  <span className="tag-name">{member.name.split(' ')[0]}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleRemove(member); }} className="remove-tag">×</button>
                </span>
              ))}
              {selectedCount > 6 && !showAllSelected && (
                <button className="show-more-btn compact" onClick={() => setShowAllSelected(true)}>
                  +{selectedCount - 6}
                </button>
              )}
              {showAllSelected && selectedCount > 6 && (
                <button className="show-less-btn compact" onClick={() => setShowAllSelected(false)}>
                  less
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full layout (original)

  return (
    <div className="member-search-enhanced">
      {/* Main Container with Sidebar Layout */}
      <div className={`search-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        
        {/* Sidebar - Search Controls */}
        <div className="search-sidebar">
          <div className="sidebar-header">
            <h3>Find Members</h3>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* Search Input */}
              <div className="search-section">
                <label>Search</label>
                <div className="search-input-group">
                  <span className="search-icon">🔍</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setActiveLetter('')
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Name, address, community..."
                    className="search-input"
                  />
                  {isLoading && <span className="search-spinner"></span>}
                  {searchTerm && !isLoading && (
                    <button 
                      className="clear-search" 
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Alphabet Filter */}
              <div className="search-section">
                <label>Quick Filter by Letter</label>
                <div className="alphabet-filter">
                  {ALPHABET.map(letter => (
                    <button
                      key={letter}
                      className={`letter-btn ${activeLetter === letter ? 'active' : ''}`}
                      onClick={() => handleLetterClick(letter)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Community Filter */}
              <div className="search-section">
                <label>Community</label>
                <select
                  value={selectedCommunity}
                  onChange={(e) => setSelectedCommunity(e.target.value)}
                  className="filter-select"
                  disabled={isLoadingCommunities}
                >
                  <option value="">All Communities</option>
                  {communities.map(community => (
                    <option key={community} value={community}>{community}</option>
                  ))}
                </select>
              </div>

              {/* Sort Options */}
              <div className="search-section">
                <label>Sort By</label>
                <div className="sort-controls">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select"
                  >
                    <option value="name">Full Name</option>
                    <option value="firstName">First Name</option>
                    <option value="lastName">Last Name</option>
                    <option value="community">Community</option>
                  </select>
                  <button
                    className={`sort-order-btn ${sortOrder === 'asc' ? 'asc' : 'desc'}`}
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}
                  >
                    {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  Clear All Filters
                </button>
              )}

              {/* Stats */}
              <div className="search-stats">
                <div className="stat-item">
                  <span className="stat-value">{totalResults}</span>
                  <span className="stat-label">Total Members</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{selectedCount}</span>
                  <span className="stat-label">Selected</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Main Content - Results */}
        <div className="search-results-panel">
          {/* Results Header */}
          <div className="results-header">
            <div className="results-info">
              <span className="results-title">
                {hasActiveFilters ? 'Search Results' : 'All Members'}
              </span>
              <span className="results-count">
                Showing {searchResults.length} of {totalResults}
                {selectedVisibleCount > 0 && ` • ${selectedVisibleCount} selected on this page`}
              </span>
            </div>
            <div className="results-actions">
              {selectedVisibleCount < searchResults.length && searchResults.length > 0 && (
                <button 
                  className="action-btn select-all"
                  onClick={handleSelectAllVisible}
                >
                  Select All on Page
                </button>
              )}
              {selectedVisibleCount > 0 && (
                <button 
                  className="action-btn deselect-all"
                  onClick={handleDeselectAllVisible}
                >
                  Deselect All on Page
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="results-list" ref={resultsRef}>
            {isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading members...</span>
              </div>
            ) : searchResults.length === 0 && hasLoaded ? (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <span className="empty-title">No members found</span>
                <span className="empty-hint">
                  {hasActiveFilters 
                    ? 'Try adjusting your search or filters' 
                    : 'No activated members match your criteria'}
                </span>
                {hasActiveFilters && (
                  <button className="clear-filters-btn small" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              searchResults.map((member, index) => {
                const isSelected = selected.some(s => s.id === member.id)
                const isFocused = index === focusedIndex
                return (
                  <div 
                    key={member.id}
                    className={`member-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                    onClick={() => handleSelect(member)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <div 
                      className="member-avatar" 
                      style={{ backgroundColor: getAvatarColor(member.name) }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div className="member-details">
                      <span className="member-name">{member.name}</span>
                      <span className="member-contact">
                        {type === 'phone' ? member.phone : member.email}
                      </span>
                      {member.community && (
                        <span className="member-community">{member.community}</span>
                      )}
                    </div>
                    <span className={`member-check ${isSelected ? 'checked' : ''}`}>
                      {isSelected ? '✓' : '+'}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                ««
              </button>
              <button
                className="page-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="Previous page"
              >
                ‹
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              
              <button
                className="page-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="Next page"
              >
                ›
              </button>
              <button
                className="page-btn"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                title="Last page"
              >
                »»
              </button>
              
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Recipients */}
      {selected.length > 0 && (
        <div className="selected-recipients">
          <div className="selected-header">
            <span className="selected-title">
              {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button className="clear-all-btn" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
          <div className="selected-tags">
            {displayedSelected.map((member) => (
              <span key={member.id} className="selected-tag" title={type === 'phone' ? member.phone : member.email}>
                <span 
                  className="tag-avatar" 
                  style={{ backgroundColor: getAvatarColor(member.name) }}
                >
                  {getInitials(member.name)}
                </span>
                <span className="tag-name">{member.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleRemove(member); }} className="remove-tag" title="Remove">×</button>
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
