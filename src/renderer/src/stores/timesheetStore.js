import { create } from 'zustand'

// Quick-fill presets for common schedules
export const SCHEDULE_PRESETS = [
  { label: '8-4:30', start: '08:00', end: '16:30', break: 30 },
  { label: '9-5', start: '09:00', end: '17:00', break: 0 },
  { label: '7-3:30', start: '07:00', end: '15:30', break: 30 },
  { label: '8-5', start: '08:00', end: '17:00', break: 60 },
  { label: '6-2:30', start: '06:00', end: '14:30', break: 30 },
]

// Helper to calculate hours from start/end times
const calculateTotalHours = (startTime, endTime, breakMinutes) => {
  if (!startTime || !endTime) return 0
  
  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  let totalMinutes = endMinutes - startMinutes - breakMinutes
  if (totalMinutes < 0) totalMinutes = 0
  
  return Math.round((totalMinutes / 60) * 100) / 100
}

// Helper to calculate week totals
const calculateTotals = (entries) => {
  let week1 = 0
  let week2 = 0

  entries.forEach((entry, index) => {
    if (index < 7) {
      week1 += entry.totalHours || 0
    } else {
      week2 += entry.totalHours || 0
    }
  })

  return {
    week1Total: Math.round(week1 * 100) / 100,
    week2Total: Math.round(week2 * 100) / 100,
    grandTotal: Math.round((week1 + week2) * 100) / 100
  }
}

const useTimesheetStore = create((set, get) => ({
  // State
  loading: true,
  saving: false,
  timesheet: null,
  timeEntries: [],
  week1Total: 0,
  week2Total: 0,
  grandTotal: 0,
  error: null,
  successMessage: null,
  payPeriodStart: null,
  payPeriodEnd: null,

  // Actions
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setError: (error) => set({ error }),
  setSuccessMessage: (message) => {
    set({ successMessage: message })
    if (message) {
      setTimeout(() => set({ successMessage: null }), 3000)
    }
  },
  clearMessages: () => set({ error: null, successMessage: null }),

  // Initialize entries for 14 days from timesheet
  initializeTimeEntries: (ts) => {
    const start = new Date(ts.payPeriodStart)
    const existingEntries = ts.timeEntries || []
    
    const entries = []
    for (let i = 0; i < 14; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      const existing = existingEntries.find(e => 
        new Date(e.date).toISOString().split('T')[0] === dateStr
      )
      
      const startTime = existing?.startTime || ''
      const endTime = existing?.endTime || ''
      const breakMinutes = existing?.breakMinutes || 0
      
      const totalHours = (startTime && endTime) 
        ? calculateTotalHours(startTime, endTime, breakMinutes)
        : 0
      
      entries.push({
        id: existing?.id || null,
        date: dateStr,
        startTime,
        endTime,
        breakMinutes,
        totalHours,
      })
    }
    
    const totals = calculateTotals(entries)
    set({ 
      timeEntries: entries,
      ...totals
    })
  },

  // Load current timesheet from API
  loadCurrentTimesheet: async (userId) => {
    set({ loading: true, error: null })
    
    try {
      const result = await window.electronAPI.timesheets.getCurrent(userId)
      
      if (result.success) {
        const ts = result.timesheet
        set({
          timesheet: ts,
          payPeriodStart: new Date(ts.payPeriodStart),
          payPeriodEnd: new Date(ts.payPeriodEnd),
        })
        get().initializeTimeEntries(ts)
      } else {
        set({ error: result.error || 'Failed to load timesheet' })
      }
    } catch (err) {
      console.error('Error loading timesheet:', err)
      set({ error: 'Failed to load timesheet' })
    } finally {
      set({ loading: false })
    }
  },

  // Update a single time entry field
  updateTimeEntry: (index, field, value) => {
    const { timeEntries } = get()
    
    const newEntries = timeEntries.map((entry, i) => {
      if (i !== index) return entry
      
      const updatedEntry = { ...entry, [field]: value }
      
      // Recalculate hours if time-related field changed
      if (field === 'startTime' || field === 'endTime' || field === 'breakMinutes') {
        updatedEntry.totalHours = calculateTotalHours(
          updatedEntry.startTime,
          updatedEntry.endTime,
          Number(updatedEntry.breakMinutes) || 0
        )
      }
      
      return updatedEntry
    })
    
    const totals = calculateTotals(newEntries)
    set({ timeEntries: newEntries, ...totals })
  },

  // Apply a preset schedule to a row
  applyPreset: (index, preset) => {
    const { timeEntries } = get()
    
    const newEntries = timeEntries.map((entry, i) => {
      if (i !== index) return entry
      
      const totalHours = calculateTotalHours(preset.start, preset.end, preset.break)
      
      return {
        ...entry,
        startTime: preset.start,
        endTime: preset.end,
        breakMinutes: preset.break,
        totalHours
      }
    })
    
    const totals = calculateTotals(newEntries)
    set({ timeEntries: newEntries, ...totals })
  },

  // Clear a row
  clearEntry: (index) => {
    const { timeEntries } = get()
    
    const newEntries = timeEntries.map((entry, i) => {
      if (i !== index) return entry
      return { ...entry, startTime: '', endTime: '', breakMinutes: 0, totalHours: 0 }
    })
    
    const totals = calculateTotals(newEntries)
    set({ timeEntries: newEntries, ...totals })
  },

  // Save a single entry to the API
  saveEntry: async (index) => {
    const { timesheet, timeEntries } = get()
    if (!timesheet) return
    
    const entry = timeEntries[index]
    if (!entry || !entry.startTime || !entry.endTime) return
    
    try {
      const result = await window.electronAPI.timesheets.saveEntry({
        timesheetId: timesheet.id,
        entryId: entry.id,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes
      })
      
      if (result.success && result.entry) {
        // Update entry with saved ID
        const { timeEntries } = get()
        const newEntries = [...timeEntries]
        newEntries[index] = { ...newEntries[index], id: result.entry.id }
        set({ timeEntries: newEntries })
        
        // Update totals from response if provided
        if (result.totals) {
          set({
            week1Total: result.totals.week1Total,
            week2Total: result.totals.week2Total,
            grandTotal: result.totals.grandTotal
          })
        }
      }
    } catch (err) {
      console.error('Error saving entry:', err)
    }
  },

  // Save all entries as draft
  handleSaveDraft: async () => {
    const { timeEntries, saveEntry } = get()
    set({ saving: true, error: null, successMessage: null })
    
    try {
      for (let i = 0; i < timeEntries.length; i++) {
        const entry = timeEntries[i]
        if (entry.startTime && entry.endTime) {
          await saveEntry(i)
        }
      }
      
      set({ successMessage: 'Timesheet saved as draft!' })
      setTimeout(() => set({ successMessage: null }), 3000)
    } catch (err) {
      console.error('Error saving draft:', err)
      set({ error: 'Failed to save timesheet' })
    } finally {
      set({ saving: false })
    }
  },

  // Submit timesheet for approval
  handleSubmit: async () => {
    const { timesheet, timeEntries, grandTotal, saveEntry } = get()
    
    if (grandTotal === 0) {
      set({ error: 'Cannot submit a timesheet with no hours logged' })
      return
    }
    
    set({ saving: true, error: null, successMessage: null })
    
    try {
      // First save all entries
      for (let i = 0; i < timeEntries.length; i++) {
        const entry = timeEntries[i]
        if (entry.startTime && entry.endTime) {
          await saveEntry(i)
        }
      }
      
      // Then submit
      const result = await window.electronAPI.timesheets.submit(timesheet.id)
      
      if (result.success) {
        set({ 
          successMessage: 'Timesheet submitted for approval!',
          timesheet: result.timesheet
        })
      } else {
        set({ error: result.error || 'Failed to submit timesheet' })
      }
    } catch (err) {
      console.error('Error submitting:', err)
      set({ error: 'Failed to submit timesheet' })
    } finally {
      set({ saving: false })
    }
  },

  // Revert submitted timesheet to draft
  handleRevertToDraft: async () => {
    const { timesheet } = get()
    set({ saving: true, error: null })
    
    try {
      const result = await window.electronAPI.timesheets.revertToDraft(timesheet.id)
      
      if (result.success) {
        set({ 
          timesheet: result.timesheet,
          successMessage: 'Timesheet reverted to draft. You can now edit and resubmit.'
        })
        setTimeout(() => set({ successMessage: null }), 3000)
      } else {
        set({ error: result.error || 'Failed to revert timesheet' })
      }
    } catch (err) {
      console.error('Error reverting:', err)
      set({ error: 'Failed to revert timesheet' })
    } finally {
      set({ saving: false })
    }
  },

  // Reset store (for cleanup when leaving form)
  reset: () => set({
    loading: true,
    saving: false,
    timesheet: null,
    timeEntries: [],
    week1Total: 0,
    week2Total: 0,
    grandTotal: 0,
    error: null,
    successMessage: null,
    payPeriodStart: null,
    payPeriodEnd: null,
  })
}))

export default useTimesheetStore
