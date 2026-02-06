import { getPrisma } from './database.js'

// Timesheet Service for TCN Communications
// Handles all timesheet CRUD operations and submissions

/**
 * Normalize a date to midnight UTC (strip time component)
 */
function normalizeDate(date) {
  const d = new Date(date)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/**
 * Get pay period dates for a given date
 * Pay periods are bi-weekly, starting from a known reference date
 */
function getPayPeriodDates(date = new Date()) {
  // Reference: Pay periods start on a known Monday
  // Adjust this reference date to match your organization's pay period schedule
  const referenceDate = new Date('2025-01-06') // First Monday of reference
  
  const targetDate = new Date(date)
  const daysSinceReference = Math.floor((targetDate - referenceDate) / (1000 * 60 * 60 * 24))
  const periodIndex = Math.floor(daysSinceReference / 14)
  
  const periodStart = new Date(referenceDate)
  periodStart.setDate(periodStart.getDate() + (periodIndex * 14))
  
  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + 13)
  
  // Normalize to midnight UTC for consistent database queries
  return {
    start: normalizeDate(periodStart),
    end: normalizeDate(periodEnd)
  }
}

/**
 * Calculate total hours from time entries
 */
function calculateTotals(timeEntries, payPeriodStart) {
  const weekOneStart = new Date(payPeriodStart)
  const weekOneEnd = new Date(payPeriodStart)
  weekOneEnd.setDate(weekOneEnd.getDate() + 6)
  
  let week1Total = 0
  let week2Total = 0
  
  timeEntries.forEach(entry => {
    const entryDate = new Date(entry.date)
    const hours = parseFloat(entry.totalHours) || 0
    
    if (entryDate <= weekOneEnd) {
      week1Total += hours
    } else {
      week2Total += hours
    }
  })
  
  return {
    week1Total: Math.round(week1Total * 100) / 100,
    week2Total: Math.round(week2Total * 100) / 100,
    grandTotal: Math.round((week1Total + week2Total) * 100) / 100
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
  const prisma = getPrisma()
  
  try {
    const { start, end } = getPayPeriodDates(new Date())
    
    // Use upsert to handle race conditions and date matching issues
    const timesheet = await prisma.timeSheet.upsert({
      where: {
        userId_payPeriodStart: {
          userId,
          payPeriodStart: start
        }
      },
      update: {}, // No updates if it exists
      create: {
        userId,
        payPeriodStart: start,
        payPeriodEnd: end,
        status: 'DRAFT',
        week1Total: 0,
        week2Total: 0,
        grandTotal: 0
      },
      include: {
        timeEntries: {
          orderBy: { date: 'asc' }
        },
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      }
    })
    
    return { success: true, timesheet }
  } catch (error) {
    console.error('Error getting/creating timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a specific timesheet by ID
 */
export async function getTimesheetById({ timesheetId }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId },
      include: {
        timeEntries: {
          orderBy: { date: 'asc' }
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            department: true
          }
        }
      }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    return { success: true, timesheet }
  } catch (error) {
    console.error('Error getting timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all timesheets for a user
 */
export async function getUserTimesheets({ userId, status }) {
  const prisma = getPrisma()
  
  try {
    const where = { userId }
    if (status) {
      where.status = status
    }
    
    const timesheets = await prisma.timeSheet.findMany({
      where,
      include: {
        timeEntries: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      },
      orderBy: { payPeriodStart: 'desc' }
    })
    
    return { success: true, timesheets }
  } catch (error) {
    console.error('Error getting user timesheets:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all timesheets (for admin/staff_admin)
 */
export async function getAllTimesheets({ status, department }) {
  const prisma = getPrisma()
  
  try {
    const where = {}
    if (status) {
      where.status = status
    }
    if (department) {
      where.user = { department }
    }
    
    const timesheets = await prisma.timeSheet.findMany({
      where,
      include: {
        timeEntries: true,
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { payPeriodStart: 'desc' }
      ]
    })
    
    return { success: true, timesheets }
  } catch (error) {
    console.error('Error getting all timesheets:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Add or update a time entry
 */
export async function saveTimeEntry({ timesheetId, entryId, date, startTime, endTime, breakMinutes }) {
  const prisma = getPrisma()
  
  try {
    // Check if timesheet exists and is editable
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'DRAFT') {
      return { success: false, error: 'Cannot edit a submitted timesheet' }
    }
    
    // Calculate total hours
    const totalHours = calculateHoursFromTimes(startTime, endTime, breakMinutes || 0)
    
    let entry
    if (entryId) {
      // Update existing entry
      entry = await prisma.timeEntry.update({
        where: { id: entryId },
        data: {
          date: new Date(date),
          startTime,
          endTime,
          breakMinutes: breakMinutes || 0,
          totalHours
        }
      })
    } else {
      // Check if entry already exists for this date
      const existingEntry = await prisma.timeEntry.findFirst({
        where: {
          timeSheetId: timesheetId,
          date: new Date(date)
        }
      })
      
      if (existingEntry) {
        entry = await prisma.timeEntry.update({
          where: { id: existingEntry.id },
          data: {
            startTime,
            endTime,
            breakMinutes: breakMinutes || 0,
            totalHours
          }
        })
      } else {
        // Create new entry
        entry = await prisma.timeEntry.create({
          data: {
            timeSheetId: timesheetId,
            date: new Date(date),
            startTime,
            endTime,
            breakMinutes: breakMinutes || 0,
            totalHours
          }
        })
      }
    }
    
    // Recalculate totals
    const allEntries = await prisma.timeEntry.findMany({
      where: { timeSheetId: timesheetId }
    })
    
    const totals = calculateTotals(allEntries, timesheet.payPeriodStart)
    
    await prisma.timeSheet.update({
      where: { id: timesheetId },
      data: totals
    })
    
    return { success: true, entry, totals }
  } catch (error) {
    console.error('Error saving time entry:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a time entry
 */
export async function deleteTimeEntry({ entryId }) {
  const prisma = getPrisma()
  
  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: { timeSheet: true }
    })
    
    if (!entry) {
      return { success: false, error: 'Entry not found' }
    }
    
    if (entry.timeSheet.status !== 'DRAFT') {
      return { success: false, error: 'Cannot edit a submitted timesheet' }
    }
    
    await prisma.timeEntry.delete({
      where: { id: entryId }
    })
    
    // Recalculate totals
    const allEntries = await prisma.timeEntry.findMany({
      where: { timeSheetId: entry.timeSheetId }
    })
    
    const totals = calculateTotals(allEntries, entry.timeSheet.payPeriodStart)
    
    await prisma.timeSheet.update({
      where: { id: entry.timeSheetId },
      data: totals
    })
    
    return { success: true, totals }
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Submit timesheet for approval
 */
export async function submitTimesheet({ timesheetId }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId },
      include: { timeEntries: true }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'DRAFT') {
      return { success: false, error: 'Timesheet has already been submitted' }
    }
    
    if (timesheet.timeEntries.length === 0) {
      return { success: false, error: 'Cannot submit a timesheet with no entries' }
    }
    
    const updated = await prisma.timeSheet.update({
      where: { id: timesheetId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      include: {
        timeEntries: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      }
    })
    
    return { success: true, timesheet: updated }
  } catch (error) {
    console.error('Error submitting timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Approve timesheet (admin/staff_admin only)
 */
export async function approveTimesheet({ timesheetId, approverId }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'SUBMITTED') {
      return { success: false, error: 'Only submitted timesheets can be approved' }
    }
    
    const updated = await prisma.timeSheet.update({
      where: { id: timesheetId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: approverId,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null
      },
      include: {
        timeEntries: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true,
            email: true
          }
        }
      }
    })
    
    return { success: true, timesheet: updated }
  } catch (error) {
    console.error('Error approving timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject timesheet (admin/staff_admin only)
 */
export async function rejectTimesheet({ timesheetId, rejecterId, reason }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'SUBMITTED') {
      return { success: false, error: 'Only submitted timesheets can be rejected' }
    }
    
    const updated = await prisma.timeSheet.update({
      where: { id: timesheetId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: rejecterId,
        rejectionReason: reason || 'No reason provided'
      },
      include: {
        timeEntries: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true,
            email: true
          }
        }
      }
    })
    
    return { success: true, timesheet: updated }
  } catch (error) {
    console.error('Error rejecting timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Revert rejected timesheet to draft (allows user to edit and resubmit)
 */
export async function revertToDraft({ timesheetId }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'REJECTED') {
      return { success: false, error: 'Only rejected timesheets can be reverted to draft' }
    }
    
    const updated = await prisma.timeSheet.update({
      where: { id: timesheetId },
      data: {
        status: 'DRAFT',
        submittedAt: null,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null
      },
      include: {
        timeEntries: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      }
    })
    
    return { success: true, timesheet: updated }
  } catch (error) {
    console.error('Error reverting timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a timesheet (only drafts can be deleted)
 */
export async function deleteTimesheet({ timesheetId }) {
  const prisma = getPrisma()
  
  try {
    const timesheet = await prisma.timeSheet.findUnique({
      where: { id: timesheetId }
    })
    
    if (!timesheet) {
      return { success: false, error: 'Timesheet not found' }
    }
    
    if (timesheet.status !== 'DRAFT') {
      return { success: false, error: 'Only draft timesheets can be deleted' }
    }
    
    await prisma.timeSheet.delete({
      where: { id: timesheetId }
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting timesheet:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get pay period info
 */
export async function getPayPeriodInfo({ date }) {
  const { start, end } = getPayPeriodDates(date ? new Date(date) : new Date())
  
  return {
    success: true,
    payPeriod: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      startFormatted: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      endFormatted: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
}
