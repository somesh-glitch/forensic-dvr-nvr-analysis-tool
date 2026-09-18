import { Link } from 'react-router-dom'
import { Camera, ChevronRight } from 'lucide-react'
import './ActiveCaseBanner.css'

export default function ActiveCaseBanner({ caseRecord }) {
  if (!caseRecord) return null

  return (
    <Link to={`/cases/${caseRecord.id}`} className="active-case-banner">
      <div className="active-case-banner__glow" />
      <div className="active-case-banner__top">
        <span className="eyebrow">Active Case</span>
        <span className="active-case-banner__number mono">
          {caseRecord.case_number}
        </span>
      </div>

      <h2 className="active-case-banner__title">{caseRecord.title}</h2>

      <div className="active-case-banner__meta">
        <span>{caseRecord.vendor_detected} DVR</span>
        <span className="active-case-banner__dot">•</span>
        <span className="active-case-banner__meta-icon">
          <Camera size={13} />
          {caseRecord.camera_count} Cameras
        </span>
      </div>

      <ChevronRight size={18} className="active-case-banner__chevron" />
    </Link>
  )
}
