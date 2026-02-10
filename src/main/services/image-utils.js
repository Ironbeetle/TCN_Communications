// Image Optimization Utilities for TCN Communications
// Handles poster optimization for bulletin board

import sharp from 'sharp'

// Target dimensions for bulletin posters (8.5" x 11" at 72 DPI)
const TARGET_WIDTH = 612
const TARGET_HEIGHT = 792
const ASPECT_RATIO = 8.5 / 11 // 0.773
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance
const JPEG_QUALITY = 85

/**
 * Validate that an image has the correct 8.5:11 aspect ratio
 * @param {Buffer} imageBuffer - The image data as a buffer
 * @returns {Promise<{valid: boolean, width: number, height: number, ratio: number, error?: string}>}
 */
export async function validateAspectRatio(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    const { width, height } = metadata
    
    if (!width || !height) {
      return { valid: false, error: 'Unable to read image dimensions' }
    }
    
    const imageRatio = width / height
    const expectedRatio = ASPECT_RATIO
    const ratioDiff = Math.abs(imageRatio - expectedRatio) / expectedRatio
    
    if (ratioDiff > ASPECT_RATIO_TOLERANCE) {
      const expectedHeight = Math.round(width / ASPECT_RATIO)
      return {
        valid: false,
        width,
        height,
        ratio: imageRatio,
        error: `Image has wrong aspect ratio. Expected 8.5" × 11" (portrait). Your image is ${width}×${height}px. For this width, height should be approximately ${expectedHeight}px.`
      }
    }
    
    return {
      valid: true,
      width,
      height,
      ratio: imageRatio
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
 * - Validates aspect ratio (8.5:11)
 * - Resizes to 612×792px
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
    
    // Resize and convert to JPEG
    const optimizedBuffer = await sharp(imageBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
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
      dimensions: { width: TARGET_WIDTH, height: TARGET_HEIGHT }
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
