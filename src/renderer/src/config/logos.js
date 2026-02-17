/**
 * Logo Configuration for TCN Communications
 * 
 * SETUP:
 * 1. Upload optimized logos to VPS at: /public/logos/
 *    Example: /public/logos/tcn-main.png, /public/logos/jwhc-main.png, etc.
 * 
 * 2. Place the same logos in src/renderer/public/ for local preview
 * 
 * 3. The 'id' matches the filename and is sent to the API
 * 
 * Recommended logo size: 300-400px wide, PNG format with transparency
 */

export const LOGOS = [
  {
    id: 'tcn-main',
    name: 'TCN',
    filename: 'tcn-main.png',
    description: 'Tataskweyak Cree Nation'
  },
  {
    id: 'jwhc-main',
    name: 'JWHC',
    filename: 'jwhc-main.png',
    description: 'John Wavey Health Center'
  },
  {
    id: 'cscmec-main',
    name: 'CSCMEC',
    filename: 'cscmec-main.png',
    description: 'Chief Sam Cook Mahmuwee Educational Center'
  },
]

/**
 * Get logo path for preview in renderer
 */
export function getLogoPreviewPath(filename) {
  return `/${filename}`
}

/**
 * Get default logo
 */
export function getDefaultLogo() {
  return LOGOS[0] || null
}

/**
 * Find logo by ID
 */
export function getLogoById(logoId) {
  return LOGOS.find(logo => logo.id === logoId) || null
}

export default LOGOS
