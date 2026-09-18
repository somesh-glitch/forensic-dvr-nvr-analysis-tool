import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentCase } from '../context/CaseContext'
import { getEvidenceList } from '../api/apiClient'
import { Card, EmptyState } from '../components/ui'
import { ShieldCheck, FileText, ChevronRight } from 'lucide-react'

export default function CustodyIndex() {
  const { currentCase } = useCurrentCase()
  const [evidenceList, setEvidenceList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentCase) {
      setLoading(true)
      getEvidenceList(currentCase.id)
        .then((data) => {
          setEvidenceList(data)
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    }
  }, [currentCase])

  if (!currentCase) {
    return (
      <div className="flex-center" style={{ minHeight: '60vh' }}>
        <EmptyState
          icon={ShieldCheck}
          title="Case Selection Required"
          description="Please select or register an active investigation case from the Cases registry."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="workspace-header mb-6">
        <div className="eyebrow">Chain of Custody</div>
        <h1>Select Evidence File</h1>
        <p className="text-secondary">Choose an ingested evidence file in &ldquo;{currentCase.title}&rdquo; to view its immutable audit ledger.</p>
      </div>

      {loading ? (
        <Card padding="lg">Loading evidence list...</Card>
      ) : evidenceList.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No evidence ingested"
          description="Go to Case Details to ingest an evidence file first."
        />
      ) : (
        <div className="evidence-selector-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {evidenceList.map((ev) => (
            <Card key={ev.id} padding="md" className="flex-apart" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={18} className="text-secondary" />
                <div>
                  <h4 style={{ margin: 0 }}>{ev.name}</h4>
                  <span className="mono text-muted" style={{ fontSize: '11px' }}>Vendor: {ev.vendor_detected}</span>
                </div>
              </div>
              <Link to={`/custody/${ev.id}`} className="btn btn--secondary flex-center" style={{ gap: '6px' }}>
                <span>View Ledger</span>
                <ChevronRight size={14} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
