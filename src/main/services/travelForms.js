import { getPrisma } from './database.js'

// Travel Forms Service for TCN Communications
// Handles all travel form CRUD operations and submissions

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
 * Calculate all totals for a travel form
 */
function calculateTotals(data) {
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
  const prisma = getPrisma()
  
  try {
    // Apply default rates and calculate totals
    const formData = {
      ...DEFAULT_RATES,
      ...data,
      status: 'DRAFT'
    }
    
    const calculated = calculateTotals(formData)
    
    const travelForm = await prisma.travelForm.create({
      data: {
        name: calculated.name,
        destination: calculated.destination,
        departureDate: new Date(calculated.departureDate),
        returnDate: new Date(calculated.returnDate),
        reasonsForTravel: calculated.reasonsForTravel,
        
        // Accommodation
        hotelRate: calculated.hotelRate,
        hotelNights: calculated.hotelNights || 0,
        hotelTotal: calculated.hotelTotal,
        privateRate: calculated.privateRate,
        privateNights: calculated.privateNights || 0,
        privateTotal: calculated.privateTotal,
        
        // Meals
        breakfastRate: calculated.breakfastRate,
        breakfastDays: calculated.breakfastDays || 0,
        breakfastTotal: calculated.breakfastTotal,
        lunchRate: calculated.lunchRate,
        lunchDays: calculated.lunchDays || 0,
        lunchTotal: calculated.lunchTotal,
        dinnerRate: calculated.dinnerRate,
        dinnerDays: calculated.dinnerDays || 0,
        dinnerTotal: calculated.dinnerTotal,
        
        // Incidentals
        incidentalRate: calculated.incidentalRate,
        incidentalDays: calculated.incidentalDays || 0,
        incidentalTotal: calculated.incidentalTotal,
        
        // Transportation
        transportationType: calculated.transportationType,
        personalVehicleRate: calculated.personalVehicleRate,
        licensePlateNumber: calculated.licensePlateNumber || '',
        oneWayWinnipegKm: calculated.oneWayWinnipegKm,
        oneWayWinnipegTrips: calculated.oneWayWinnipegTrips || 0,
        oneWayWinnipegTotal: calculated.oneWayWinnipegTotal,
        oneWayThompsonKm: calculated.oneWayThompsonKm,
        oneWayThompsonTrips: calculated.oneWayThompsonTrips || 0,
        oneWayThompsonTotal: calculated.oneWayThompsonTotal,
        
        // Public Transport
        winnipegFlatRate: calculated.winnipegFlatRate,
        thompsonFlatRate: calculated.thompsonFlatRate,
        publicTransportTotal: calculated.publicTransportTotal,
        
        // Taxi
        taxiFareRate: calculated.taxiFareRate,
        taxiFareDays: calculated.taxiFareDays || 0,
        taxiFareTotal: calculated.taxiFareTotal,
        
        // Parking
        parkingTotal: calculated.parkingTotal || 0,
        parkingReceipts: calculated.parkingReceipts || false,
        
        // Totals
        grandTotal: calculated.grandTotal,
        
        // Status
        status: 'DRAFT',
        notes: calculated.notes || '',
        
        // User relation
        userId: calculated.userId
      },
      include: {
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
    
    return { success: true, travelForm }
  } catch (error) {
    console.error('Error creating travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update a travel form
 */
export async function updateTravelForm({ formId, ...data }) {
  const prisma = getPrisma()
  
  try {
    const existing = await prisma.travelForm.findUnique({
      where: { id: formId }
    })
    
    if (!existing) {
      return { success: false, error: 'Travel form not found' }
    }
    
    if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
      return { success: false, error: 'Cannot edit a submitted travel form' }
    }
    
    // Calculate totals
    const formData = { ...existing, ...data }
    const calculated = calculateTotals(formData)
    
    const updateData = {}
    
    // Only include fields that were provided
    const fields = [
      'name', 'destination', 'reasonsForTravel',
      'hotelRate', 'hotelNights', 'hotelTotal',
      'privateRate', 'privateNights', 'privateTotal',
      'breakfastRate', 'breakfastDays', 'breakfastTotal',
      'lunchRate', 'lunchDays', 'lunchTotal',
      'dinnerRate', 'dinnerDays', 'dinnerTotal',
      'incidentalRate', 'incidentalDays', 'incidentalTotal',
      'transportationType', 'personalVehicleRate', 'licensePlateNumber',
      'oneWayWinnipegKm', 'oneWayWinnipegTrips', 'oneWayWinnipegTotal',
      'oneWayThompsonKm', 'oneWayThompsonTrips', 'oneWayThompsonTotal',
      'winnipegFlatRate', 'thompsonFlatRate', 'publicTransportTotal',
      'taxiFareRate', 'taxiFareDays', 'taxiFareTotal',
      'parkingTotal', 'parkingReceipts', 'grandTotal', 'notes'
    ]
    
    fields.forEach(field => {
      if (calculated[field] !== undefined) {
        updateData[field] = calculated[field]
      }
    })
    
    if (data.departureDate) {
      updateData.departureDate = new Date(data.departureDate)
    }
    if (data.returnDate) {
      updateData.returnDate = new Date(data.returnDate)
    }
    
    // If reverting from rejected, set status back to draft
    if (existing.status === 'REJECTED') {
      updateData.status = 'DRAFT'
      updateData.rejectedAt = null
      updateData.rejectedBy = null
      updateData.rejectionReason = null
    }
    
    const travelForm = await prisma.travelForm.update({
      where: { id: formId },
      data: updateData,
      include: {
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
    
    return { success: true, travelForm }
  } catch (error) {
    console.error('Error updating travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a specific travel form by ID
 */
export async function getTravelFormById({ formId }) {
  const prisma = getPrisma()
  
  try {
    const travelForm = await prisma.travelForm.findUnique({
      where: { id: formId },
      include: {
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
    
    if (!travelForm) {
      return { success: false, error: 'Travel form not found' }
    }
    
    return { success: true, travelForm }
  } catch (error) {
    console.error('Error getting travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all travel forms for a user
 */
export async function getUserTravelForms({ userId, status }) {
  const prisma = getPrisma()
  
  try {
    const where = { userId }
    if (status && status !== 'ALL') {
      where.status = status
    }
    
    const travelForms = await prisma.travelForm.findMany({
      where,
      include: {
        user: {
          select: {
            first_name: true,
            last_name: true,
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return { success: true, travelForms }
  } catch (error) {
    console.error('Error getting user travel forms:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all travel forms (for admin/staff_admin)
 */
export async function getAllTravelForms({ status, department }) {
  const prisma = getPrisma()
  
  try {
    const where = {}
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (department) {
      where.user = { department }
    }
    
    const travelForms = await prisma.travelForm.findMany({
      where,
      include: {
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
        { createdAt: 'desc' }
      ]
    })
    
    return { success: true, travelForms }
  } catch (error) {
    console.error('Error getting all travel forms:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Submit travel form for approval
 */
export async function submitTravelForm({ formId }) {
  const prisma = getPrisma()
  
  try {
    const travelForm = await prisma.travelForm.findUnique({
      where: { id: formId }
    })
    
    if (!travelForm) {
      return { success: false, error: 'Travel form not found' }
    }
    
    if (travelForm.status !== 'DRAFT') {
      return { success: false, error: 'Only draft forms can be submitted' }
    }
    
    // Validate required fields
    if (!travelForm.destination || !travelForm.reasonsForTravel) {
      return { success: false, error: 'Please fill in all required fields' }
    }
    
    const updated = await prisma.travelForm.update({
      where: { id: formId },
      data: {
        status: 'SUBMITTED',
        submittedDate: new Date()
      },
      include: {
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
    
    return { success: true, travelForm: updated }
  } catch (error) {
    console.error('Error submitting travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Approve travel form (admin/staff_admin only)
 */
export async function approveTravelForm({ formId, approverId }) {
  const prisma = getPrisma()
  
  try {
    const travelForm = await prisma.travelForm.findUnique({
      where: { id: formId }
    })
    
    if (!travelForm) {
      return { success: false, error: 'Travel form not found' }
    }
    
    if (travelForm.status !== 'SUBMITTED' && travelForm.status !== 'UNDER_REVIEW') {
      return { success: false, error: 'Only submitted forms can be approved' }
    }
    
    const updated = await prisma.travelForm.update({
      where: { id: formId },
      data: {
        status: 'APPROVED',
        authorizedBy: approverId,
        authorizedDate: new Date(),
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null
      },
      include: {
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
    
    return { success: true, travelForm: updated }
  } catch (error) {
    console.error('Error approving travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject travel form (admin/staff_admin only)
 */
export async function rejectTravelForm({ formId, rejecterId, reason }) {
  const prisma = getPrisma()
  
  try {
    const travelForm = await prisma.travelForm.findUnique({
      where: { id: formId }
    })
    
    if (!travelForm) {
      return { success: false, error: 'Travel form not found' }
    }
    
    if (travelForm.status !== 'SUBMITTED' && travelForm.status !== 'UNDER_REVIEW') {
      return { success: false, error: 'Only submitted forms can be rejected' }
    }
    
    const updated = await prisma.travelForm.update({
      where: { id: formId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: rejecterId,
        rejectionReason: reason || 'No reason provided'
      },
      include: {
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
    
    return { success: true, travelForm: updated }
  } catch (error) {
    console.error('Error rejecting travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a travel form (only drafts can be deleted)
 */
export async function deleteTravelForm({ formId }) {
  const prisma = getPrisma()
  
  try {
    const travelForm = await prisma.travelForm.findUnique({
      where: { id: formId }
    })
    
    if (!travelForm) {
      return { success: false, error: 'Travel form not found' }
    }
    
    if (travelForm.status !== 'DRAFT') {
      return { success: false, error: 'Only draft forms can be deleted' }
    }
    
    await prisma.travelForm.delete({
      where: { id: formId }
    })
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting travel form:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get default rates for travel forms
 */
export async function getDefaultRates() {
  return { success: true, rates: DEFAULT_RATES }
}

/**
 * Get travel form stats for a user (for dashboard display)
 */
export async function getTravelFormStats(userId) {
  const prisma = getPrisma()
  
  try {
    const drafts = await prisma.travelForm.count({
      where: { userId, status: 'DRAFT' }
    })
    
    const pending = await prisma.travelForm.count({
      where: { 
        userId, 
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
      }
    })
    
    return { success: true, drafts, pending }
  } catch (error) {
    console.error('Error getting travel form stats:', error)
    return { success: false, error: error.message, drafts: 0, pending: 0 }
  }
}
