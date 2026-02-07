// Centralized API Request Helper for TCN Communications
// All services should import from here to avoid duplication

// Get portal configuration from environment
export function getPortalConfig() {
  const baseUrl = process.env.PORTAL_API_URL || process.env.TCN_PORTAL_URL
  const apiKey = process.env.PORTAL_API_KEY || process.env.TCN_PORTAL_API_KEY
  
  // Normalize URL - remove trailing /api/sync if present
  const normalizedUrl = baseUrl ? baseUrl.replace(/\/api\/sync\/?$/i, '') : baseUrl
  
  return { baseUrl: normalizedUrl, apiKey }
}

// Check if portal is configured
export function isPortalConfigured() {
  const { baseUrl, apiKey } = getPortalConfig()
  return Boolean(baseUrl && apiKey)
}

// Sleep helper for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Centralized API request helper with consistent error handling and retry logic
export async function apiRequest(endpoint, options = {}) {
  const { baseUrl, apiKey } = getPortalConfig()
  const maxRetries = options.retries ?? 2
  const retryDelay = options.retryDelay ?? 1000
  
  // Remove custom options before passing to fetch
  const { retries, retryDelay: _, ...fetchOptions } = options
  
  if (!baseUrl || !apiKey) {
    console.error('Portal not configured. baseUrl:', baseUrl ? '[SET]' : '[NOT SET]', 'apiKey:', apiKey ? '[SET]' : '[NOT SET]')
    return { success: false, error: 'VPS API not configured. Please check your environment settings.' }
  }
  
  const url = `${baseUrl}${endpoint}`
  const method = fetchOptions.method || 'GET'
  
  // Debug: Show full URL being called
  console.log(`[API] ${method} ${url}`)
  
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      if (attempt > 0) {
        console.log(`API Request retry ${attempt}/${maxRetries}: ${method} ${url}`)
      } else {
        console.log(`API Request: ${method} ${url}`)
      }
    }
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-source': 'tcn-comm',
          ...fetchOptions.headers
        }
      })
      
      clearTimeout(timeoutId)
      
      const text = await response.text()
      
      // Log response status (suppress body for 404s or HTML responses)
      const isHtmlResponse = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('API Response status:', response.status)
        if (!isHtmlResponse && response.status !== 404) {
          console.log('API Response body:', text.substring(0, 500))
        }
      }
      
      if (!response.ok) {
        // Don't retry client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          // Handle 404 specifically - endpoint may not exist yet
          if (response.status === 404) {
            return { success: false, error: 'Endpoint not available', statusCode: 404 }
          }
          
          let errorMessage = `API error: ${response.status}`
          try {
            const errorData = JSON.parse(text)
            errorMessage = errorData.error || errorData.message || errorMessage
          } catch {
            // Don't show HTML in error messages
            if (text && !isHtmlResponse) {
              errorMessage = text.substring(0, 200)
            }
          }
          return { success: false, error: errorMessage, statusCode: response.status }
        }
        
        // Server error - will retry
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 200)}`)
      }
      
      // Handle empty responses
      if (!text || text.trim() === '') {
        return { success: true, data: null }
      }
      
      const result = JSON.parse(text)
      return result
      
    } catch (error) {
      lastError = error
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        console.error('API request timed out:', endpoint)
        lastError = new Error('Request timed out. Please try again.')
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        console.error('Network error:', error)
        lastError = new Error('Network error. Please check your connection.')
      }
      
      // Don't retry on last attempt
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`)
        await sleep(retryDelay * (attempt + 1)) // Exponential backoff
      }
    }
  }
  
  console.error('API request failed after retries:', lastError)
  return { success: false, error: lastError?.message || 'Request failed after retries' }
}

// Helper to safely extract array from various response formats
export function extractArray(result, ...keys) {
  if (!result) return []
  
  // Check each key in order
  for (const key of keys) {
    if (Array.isArray(result[key])) {
      return result[key]
    }
  }
  
  // Check if result itself is an array
  if (Array.isArray(result)) {
    return result
  }
  
  return []
}

// Helper to safely get nested data
export function extractData(result, fallback = null) {
  if (!result) return fallback
  if (result.data !== undefined) return result.data
  return fallback
}
