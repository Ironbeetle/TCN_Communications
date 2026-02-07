import { useState, useEffect } from 'react'
import './TravelForm.css'

// Default rates
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

function TravelForm({ user, onBack, editForm = null }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [activeSection, setActiveSection] = useState('basic')
  
  // Form data state
  const [formData, setFormData] = useState({
    name: `${user.first_name} ${user.last_name}`,
    destination: '',
    departureDate: '',
    returnDate: '',
    reasonsForTravel: '',
    
    // Accommodation
    hotelRate: DEFAULT_RATES.hotelRate,
    hotelNights: 0,
    hotelTotal: 0,
    privateRate: DEFAULT_RATES.privateRate,
    privateNights: 0,
    privateTotal: 0,
    
    // Meals
    breakfastRate: DEFAULT_RATES.breakfastRate,
    breakfastDays: 0,
    breakfastTotal: 0,
    lunchRate: DEFAULT_RATES.lunchRate,
    lunchDays: 0,
    lunchTotal: 0,
    dinnerRate: DEFAULT_RATES.dinnerRate,
    dinnerDays: 0,
    dinnerTotal: 0,
    
    // Incidentals
    incidentalRate: DEFAULT_RATES.incidentalRate,
    incidentalDays: 0,
    incidentalTotal: 0,
    
    // Transportation
    transportationType: 'PERSONAL_VEHICLE',
    personalVehicleRate: DEFAULT_RATES.personalVehicleRate,
    licensePlateNumber: '',
    oneWayWinnipegKm: DEFAULT_RATES.oneWayWinnipegKm,
    oneWayWinnipegTrips: 0,
    oneWayWinnipegTotal: 0,
    oneWayThompsonKm: DEFAULT_RATES.oneWayThompsonKm,
    oneWayThompsonTrips: 0,
    oneWayThompsonTotal: 0,
    winnipegFlatRate: DEFAULT_RATES.winnipegFlatRate,
    thompsonFlatRate: DEFAULT_RATES.thompsonFlatRate,
    publicTransportTotal: 0,
    
    // Taxi
    taxiFareRate: DEFAULT_RATES.taxiFareRate,
    taxiFareDays: 0,
    taxiFareTotal: 0,
    
    // Parking
    parkingTotal: 0,
    parkingReceipts: false,
    
    // Totals
    grandTotal: 0,
    
    // Notes
    notes: '',
    
    // Status
    status: 'DRAFT',
    userId: user.id
  })

  // Load existing form if editing
  useEffect(() => {
    if (editForm) {
      setFormData(prev => ({
        ...prev,
        ...editForm,
        departureDate: editForm.departureDate ? editForm.departureDate.split('T')[0] : '',
        returnDate: editForm.returnDate ? editForm.returnDate.split('T')[0] : ''
      }))
    }
  }, [editForm])

  // Auto-calculate totals when relevant fields change
  useEffect(() => {
    calculateTotals()
  }, [
    formData.hotelRate, formData.hotelNights,
    formData.privateRate, formData.privateNights,
    formData.breakfastRate, formData.breakfastDays,
    formData.lunchRate, formData.lunchDays,
    formData.dinnerRate, formData.dinnerDays,
    formData.incidentalRate, formData.incidentalDays,
    formData.transportationType,
    formData.personalVehicleRate,
    formData.oneWayWinnipegKm, formData.oneWayWinnipegTrips,
    formData.oneWayThompsonKm, formData.oneWayThompsonTrips,
    formData.winnipegFlatRate, formData.thompsonFlatRate,
    formData.taxiFareRate, formData.taxiFareDays,
    formData.parkingTotal
  ])

  const calculateTotals = () => {
    const newData = { ...formData }
    
    // Accommodation totals
    newData.hotelTotal = (newData.hotelRate || 0) * (newData.hotelNights || 0)
    newData.privateTotal = (newData.privateRate || 0) * (newData.privateNights || 0)
    
    // Meal totals
    newData.breakfastTotal = (newData.breakfastRate || 0) * (newData.breakfastDays || 0)
    newData.lunchTotal = (newData.lunchRate || 0) * (newData.lunchDays || 0)
    newData.dinnerTotal = (newData.dinnerRate || 0) * (newData.dinnerDays || 0)
    
    // Incidental total
    newData.incidentalTotal = (newData.incidentalRate || 0) * (newData.incidentalDays || 0)
    
    // Transportation totals
    if (newData.transportationType === 'PERSONAL_VEHICLE' || newData.transportationType === 'COMBINATION') {
      newData.oneWayWinnipegTotal = (newData.oneWayWinnipegKm || 0) * 
        (newData.oneWayWinnipegTrips || 0) * (newData.personalVehicleRate || 0)
      newData.oneWayThompsonTotal = (newData.oneWayThompsonKm || 0) * 
        (newData.oneWayThompsonTrips || 0) * (newData.personalVehicleRate || 0)
    } else {
      newData.oneWayWinnipegTotal = 0
      newData.oneWayThompsonTotal = 0
    }
    
    if (newData.transportationType === 'PUBLIC_TRANSPORT_WINNIPEG') {
      newData.publicTransportTotal = newData.winnipegFlatRate || 0
    } else if (newData.transportationType === 'PUBLIC_TRANSPORT_THOMPSON') {
      newData.publicTransportTotal = newData.thompsonFlatRate || 0
    } else if (newData.transportationType === 'COMBINATION') {
      newData.publicTransportTotal = (newData.winnipegFlatRate || 0) + (newData.thompsonFlatRate || 0)
    } else {
      newData.publicTransportTotal = 0
    }
    
    // Taxi total
    newData.taxiFareTotal = (newData.taxiFareRate || 0) * (newData.taxiFareDays || 0)
    
    // Grand total
    newData.grandTotal = 
      (newData.hotelTotal || 0) +
      (newData.privateTotal || 0) +
      (newData.breakfastTotal || 0) +
      (newData.lunchTotal || 0) +
      (newData.dinnerTotal || 0) +
      (newData.incidentalTotal || 0) +
      (newData.oneWayWinnipegTotal || 0) +
      (newData.oneWayThompsonTotal || 0) +
      (newData.publicTransportTotal || 0) +
      (newData.taxiFareTotal || 0) +
      (newData.parkingTotal || 0)
    
    // Round values
    newData.grandTotal = Math.round(newData.grandTotal * 100) / 100
    
    setFormData(newData)
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveDraft = async () => {
    // Validate minimum required fields for saving
    if (!formData.departureDate || !formData.returnDate) {
      setError('Please enter departure and return dates to save the form')
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      let result
      if (editForm?.id) {
        result = await window.electronAPI.travelForms.update({
          formId: editForm.id,
          ...formData
        })
      } else {
        result = await window.electronAPI.travelForms.create(formData)
      }
      
      if (result.success) {
        setSuccessMessage('Travel form saved as draft!')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to save travel form')
      }
    } catch (err) {
      console.error('Error saving travel form:', err)
      setError('Failed to save travel form')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.destination || !formData.departureDate || !formData.returnDate || !formData.reasonsForTravel) {
      setError('Please fill in all required fields (destination, dates, and reason)')
      return
    }
    
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    
    try {
      // First save/create the form
      let result
      console.log('Submitting form data:', formData)
      
      if (editForm?.id) {
        result = await window.electronAPI.travelForms.update({
          formId: editForm.id,
          ...formData
        })
      } else {
        result = await window.electronAPI.travelForms.create(formData)
      }
      
      console.log('Create/update result:', result)
      
      if (!result.success) {
        setError(result.error || 'Failed to save travel form')
        return
      }
      
      // Then submit it
      const formId = result.travelForm?.id || editForm?.id
      console.log('Form ID for submit:', formId)
      
      if (!formId) {
        setError('Failed to get form ID for submission')
        return
      }
      
      const submitResult = await window.electronAPI.travelForms.submit(formId)
      console.log('Submit result:', submitResult)
      
      if (submitResult.success) {
        setSuccessMessage('Travel form submitted for approval!')
        setFormData(prev => ({ ...prev, status: 'SUBMITTED' }))
      } else {
        setError(submitResult.error || 'Failed to submit travel form')
      }
    } catch (err) {
      console.error('Error submitting travel form:', err)
      setError('Failed to submit travel form')
    } finally {
      setSaving(false)
    }
  }

  const isViewOnly = formData.status === 'SUBMITTED' || formData.status === 'APPROVED' || formData.status === 'UNDER_REVIEW'

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value || 0)
  }

  return (
    <div className="travel-form">
      {/* Header */}
      <div className="travel-form-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>← Back</button>
          <div className="header-info">
            <h1>{editForm ? 'Edit Travel Request' : 'New Travel Request'}</h1>
            <p>{user.first_name} {user.last_name} • {user.department?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        
        {!isViewOnly && (
          <div className="header-actions">
            <button className="btn-secondary" onClick={handleSaveDraft} disabled={saving}>
              💾 Save Draft
            </button>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              📤 Submit for Approval
            </button>
          </div>
        )}
      </div>

      {/* Status Banner */}
      {formData.status && formData.status !== 'DRAFT' && (
        <div className={`status-banner status-${formData.status.toLowerCase()}`}>
          <strong>Status: {formData.status.replace(/_/g, ' ')}</strong>
          {formData.status === 'REJECTED' && formData.rejectionReason && (
            <span className="rejection-reason"> • Reason: {formData.rejectionReason}</span>
          )}
        </div>
      )}

      {/* Messages */}
      {error && <div className="message error">{error}</div>}
      {successMessage && <div className="message success">{successMessage}</div>}

      {/* Section Navigation */}
      <div className="section-tabs">
        <button 
          className={`section-tab ${activeSection === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveSection('basic')}
        >
          📋 Basic Info
        </button>
        <button 
          className={`section-tab ${activeSection === 'accommodation' ? 'active' : ''}`}
          onClick={() => setActiveSection('accommodation')}
        >
          🏨 Accommodation
        </button>
        <button 
          className={`section-tab ${activeSection === 'meals' ? 'active' : ''}`}
          onClick={() => setActiveSection('meals')}
        >
          🍽️ Meals
        </button>
        <button 
          className={`section-tab ${activeSection === 'transport' ? 'active' : ''}`}
          onClick={() => setActiveSection('transport')}
        >
          🚗 Transportation
        </button>
        <button 
          className={`section-tab ${activeSection === 'other' ? 'active' : ''}`}
          onClick={() => setActiveSection('other')}
        >
          📝 Other
        </button>
      </div>

      {/* Basic Information Section */}
      {activeSection === 'basic' && (
        <div className="form-section">
          <h2>📋 Basic Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                disabled={isViewOnly}
                required
              />
            </div>
            <div className="form-group">
              <label>Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => updateField('destination', e.target.value)}
                placeholder="e.g., Winnipeg, Thompson, etc."
                disabled={isViewOnly}
                required
              />
            </div>
            <div className="form-group">
              <label>Departure Date *</label>
              <input
                type="date"
                value={formData.departureDate}
                onChange={(e) => updateField('departureDate', e.target.value)}
                disabled={isViewOnly}
                required
              />
            </div>
            <div className="form-group">
              <label>Return Date *</label>
              <input
                type="date"
                value={formData.returnDate}
                onChange={(e) => updateField('returnDate', e.target.value)}
                disabled={isViewOnly}
                required
              />
            </div>
            <div className="form-group full-width">
              <label>Reason for Travel *</label>
              <textarea
                value={formData.reasonsForTravel}
                onChange={(e) => updateField('reasonsForTravel', e.target.value)}
                placeholder="Describe the purpose of your travel..."
                rows={4}
                disabled={isViewOnly}
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* Accommodation Section */}
      {activeSection === 'accommodation' && (
        <div className="form-section">
          <h2>🏨 Accommodation</h2>
          <div className="expense-cards">
            {/* Hotel */}
            <div className="expense-card">
              <h3>Hotel Accommodations</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Night</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hotelRate}
                    onChange={(e) => updateField('hotelRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Nights</label>
                  <input
                    type="number"
                    value={formData.hotelNights}
                    onChange={(e) => updateField('hotelNights', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.hotelTotal)}</div>
                </div>
              </div>
            </div>

            {/* Private Accommodations */}
            <div className="expense-card">
              <h3>Private Accommodations</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Night</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.privateRate}
                    onChange={(e) => updateField('privateRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Nights</label>
                  <input
                    type="number"
                    value={formData.privateNights}
                    onChange={(e) => updateField('privateNights', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.privateTotal)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meals Section */}
      {activeSection === 'meals' && (
        <div className="form-section">
          <h2>🍽️ Meals & Incidentals</h2>
          <div className="expense-cards">
            {/* Breakfast */}
            <div className="expense-card">
              <h3>Breakfast</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.breakfastRate}
                    onChange={(e) => updateField('breakfastRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Days</label>
                  <input
                    type="number"
                    value={formData.breakfastDays}
                    onChange={(e) => updateField('breakfastDays', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.breakfastTotal)}</div>
                </div>
              </div>
            </div>

            {/* Lunch */}
            <div className="expense-card">
              <h3>Lunch</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.lunchRate}
                    onChange={(e) => updateField('lunchRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Days</label>
                  <input
                    type="number"
                    value={formData.lunchDays}
                    onChange={(e) => updateField('lunchDays', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.lunchTotal)}</div>
                </div>
              </div>
            </div>

            {/* Dinner */}
            <div className="expense-card">
              <h3>Dinner</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.dinnerRate}
                    onChange={(e) => updateField('dinnerRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Days</label>
                  <input
                    type="number"
                    value={formData.dinnerDays}
                    onChange={(e) => updateField('dinnerDays', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.dinnerTotal)}</div>
                </div>
              </div>
            </div>

            {/* Incidentals */}
            <div className="expense-card">
              <h3>Incidentals</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.incidentalRate}
                    onChange={(e) => updateField('incidentalRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Days</label>
                  <input
                    type="number"
                    value={formData.incidentalDays}
                    onChange={(e) => updateField('incidentalDays', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.incidentalTotal)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transportation Section */}
      {activeSection === 'transport' && (
        <div className="form-section">
          <h2>🚗 Transportation</h2>
          
          <div className="form-group">
            <label>Transportation Type</label>
            <select
              value={formData.transportationType}
              onChange={(e) => updateField('transportationType', e.target.value)}
              disabled={isViewOnly}
            >
              <option value="PERSONAL_VEHICLE">Personal Vehicle</option>
              <option value="PUBLIC_TRANSPORT_WINNIPEG">Public Transport (Winnipeg)</option>
              <option value="PUBLIC_TRANSPORT_THOMPSON">Public Transport (Thompson)</option>
              <option value="COMBINATION">Combination</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Personal Vehicle Options */}
          {(formData.transportationType === 'PERSONAL_VEHICLE' || formData.transportationType === 'COMBINATION') && (
            <div className="expense-cards">
              <div className="expense-card full-width">
                <h3>Personal Vehicle</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Rate per KM</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.personalVehicleRate}
                      onChange={(e) => updateField('personalVehicleRate', parseFloat(e.target.value) || 0)}
                      disabled={isViewOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>License Plate #</label>
                    <input
                      type="text"
                      value={formData.licensePlateNumber}
                      onChange={(e) => updateField('licensePlateNumber', e.target.value)}
                      disabled={isViewOnly}
                    />
                  </div>
                </div>
              </div>

              {/* Winnipeg Trip */}
              <div className="expense-card">
                <h3>Trip to Winnipeg (One Way)</h3>
                <div className="expense-row">
                  <div className="expense-field">
                    <label>KM (One Way)</label>
                    <input
                      type="number"
                      value={formData.oneWayWinnipegKm}
                      onChange={(e) => updateField('oneWayWinnipegKm', parseInt(e.target.value) || 0)}
                      disabled={isViewOnly}
                    />
                  </div>
                  <div className="expense-field">
                    <label># of Trips</label>
                    <input
                      type="number"
                      value={formData.oneWayWinnipegTrips}
                      onChange={(e) => updateField('oneWayWinnipegTrips', parseInt(e.target.value) || 0)}
                      disabled={isViewOnly}
                    />
                  </div>
                  <div className="expense-total">
                    <label>Total</label>
                    <div className="total-display">{formatCurrency(formData.oneWayWinnipegTotal)}</div>
                  </div>
                </div>
              </div>

              {/* Thompson Trip */}
              <div className="expense-card">
                <h3>Trip to Thompson (One Way)</h3>
                <div className="expense-row">
                  <div className="expense-field">
                    <label>KM (One Way)</label>
                    <input
                      type="number"
                      value={formData.oneWayThompsonKm}
                      onChange={(e) => updateField('oneWayThompsonKm', parseInt(e.target.value) || 0)}
                      disabled={isViewOnly}
                    />
                  </div>
                  <div className="expense-field">
                    <label># of Trips</label>
                    <input
                      type="number"
                      value={formData.oneWayThompsonTrips}
                      onChange={(e) => updateField('oneWayThompsonTrips', parseInt(e.target.value) || 0)}
                      disabled={isViewOnly}
                    />
                  </div>
                  <div className="expense-total">
                    <label>Total</label>
                    <div className="total-display">{formatCurrency(formData.oneWayThompsonTotal)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Public Transport Options */}
          {(formData.transportationType === 'PUBLIC_TRANSPORT_WINNIPEG' || 
            formData.transportationType === 'PUBLIC_TRANSPORT_THOMPSON' || 
            formData.transportationType === 'COMBINATION') && (
            <div className="expense-cards">
              <div className="expense-card">
                <h3>Public Transportation</h3>
                <div className="form-grid">
                  {(formData.transportationType === 'PUBLIC_TRANSPORT_WINNIPEG' || formData.transportationType === 'COMBINATION') && (
                    <div className="form-group">
                      <label>Winnipeg Flat Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.winnipegFlatRate}
                        onChange={(e) => updateField('winnipegFlatRate', parseFloat(e.target.value) || 0)}
                        disabled={isViewOnly}
                      />
                    </div>
                  )}
                  {(formData.transportationType === 'PUBLIC_TRANSPORT_THOMPSON' || formData.transportationType === 'COMBINATION') && (
                    <div className="form-group">
                      <label>Thompson Flat Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.thompsonFlatRate}
                        onChange={(e) => updateField('thompsonFlatRate', parseFloat(e.target.value) || 0)}
                        disabled={isViewOnly}
                      />
                    </div>
                  )}
                </div>
                <div className="expense-total standalone">
                  <label>Public Transport Total</label>
                  <div className="total-display">{formatCurrency(formData.publicTransportTotal)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Taxi */}
          <div className="expense-cards">
            <div className="expense-card">
              <h3>Taxi Fare</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Rate/Day</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.taxiFareRate}
                    onChange={(e) => updateField('taxiFareRate', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field">
                  <label>Days</label>
                  <input
                    type="number"
                    value={formData.taxiFareDays}
                    onChange={(e) => updateField('taxiFareDays', parseInt(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-total">
                  <label>Total</label>
                  <div className="total-display">{formatCurrency(formData.taxiFareTotal)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Section */}
      {activeSection === 'other' && (
        <div className="form-section">
          <h2>📝 Other Expenses & Notes</h2>
          <div className="expense-cards">
            <div className="expense-card">
              <h3>Parking</h3>
              <div className="expense-row">
                <div className="expense-field">
                  <label>Parking Total</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.parkingTotal}
                    onChange={(e) => updateField('parkingTotal', parseFloat(e.target.value) || 0)}
                    disabled={isViewOnly}
                  />
                </div>
                <div className="expense-field checkbox-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.parkingReceipts}
                      onChange={(e) => updateField('parkingReceipts', e.target.checked)}
                      disabled={isViewOnly}
                    />
                    Receipts Attached
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Additional Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any additional information or special requests..."
              rows={4}
              disabled={isViewOnly}
            />
          </div>
        </div>
      )}

      {/* Grand Total Summary - Always Visible */}
      <div className="grand-total-section">
        <div className="total-breakdown">
          <div className="breakdown-item">
            <span>Accommodation</span>
            <span>{formatCurrency((formData.hotelTotal || 0) + (formData.privateTotal || 0))}</span>
          </div>
          <div className="breakdown-item">
            <span>Meals</span>
            <span>{formatCurrency((formData.breakfastTotal || 0) + (formData.lunchTotal || 0) + (formData.dinnerTotal || 0))}</span>
          </div>
          <div className="breakdown-item">
            <span>Incidentals</span>
            <span>{formatCurrency(formData.incidentalTotal || 0)}</span>
          </div>
          <div className="breakdown-item">
            <span>Transportation</span>
            <span>{formatCurrency((formData.oneWayWinnipegTotal || 0) + (formData.oneWayThompsonTotal || 0) + (formData.publicTransportTotal || 0) + (formData.taxiFareTotal || 0))}</span>
          </div>
          <div className="breakdown-item">
            <span>Parking</span>
            <span>{formatCurrency(formData.parkingTotal || 0)}</span>
          </div>
        </div>
        <div className="grand-total">
          <span>Grand Total</span>
          <span className="total-amount">{formatCurrency(formData.grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}

export default TravelForm
