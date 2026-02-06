// Travel Forms Service for TCN Communications
// Communicates with VPS API for all travel form operations
// API Reference: REFERENCE/VPS/api-routes-staff-tools.js

import { apiRequest } from './api-helpers.js'

// Default rates for travel forms
const DEFAULT_RATES = {
  hotelRate: 200.00,
  privateRate: 50.00,
  breakfastRate: 20.50,
  lunchRate: 20.10,
  dinnerRate: 50.65,
  incidentalRate: 10.00,
  personalVehicleRate: 0.50,
  oneWayWinnipegKm: 904,
  oneWayThompsonKm: 150,
  winnipegFlatRate: 450.00,
  thompsonFlatRate: 100.00,
  taxiFareRate: 17.30
}

/**
 * Calculate all totals for a travel form (client-side calculation for preview)
 */
export function calculateTotals(data) {
  const calculated = { ...data }
  
  // Accommodation totals
  calculated.hotelTotal = (calculated.hotelRate || 0) * (calculated.hotelNights || 0)
  calculated.privateTotal = (calculated.privateRate || 0) * (calculated.privateNights || 0)
  
  // Meal totals
  calculated.breakfastTotal = (calculated.breakfastRate || 0) * (calculated.breakfastDays || 0)
  calculated.lunchTotal = (calculated.lunchRate || 0) * (calculated.lunchDays || 0)
  calculated.dinnerTotal = (calculated.dinnerRate || 0) * (calculated.dinnerDays || 0)
  
  // Incidental total
  calculated.incidentalTotal = (calculated.incidentalRate || 0) * (calculated.incidentalDays || 0)
  
  // Transportation totals based on type
  const transportType = calculated.transportationType || 'PERSONAL_VEHICLE'
  
  if (transportType === 'PERSONAL_VEHICLE' || transportType === 'COMBINATION') {
    calculated.oneWayWinnipegTotal = (calculated.oneWayWinnipegKm || 0) * 
      (calculated.oneWayWinnipegTrips || 0) * (calculated.personalVehicleRate || 0)
    calculated.oneWayThompsonTotal = (calculated.oneWayThompsonKm || 0) * 
      (calculated.oneWayThompsonTrips || 0) * (calculated.personalVehicleRate || 0)
  } else {
    calculated.oneWayWinnipegTotal = 0
    calculated.oneWayThompsonTotal = 0
  }
  
  if (transportType === 'PUBLIC_TRANSPORT_WINNIPEG') {
    calculated.publicTransportTotal = calculated.winnipegFlatRate || 0
  } else if (transportType === 'PUBLIC_TRANSPORT_THOMPSON') {
    calculated.publicTransportTotal = calculated.thompsonFlatRate || 0
  } else if (transportType === 'COMBINATION') {
    calculated.publicTransportTotal = (calculated.winnipegFlatRate || 0) + (calculated.thompsonFlatRate || 0)
  } else {
    calculated.publicTransportTotal = 0
  }
  
  // Taxi total
  calculated.taxiFareTotal = (calculated.taxiFareRate || 0) * (calculated.taxiFareDays || 0)
  
  // Grand total
  calculated.grandTotal = 
    (calculated.hotelTotal || 0) +
    (calculated.privateTotal || 0) +
    (calculated.breakfastTotal || 0) +
    (calculated.lunchTotal || 0) +
    (calculated.dinnerTotal || 0) +
    (calculated.incidentalTotal || 0) +
    (calculated.oneWayWinnipegTotal || 0) +
    (calculated.oneWayThompsonTotal || 0) +
    (calculated.publicTransportTotal || 0) +
    (calculated.taxiFareTotal || 0) +
    (calculated.parkingTotal || 0)
  
  // Round all float values
  const floatFields = [
    'hotelTotal', 'privateTotal', 'breakfastTotal', 'lunchTotal', 'dinnerTotal',
    'incidentalTotal', 'oneWayWinnipegTotal', 'oneWayThompsonTotal', 
    'publicTransportTotal', 'taxiFareTotal', 'grandTotal'
  ]
  
  floatFields.forEach(field => {
    if (calculated[field] !== undefined) {
      calculated[field] = Math.round(calculated[field] * 100) / 100
    }
  })
  
  return calculated
}

/**
 * Create a new travel form
 */
export async function createTravelForm(data) {
  // Apply default rates
  const formData = {
    ...DEFAULT_RATES,
    ...data
  }
  
  return await apiRequest('/api/travel-forms', {
    method: 'POST',
    body: JSON.stringify(formData)
  })
}

/**
 * Update an existing travel form
 */
export async function updateTravelForm(data) {
  const { formId, ...updateData } = data
  
  return await apiRequest(`/api/travel-forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  })
}

/**
 * Get a specific travel form by ID
 */
export async function getTravelFormById({ formId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}`)
  
  if (result.success) {
    return { success: true, travelForm: result.data }
  }
  
  return result
}

/**
 * Get all travel forms for a user
 */
export async function getUserTravelForms({ userId, status }) {
  const endpoint = status && status !== 'ALL'
    ? `/api/travel-forms/user/${userId}?status=${status}`
    : `/api/travel-forms/user/${userId}`
  
  const result = await apiRequest(endpoint)
  
  if (result.success) {
    return { success: true, travelForms: result.data }
  }
  
  return result
}

/**
 * Get all travel forms (for admin/staff_admin)
 */
export async function getAllTravelForms({ status, department }) {
  const params = new URLSearchParams()
  if (status && status !== 'ALL') params.append('status', status)
  if (department) params.append('department', department)
  
  const queryString = params.toString()
  const endpoint = queryString ? `/api/travel-forms?${queryString}` : '/api/travel-forms'
  
  const result = await apiRequest(endpoint)
  
  if (result.success) {
    return { success: true, travelForms: result.data }
  }
  
  return result
}

/**
 * Submit travel form for approval
 */
export async function submitTravelForm({ formId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/submit`, {
    method: 'POST'
  })
  
  if (result.success) {
    return { success: true, travelForm: result.data }
  }
  
  return result
}

/**
 * Approve travel form (admin/staff_admin only)
 */
export async function approveTravelForm({ formId, approverId }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approverId })
  })
  
  if (result.success) {
    return { success: true, travelForm: result.data }
  }
  
  return result
}

/**
 * Reject travel form (admin/staff_admin only)
 */
export async function rejectTravelForm({ formId, rejecterId, reason }) {
  const result = await apiRequest(`/api/travel-forms/${formId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejecterId, reason })
  })
  
  if (result.success) {
    return { success: true, travelForm: result.data }
  }
  
  return result
}

/**
 * Delete a travel form (only drafts can be deleted)
 */
export async function deleteTravelForm({ formId }) {
  return await apiRequest(`/api/travel-forms/${formId}`, {
    method: 'DELETE'
  })
}

/**
 * Get default rates for travel forms
 */
export async function getDefaultRates() {
  // Try to get from VPS first (in case rates are configurable there)
  const result = await apiRequest('/api/travel-forms/rates')
  
  if (result.success) {
    return { success: true, rates: result.data }
  }
  
  // Fallback to local defaults
  return { success: true, rates: DEFAULT_RATES }
}

/**
 * Get travel form stats for dashboard
 */
export async function getTravelFormStats(userId) {
  const result = await apiRequest(`/api/travel-forms/stats/${userId}`)
  
  if (result.success) {
    return result.data
  }
  
  // Return defaults on error
  return { drafts: 0, pending: 0 }
}
