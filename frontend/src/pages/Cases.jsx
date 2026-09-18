import { useEffect, useMemo, useState } from 'react'
import { useNavigate as useAppNavigate } from 'react-router-dom'
import { Search, ChevronDown, Plus, FolderSearch, CheckCircle2, AlertOctagon } from 'lucide-react'
import { Button, Card, Modal, EmptyState, SkeletonLine } from '../components/ui'
import CaseCard from '../components/cases/CaseCard'
import CaseForm from '../components/cases/CaseForm'
import { getCases, createCase, parseApiError } from '../api/apiClient'
import { useCurrentCase } from '../context/CaseContext'
import './Cases.css'

export default function Cases() {
  const navigate = useAppNavigate()
  const { setCurrentCase } = useCurrentCase()

  const [cases, setCases] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [justCreated, setJustCreated] = useState(null)
  const [errorStatus, setErrorStatus] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorStatus(null)

    getCases()
      .then((result) => {
        if (!cancelled) {
          setCases(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorStatus(parseApiError(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCases = useMemo(() => {
    if (!cases) return []
    const query = search.trim().toLowerCase()
    return cases.filter((c) => {
      const matchesQuery =
        !query ||
        c.case_number.toLowerCase().includes(query) ||
        c.title.toLowerCase().includes(query) ||
        c.investigator.toLowerCase().includes(query)
      return matchesQuery
    })
  }, [cases, search])

  async function handleCreateCase(formValues) {
    setSubmitting(true)
    setErrorStatus(null)
    try {
      const newCase = await createCase(formValues)
      setCases((prev) => [newCase, ...(prev || [])])
      setCurrentCase(newCase)
      setModalOpen(false)
      setJustCreated(newCase)
      setTimeout(() => {
        navigate(`/cases/${newCase.id}`)
      }, 950)
    } catch (err) {
      setErrorStatus(parseApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cases-page">
      <div className="cases-page__header">
        <div>
          <h1>Cases</h1>
          <p className="text-secondary font-medium">All forensic cases across every DVR/NVR vendor.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModalOpen(true)}>
          Create New Case
        </Button>
      </div>

      {justCreated && (
        <div className="cases-page__toast">
          <CheckCircle2 size={15} />
          <span>
            Case <span className="mono">{justCreated.case_number}</span> created — opening case file…
          </span>
        </div>
      )}

      {errorStatus && (
        <div className="cases-page__toast" style={{ backgroundColor: 'var(--red-dim)', borderColor: 'var(--red-border)' }}>
          <AlertOctagon size={15} color="var(--red)" />
          <span>
            {errorStatus.message} {errorStatus.detail ? `(${errorStatus.detail})` : ''}
          </span>
        </div>
      )}

      <div className="cases-page__toolbar">
        <div className="cases-page__search">
          <Search size={15} />
          <input
            placeholder="Search cases by number, title, or investigator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="cases-page__list">
        {loading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} padding="lg">
              <SkeletonLine width="140px" height={12} className="cases-page__skel-line" />
              <SkeletonLine width="60%" height={20} className="cases-page__skel-line" />
              <SkeletonLine width="40%" height={12} />
            </Card>
          ))
        ) : filteredCases.length === 0 ? (
          <EmptyState
            icon={FolderSearch}
            title="No cases match your search"
            description="Try a different case number, title, or investigator — or create a new case."
          />
        ) : (
          filteredCases.map((c) => <CaseCard key={c.id} caseRecord={c} />)
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        eyebrow="New Forensic Case"
        title="Create Case"
      >
        <CaseForm
          onSubmit={handleCreateCase}
          onCancel={() => setModalOpen(false)}
          submitting={submitting}
        />
      </Modal>
    </div>
  )
}
