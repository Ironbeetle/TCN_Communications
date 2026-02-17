// Image Optimization Utilities for TCN Communications
// Handles poster optimization for bulletin board

import sharp from 'sharp'

// Target dimensions for bulletin posters (72 DPI)
const POSTER_SPECS = [
  {
    key: 'letter',
    width: 612,
    height: 792,
    ratio: 8.5 / 11,
    label: '8.5" × 11" (portrait)'
  },
  {
    key: 'legal',
    width: 612,
    height: 1008,
    ratio: 8.5 / 14,
    label: '8.5" × 14" (legal, portrait)'
  }
]
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance
const JPEG_QUALITY = 85

/**
 * Validate that an image has an approved poster aspect ratio
 * @param {Buffer} imageBuffer - The image data as a buffer
 * @returns {Promise<{valid: boolean, width: number, height: number, ratio: number, spec?: object, error?: string}>}
 */
export async function validateAspectRatio(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    const { width, height } = metadata
    
    if (!width || !height) {
      return { valid: false, error: 'Unable to read image dimensions' }
    }
    
    const imageRatio = width / height
    const matchedSpec = POSTER_SPECS.find((spec) => {
      const ratioDiff = Math.abs(imageRatio - spec.ratio) / spec.ratio
      return ratioDiff <= ASPECT_RATIO_TOLERANCE
    })

    if (!matchedSpec) {
      const expectedHeights = POSTER_SPECS
        .map((spec) => `${spec.label} ~${Math.round(width / spec.ratio)}px tall`)
        .join(', ')
      return {
        valid: false,
        width,
        height,
        ratio: imageRatio,
        error: `Image has wrong aspect ratio. Expected ${POSTER_SPECS.map((spec) => spec.label).join(' or ')}. Your image is ${width}×${height}px. For this width, height should be approximately ${expectedHeights}.`
      }
    }
    
    return {
      valid: true,
      width,
      height,
      ratio: imageRatio,
      spec: matchedSpec
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to read image: ${error.message}`
    }
  }
}

/**
 * Optimize an image for bulletin board posting
 * - Validates aspect ratio (letter or legal)
 * - Resizes to target dimensions
 * - Converts to JPEG at 85% quality
 * 
 * @param {Buffer} imageBuffer - The original image data
 * @returns {Promise<{success: boolean, data?: string, error?: string, originalSize?: number, optimizedSize?: number}>}
 */
export async function optimizePosterImage(imageBuffer) {
  try {
    // First validate aspect ratio
    const validation = await validateAspectRatio(imageBuffer)
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }
    
    const originalSize = imageBuffer.length
    const { width, height } = validation.spec

    // Resize and convert to JPEG
    const optimizedBuffer = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'fill', // Stretch to exact dimensions (aspect ratio already validated)
        withoutEnlargement: false // Allow upscaling small images
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true // Use mozjpeg for better compression
      })
      .toBuffer()
    
    // Convert to base64 data URL
    const base64Data = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`
    
    return {
      success: true,
      data: base64Data,
      originalSize,
      optimizedSize: optimizedBuffer.length,
      dimensions: { width, height }
    }
  } catch (error) {
    console.error('Image optimization failed:', error)
    return {
      success: false,
      error: `Image optimization failed: ${error.message}`
    }
  }
}

/**
 * Quick validation check without optimization
 * Use this for immediate feedback when user selects a file
 * 
 * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
 * @returns {Promise<{valid: boolean, error?: string, dimensions?: {width: number, height: number}}>}
 */
export async function validatePosterImage(base64Data) {
  try {
    // Strip data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Clean, 'base64')
    
    const validation = await validateAspectRatio(buffer)
    
    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error
      }
    }
    
    return {
      valid: true,
      dimensions: { width: validation.width, height: validation.height }
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate image: ${error.message}`
    }
  }
}

/**
 * Validate and optimize a poster image in one step
 * 
 * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
 * @returns {Promise<{success: boolean, data?: string, error?: string, stats?: object}>}
 */
export async function validateAndOptimizePoster(base64Data) {
  try {
    // Strip data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Clean, 'base64')
    
    const result = await optimizePosterImage(buffer)
    
    if (result.success) {
      const savings = Math.round((1 - result.optimizedSize / result.originalSize) * 100)
      return {
        success: true,
        data: result.data,
        stats: {
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          savings: savings > 0 ? `${savings}% smaller` : 'No size reduction',
          dimensions: result.dimensions
        }
      }
    }
    
    return result
  } catch (error) {
    return {
      success: false,
      error: `Image processing failed: ${error.message}`
    }
  }
}
