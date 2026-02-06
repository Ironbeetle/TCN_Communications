import { useState, useEffect } from 'react'
import './Forms.css'

const FIELD_TYPES = [
  { value: 'TEXT', label: 'Text Input' },
  { value: 'TEXTAREA', label: 'Long Text' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone Number' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Dropdown' },
  { value: 'MULTISELECT', label: 'Multi-Select' },
  { value: 'CHECKBOX', label: 'Checkbox' }
]

const DEFAULT_FIELD = {
  label: '',
  fieldType: 'TEXT',
  placeholder: '',
  required: false,
  options: []
}

const CATEGORY_OPTIONS = [
  { value: 'BAND_OFFICE', label: 'Band Office' },
  { value: 'J_W_HEALTH_CENTER', label: 'J.W. Health Center' },
  { value: 'CSCMEC', label: 'CSCMEC' },
  { value: 'COUNCIL', label: 'Council' },
  { value: 'RECREATION', label: 'Recreation' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'TRSC', label: 'Land_Use_Programs' }
]

function FormBuilder({ form, user, onSave, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [maxEntries, setMaxEntries] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [allowResubmit, setAllowResubmit] = useState(false)
  const [resubmitMessage, setResubmitMessage] = useState('')
  const [fields, setFields] = useState([{ ...DEFAULT_FIELD }])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [portalWarning, setPortalWarning] = useState('')

  // Category is selectable; default to the user's department
  const [category, setCategory] = useState(user?.department || 'BAND_OFFICE')

  useEffect(() => {
    if (form) {
      setTitle(form.title || '')
      setDescription(form.description || '')
      setCategory(form.category || user?.department || 'BAND_OFFICE')
      setDeadline(form.deadline ? new Date(form.deadline).toISOString().split('T')[0] : '')
      setMaxEntries(form.maxEntries || '')
      setIsActive(form.isActive !== false)
      setAllowResubmit(form.allowResubmit || false)
      setResubmitMessage(form.resubmitMessage || '')
      if (form.fields && form.fields.length > 0) {
        setFields(form.fields.map(f => ({
          ...f,
          options: f.options || []
        })))
      }
    }
  }, [form])

  const addField = () => {
    setFields([...fields, { ...DEFAULT_FIELD }])
  }

  // Add default contact fields with semantic fieldIds for auto-fill
  const addContactFields = () => {
    const contactFields = [
      { fieldId: 'first_name', label: 'First Name', fieldType: 'TEXT', required: true, placeholder: 'Enter your first name', options: [] },
      { fieldId: 'last_name', label: 'Last Name', fieldType: 'TEXT', required: true, placeholder: 'Enter your last name', options: [] },
      { fieldId: 'email', label: 'Email', fieldType: 'EMAIL', required: true, placeholder: 'your.email@example.com', options: [] },
      { fieldId: 'phone', label: 'Phone Number', fieldType: 'PHONE', required: false, placeholder: '(555) 123-4567', options: [] },
    ]
    setFields(contactFields)
  }

  const removeField = (index) => {
    if (fields.length > 1) {
      setFields(fields.filter((_, i) => i !== index))
    }
  }

  const updateField = (index, key, value) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], [key]: value }
    setFields(updated)
  }

  const moveField = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === fields.length - 1)
    ) {
      return
    }
    const updated = [...fields]
    const temp = updated[index]
    updated[index] = updated[index + direction]
    updated[index + direction] = temp
    setFields(updated)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a form title')
      return
    }

    if (fields.some(f => !f.label.trim())) {
      setError('All fields must have a label')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const formData = {
        title,
        description,
        category,
        deadline: deadline || null,
        maxEntries: maxEntries ? parseInt(maxEntries) : null,
        isActive,
        allowResubmit,
        resubmitMessage: allowResubmit ? resubmitMessage : null,
        fields: fields.map(f => ({
          ...f,
          options: (f.fieldType === 'SELECT' || f.fieldType === 'MULTISELECT') && f.optionsText 
            ? f.optionsText.split('\n').filter(o => o.trim())
            : f.options
        })),
        userId: user.id
      }

      let result
      if (form?.id) {
        result = await window.electronAPI.forms.update({ formId: form.id, ...formData })
      } else {
        result = await window.electronAPI.forms.create(formData)
      }

      if (result.success) {
        // If portal sync failed, surface the error to the user before navigating away
        if (result.portalSynced === false) {
          const msg = result.portalError || 'Failed to sync form to portal'
          setPortalWarning(msg)
          // show immediate alert so it's visible even when navigating back
          alert(`Form saved locally but portal sync failed:\n${msg}`)
        }
        onSave()
      } else {
        setError(result.message || 'Failed to save form')
      }
    } catch (error) {
      setError(error.message || 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const needsOptions = (fieldType) => {
    return fieldType === 'SELECT' || fieldType === 'MULTISELECT'
  }

  return (
    <div className="form-builder">
      <div className="builder-header">
        <h2>{form ? 'Edit Form' : 'Create New Form'}</h2>
        <button className="back-button" onClick={onCancel}>← Back to Forms</button>
      </div>

      <div className="builder-section">
        <h3>Form Details</h3>
        
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Community BBQ Sign-up"
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            Choose a category for this form (defaults to your department)
          </small>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this form is for..."
            rows={3}
          />
        </div>

        <div className="builder-row">
          <div className="form-group">
            <label>Deadline (Optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Max Entries (Optional)</label>
            <input
              type="number"
              value={maxEntries}
              onChange={(e) => setMaxEntries(e.target.value)}
              placeholder="Leave empty for unlimited"
              min="1"
            />
          </div>
        </div>

        {form && (
          <div className="form-group">
            <label className="checkbox-group">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Form is active and accepting submissions
            </label>
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-group">
            <input
              type="checkbox"
              checked={allowResubmit}
              onChange={(e) => setAllowResubmit(e.target.checked)}
            />
            Allow resubmissions (for recurring programs)
          </label>
          <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            Enable this for forms that members may need to submit multiple times (e.g., monthly programs)
          </small>
        </div>

        {allowResubmit && (
          <div className="form-group">
            <label>Resubmit Message (Optional)</label>
            <input
              type="text"
              value={resubmitMessage}
              onChange={(e) => setResubmitMessage(e.target.value)}
              placeholder="e.g., Submit again for the next session"
            />
            <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
              Custom message shown to members who have already submitted
            </small>
          </div>
        )}
      </div>

      <div className="builder-section">
        <div className="fields-section-header">
          <h3>Form Fields</h3>
          <div className="fields-header-actions">
            <button 
              className="add-contact-fields-btn"
              onClick={addContactFields}
              disabled={fields.length > 1 || (fields.length === 1 && fields[0].label)}
            >
              Add Contact Fields
            </button>
            <button className="add-field-btn" onClick={addField}>
              + Add Field
            </button>
          </div>
        </div>
        
        <div className="fields-list">
          {fields.map((field, index) => (
            <div key={index} className="field-item">
              <div className="field-item-header">
                <span className="field-number">{index + 1}</span>
                <div className="field-actions">
                  <button 
                    className="field-action-btn"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button 
                    className="field-action-btn"
                    onClick={() => moveField(index, 1)}
                    disabled={index === fields.length - 1}
                  >
                    ↓
                  </button>
                  <button 
                    className="field-action-btn delete"
                    onClick={() => removeField(index)}
                    disabled={fields.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="field-inputs">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, 'label', e.target.value)}
                  placeholder="Field label *"
                />
                <select
                  value={field.fieldType}
                  onChange={(e) => updateField(index, 'fieldType', e.target.value)}
                >
                  {FIELD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                  placeholder="Placeholder text (optional)"
                />
                <label className="field-required">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, 'required', e.target.checked)}
                  />
                  Required
                </label>

                {needsOptions(field.fieldType) && (
                  <div className="field-options">
                    <input
                      type="text"
                      value={field.optionsText || (field.options || []).join('\n')}
                      onChange={(e) => updateField(index, 'optionsText', e.target.value)}
                      placeholder="Options (one per line, use Enter to separate)"
                    />
                    <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                      Separate options with commas or new lines
                    </small>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="add-field-button" onClick={addField}>
          + Add Field
        </button>
      </div>

      {error && (
        <div className="result-message error">{error}</div>
      )}

      <div className="builder-actions">
        <button className="cancel-form-button" onClick={onCancel}>
          Cancel
        </button>
        <button 
          className="save-form-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : (form ? 'Update Form' : 'Create Form')}
        </button>
      </div>
    </div>
  )
}

export default FormBuilder
