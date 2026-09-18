import { useState } from 'react'
import Button from '../ui/Button'
import './CaseForm.css'

const EMPTY_FORM = { case_number: '', title: '', investigator: '', description: '' }

export default function CaseForm({ onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.case_number.trim() || !form.title.trim()) {
      setError('Case number and title are required.')
      return
    }
    setError(null)
    onSubmit(form)
  }

  return (
    <form className="case-form" onSubmit={handleSubmit}>
      <label className="case-form__field">
        <span className="case-form__label">Case Number</span>
        <input
          className="case-form__input mono"
          placeholder="CASE-2026-0043"
          value={form.case_number}
          onChange={(e) => update('case_number', e.target.value)}
          autoFocus
        />
      </label>

      <label className="case-form__field">
        <span className="case-form__label">Title</span>
        <input
          className="case-form__input"
          placeholder="e.g. Warehouse Break-In Investigation"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </label>

      <label className="case-form__field">
        <span className="case-form__label">Investigator</span>
        <input
          className="case-form__input"
          placeholder="e.g. D. Alvarez"
          value={form.investigator}
          onChange={(e) => update('investigator', e.target.value)}
        />
      </label>

      <label className="case-form__field">
        <span className="case-form__label">Description</span>
        <textarea
          className="case-form__input case-form__textarea"
          placeholder="Brief summary of the incident and evidence source"
          rows={3}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </label>

      {error && <p className="case-form__error">{error}</p>}

      <div className="case-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          Create Case
        </Button>
      </div>
    </form>
  )
}
