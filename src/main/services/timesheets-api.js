// Timesheet Service for TCN Communications
// Communicates with VPS API for all timesheet operations
// API Reference: REFERENCE/VPS/api-routes-staff-tools.js

import { apiRequest, extractArray } from './api-helpers.js'

/**
 * Get pay period dates for a given date
 * Pay periods are bi-weekly, starting from a known reference date
 */
function getPayPeriodDates(date = new Date()) {
  // Reference: Pay periods start on a known Monday
  const referenceDate = new Date('2025-01-06') // First Monday of reference
  
  const targetDate = new Date(date)
  const daysSinceReference = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24))
  const periodIndex = Math.floor(daysSinceReference / 14)
  
  const periodStart = new Date(referenceDate)
  periodStart.setDate(periodStart.getDate() + (periodIndex * 14))
  
  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + 13)
  
  return {
    start: periodStart.toISOString(),
    end: periodEnd.toISOString()
  }
}

/**
 * Calculate hours from start time, end time, and break
 */
function calculateHoursFromTimes(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) return 0
  
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  let totalMinutes = endMinutes - startMinutes - breakMinutes
  if (totalMinutes < 0) totalMinutes = 0
  
  return Math.round((totalMinutes / 60) * 100) / 100
}

/**
 * Create a new timesheet or get existing one for the current pay period
 */
export async function getOrCreateCurrentTimesheet({ userId }) {
  try {
    const { start, end } = getPayPeriodDates(new Date())
    
    // Try to get existing timesheet first
    const getResult = await apiRequest(`/api/timesheets/user/${userId}`)
    
    if (getResult.success) {
      // Handle both possible response formats: data array or timesheets array
      const timesheets = Array.isArray(getResult.data) ? getResult.data : 
                         Array.isArray(getResult.timesheets) ? getResult.timesheets : []
      
      // Check if there's a timesheet for current period
      const currentTimesheet = timesheets.find(ts => {
        const tsStart = new Date(ts.payPeriodStart).toDateString()
        const periodStart = new Date(start).toDateString()
        return tsStart === periodStart
      })
      
      if (currentTimesheet) {
        return { success: true, timesheet: currentTimesheet }
      }
    }
    
    // Create new timesheet if none exists
    const createResult = await apiRequest('/api/timesheets', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        payPeriodStart: start,
        payPeriodEnd: end,
        dailyHours: {},
        status: 'DRAFT'
      })
    })
    
    if (createResult.success) {
      return { success: true, timesheet: createResult.data }
    }
    
    return createResult
  } catch (error) {
    console.error('Error getting/creating timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a specific timesheet by ID
 */
export async function getTimesheetById({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}`)
}

/**
 * Get all timesheets for a user
 */
export async function getUserTimesheets({ userId, status }) {
  const endpoint = status 
    ? `/api/timesheets/user/${userId}?status=${status}`
    : `/api/timesheets/user/${userId}`
  return await apiRequest(endpoint)
}

/**
 * Get all timesheets (for admin/staff_admin)
 */
export async function getAllTimesheets({ status, department }) {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (department) params.append('department', department)
  
  const queryString = params.toString()
  const endpoint = queryString ? `/api/timesheets?${queryString}` : '/api/timesheets'
  const result = await apiRequest(endpoint)
  
  if (result.success) {
    // Handle VPS response format: { success: true, data: { timesheets: [...] } }
    const timesheets = result.data?.timesheets || result.data || []
    return { success: true, data: Array.isArray(timesheets) ? timesheets : [] }
  }
  
  return result
}

/**
 * Save time entry (updates dailyHours JSON on VPS)
 */
export async function saveTimeEntry({ timesheetId, date, startTime, endTime, breakMinutes, totalHours }) {
  try {
    // Get current timesheet
    const getResult = await apiRequest(`/api/timesheets/${timesheetId}`)
    
    if (!getResult.success) {
      return getResult
    }
    
    const timesheet = getResult.data
    
    if (timesheet.status !== 'DRAFT') {
      return { success: false, error: 'Cannot edit a submitted timesheet' }
    }
    
    // Calculate hours if not provided
    const hours = totalHours !== undefined 
      ? totalHours 
      : calculateHoursFromTimes(startTime, endTime, breakMinutes || 0)
    
    // Update dailyHours
    const dailyHours = timesheet.dailyHours || {}
    const dateKey = new Date(date).toISOString().split('T')[0]
    
    dailyHours[dateKey] = {
      startTime,
      endTime,
      breakMinutes: breakMinutes || 0,
      totalHours: hours
    }
    
    // Calculate totals
    let regularHours = 0
    Object.values(dailyHours).forEach(entry => {
      regularHours += entry.totalHours || 0
    })
    
    // Update timesheet on VPS
    const updateResult = await apiRequest('/api/timesheets', {
      method: 'POST', // Upsert
      body: JSON.stringify({
        userId: timesheet.userId,
        payPeriodStart: timesheet.payPeriodStart,
        payPeriodEnd: timesheet.payPeriodEnd,
        dailyHours,
        regularHours: Math.round(regularHours * 100) / 100,
        totalHours: Math.round(regularHours * 100) / 100,
        status: 'DRAFT'
      })
    })
    
    return updateResult
  } catch (error) {
    console.error('Error saving time entry:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a time entry
 */
export async function deleteTimeEntry({ timesheetId, date }) {
  try {
    // Get current timesheet
    const getResult = await apiRequest(`/api/timesheets/${timesheetId}`)
    
    if (!getResult.success) {
      return getResult
    }
    
    const timesheet = getResult.data
    
    if (timesheet.status !== 'DRAFT') {
      return { success: false, error: 'Cannot edit a submitted timesheet' }
    }
    
    // Remove from dailyHours
    const dailyHours = timesheet.dailyHours || {}
    const dateKey = new Date(date).toISOString().split('T')[0]
    delete dailyHours[dateKey]
    
    // Recalculate totals
    let regularHours = 0
    Object.values(dailyHours).forEach(entry => {
      regularHours += entry.totalHours || 0
    })
    
    // Update timesheet on VPS
    const updateResult = await apiRequest('/api/timesheets', {
      method: 'POST',
      body: JSON.stringify({
        userId: timesheet.userId,
        payPeriodStart: timesheet.payPeriodStart,
        payPeriodEnd: timesheet.payPeriodEnd,
        dailyHours,
        regularHours: Math.round(regularHours * 100) / 100,
        totalHours: Math.round(regularHours * 100) / 100,
        status: 'DRAFT'
      })
    })
    
    return updateResult
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Submit timesheet for approval
 */
export async function submitTimesheet({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/submit`, {
    method: 'POST'
  })
}

/**
 * Approve timesheet (admin/staff_admin only)
 */
export async function approveTimesheet({ timesheetId, approverId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approverId })
  })
}

/**
 * Reject timesheet (admin/staff_admin only)
 */
export async function rejectTimesheet({ timesheetId, rejecterId, reason }) {
  return await apiRequest(`/api/timesheets/${timesheetId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejecterId, reason })
  })
}

/**
 * Revert timesheet to draft (for corrections)
 */
export async function revertToDraft({ timesheetId }) {
  // Get timesheet first
  const getResult = await apiRequest(`/api/timesheets/${timesheetId}`)
  
  if (!getResult.success) {
    return getResult
  }
  
  const timesheet = getResult.data
  
  if (timesheet.status !== 'REJECTED') {
    return { success: false, error: 'Only rejected timesheets can be reverted to draft' }
  }
  
  // Update status back to DRAFT
  return await apiRequest('/api/timesheets', {
    method: 'POST',
    body: JSON.stringify({
      userId: timesheet.userId,
      payPeriodStart: timesheet.payPeriodStart,
      payPeriodEnd: timesheet.payPeriodEnd,
      dailyHours: timesheet.dailyHours,
      regularHours: timesheet.regularHours,
      totalHours: timesheet.totalHours,
      status: 'DRAFT'
    })
  })
}

/**
 * Delete timesheet (only drafts)
 */
export async function deleteTimesheet({ timesheetId }) {
  return await apiRequest(`/api/timesheets/${timesheetId}`, {
    method: 'DELETE'
  })
}

/**
 * Get pay period info
 */
export async function getPayPeriodInfo() {
  const { start, end } = getPayPeriodDates(new Date())
  
  return {
    success: true,
    payPeriod: {
      start,
      end,
      startFormatted: new Date(start).toLocaleDateString(),
      endFormatted: new Date(end).toLocaleDateString()
    }
  }
}

/**
 * Get timesheet stats for dashboard
 */
export async function getTimesheetStats(userId) {
  const result = await apiRequest(`/api/timesheets/stats/${userId}`)
  
  if (result.success) {
    return result.data
  }
  
  // Calculate local current period as fallback
  const { start, end } = getPayPeriodDates(new Date())
  const periodStart = new Date(start).toLocaleDateString()
  const periodEnd = new Date(end).toLocaleDateString()
  
  // Return defaults with local period calculation
  return { 
    pending: 0, 
    currentPeriod: `${periodStart} - ${periodEnd}` 
  }
}
