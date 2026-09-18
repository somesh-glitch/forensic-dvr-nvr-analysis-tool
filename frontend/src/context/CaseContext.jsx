import { createContext, useContext, useState, useCallback } from 'react'

const CaseContext = createContext(null)

/**
 * Tracks the "current case" the investigator is working in, so the
 * top bar can show it regardless of which page is active.
 * Synchronizes with localStorage to maintain state across reloads.
 */
export function CaseProvider({ children }) {
  const [currentCase, setCurrentCaseState] = useState(() => {
    try {
      const stored = localStorage.getItem('active_case')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const setCurrentCase = useCallback((caseRecord) => {
    setCurrentCaseState(caseRecord)
    if (caseRecord) {
      localStorage.setItem('active_case', JSON.stringify(caseRecord))
      localStorage.setItem('active_case_id', caseRecord.id)
      localStorage.setItem('active_case_number', caseRecord.case_number)
      localStorage.setItem('active_case_title', caseRecord.title)
      localStorage.setItem('active_case_investigator', caseRecord.investigator)
    } else {
      localStorage.removeItem('active_case')
      localStorage.removeItem('active_case_id')
      localStorage.removeItem('active_case_number')
      localStorage.removeItem('active_case_title')
      localStorage.removeItem('active_case_investigator')
    }
  }, [])

  const clearCurrentCase = useCallback(() => {
    setCurrentCaseState(null)
    localStorage.removeItem('active_case')
    localStorage.removeItem('active_case_id')
    localStorage.removeItem('active_case_number')
    localStorage.removeItem('active_case_title')
    localStorage.removeItem('active_case_investigator')
  }, [])

  return (
    <CaseContext.Provider value={{ currentCase, setCurrentCase, clearCurrentCase }}>
      {children}
    </CaseContext.Provider>
  )
}

export function useCurrentCase() {
  const ctx = useContext(CaseContext)
  if (!ctx) {
    throw new Error('useCurrentCase must be used within a CaseProvider')
  }
  return ctx
}
