import { LOGOS, getLogoPreviewPath, getDefaultLogo } from '../config/logos'

/**
 * Letterhead selector component with logo dropdown
 * Used in EmailComposer and TextBulletinForm
 */
function LetterheadSelector({ 
  useLetterhead, 
  setUseLetterhead, 
  selectedLogoId, 
  setSelectedLogoId 
}) {
  const selectedLogo = LOGOS.find(l => l.id === selectedLogoId) || getDefaultLogo()
  
  return (
    <div className="composer-section letterhead-section">
      <div className="letterhead-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={useLetterhead}
            onChange={(e) => setUseLetterhead(e.target.checked)}
          />
          <span className="toggle-text">Include letterhead with logo</span>
        </label>
      </div>
      
      {useLetterhead && (
        <>
          <div className="logo-selector">
            <label htmlFor="logo-select">Select Logo</label>
            <select
              id="logo-select"
              value={selectedLogoId}
              onChange={(e) => setSelectedLogoId(e.target.value)}
              className="composer-select logo-dropdown"
            >
              {LOGOS.map((logo) => (
                <option key={logo.id} value={logo.id}>
                  {logo.name}
                </option>
              ))}
            </select>
            {selectedLogo?.description && (
              <span className="logo-description">{selectedLogo.description}</span>
            )}
          </div>
          
          <div className="letterhead-preview">
            <div className="letterhead-preview-header">
              <img 
                src={getLogoPreviewPath(selectedLogo?.filename)} 
                alt={selectedLogo?.name || 'Logo'} 
                className="letterhead-logo"
              />
              <span className="letterhead-title">{selectedLogo?.description || 'Tataskweyak Cree Nation'}</span>
            </div>
            <div className="letterhead-preview-note">
              Logo will appear at the top of your message
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default LetterheadSelector
