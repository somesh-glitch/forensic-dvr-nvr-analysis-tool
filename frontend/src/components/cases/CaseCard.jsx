import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Video } from 'lucide-react'
import Badge from '../ui/Badge'
import { getEvidenceList } from '../../api/apiClient'
import './CaseCard.css'

const STATUS_TONE = {
  ACTIVE: 'info',
  CLOSED: 'neutral',
}

export default function CaseCard({ caseRecord }) {
  const [evidenceCount, setEvidenceCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    getEvidenceList(caseRecord.id)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setEvidenceCount(data.length)
        }
      })
      .catch((err) => {
        console.error('Failed to get evidence count for case', caseRecord.id, err)
      })
    return () => {
      cancelled = true
    }
  }, [caseRecord.id])

  // All cases are active by default in the backend
  const isActive = true

  return (
    <Link to={`/cases/${caseRecord.id}`} className="case-card">
      <div className="case-card__main">
        <div className="case-card__top">
          <span className="case-card__number mono">{caseRecord.case_number}</span>
          <Badge tone={STATUS_TONE['ACTIVE']}>
            ACTIVE
          </Badge>
        </div>

        <h3 className="case-card__title">{caseRecord.title}</h3>

        <div className="case-card__meta">
          <span>Lead: {caseRecord.investigator}</span>
          <span className="case-card__meta-icon">
            <Video size={13} />
            {evidenceCount} Evidence Files
          </span>
        </div>
      </div>

      <div className="case-card__action">
        <span>Open</span>
        <ArrowRight size={15} />
      </div>
    </Link>
  )
}
