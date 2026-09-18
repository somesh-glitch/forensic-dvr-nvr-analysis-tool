import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen,
  FileSearch,
  Activity,
  History,
  ShieldCheck,
  Building,
  AlertTriangle,
  FolderOpen as FolderOpenIcon,
  Video,
  FileText
} from 'lucide-react'
import { getCases, getTimeline, getEvidenceList, getCaseSummary, parseApiError } from '../api/apiClient'
import { useCurrentCase } from '../context/CaseContext'
import { Card, Button, SkeletonLine } from '../components/ui'
import './Dashboard.css'

export default function Dashboard() {
  const { currentCase } = useCurrentCase()

  const [totalCases, setTotalCases] = useState(0)
  const [stats, setStats] = useState(null)
  const [recentDetections, setRecentDetections] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [vendorAggregation, setVendorAggregation] = useState({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDashboardWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch general case counts
      const casesData = await getCases()
      setTotalCases(casesData.length)

      if (currentCase) {
        // Fetch recent chronolog tracker events
        const timelineLogs = await getTimeline(currentCase.id)

        // Filter AI detections vs general audit logs
        const detections = timelineLogs.filter(evt => evt.event_type === 'AI_DETECTION').slice(0, 5)
        const audits = timelineLogs.filter(evt => evt.event_type !== 'AI_DETECTION').slice(0, 5)

        setRecentDetections(detections)
        setRecentLogs(audits)

        // Fetch dynamic summary stats
        const summary = await getCaseSummary(currentCase.id)

        // Vendor Breakdown aggregation calculated dynamically from case evidence list
        const evidenceData = await getEvidenceList(currentCase.id)
        const counts = {}
        evidenceData.forEach((ev) => {
          counts[ev.vendor_detected] = (counts[ev.vendor_detected] || 0) + 1
        })
        setVendorAggregation(counts)

        setStats({
          evidenceCount: summary.evidence_count,
          cameraCount: summary.camera_count,
          eventCount: timelineLogs.length,
          unverifiedCount: summary.unverified_count,
          integrityStatus: summary.unverified_count > 0 ? 'COMPROMISED' : 'UNCOMPROMISED'
        })
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadDashboardWorkspace()
  }, [currentCase])

  if (loading) {
    return (
      <div className="dashboard-page">
        <SkeletonLine width="200px" height={15} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="mb-8">
          {[0, 1, 2, 3].map(i => <SkeletonLine key={i} width="100%" height={80} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <SkeletonLine width="100%" height={300} />
          <SkeletonLine width="100%" height={300} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Failed to Load Dashboard Status</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="workspace-header mb-6">
        <div className="eyebrow">Active Investigation Workspace</div>
        <h1>Forensic Control Station</h1>
        <p className="text-secondary font-medium">Select a Case from Cases menu. System health indicators are monitored in real-time.</p>
      </div>

      {/* Overview Stat Cards */}
      <div className="dashboard-stats-grid mb-6">
        <Card padding="md" className="stat-card">
          <div className="stat-card__icon stat-card__icon--case">
            <FolderOpenIcon size={20} />
          </div>
          <div>
            <div className="mono stat-card__value">{totalCases}</div>
            <div className="eyebrow stat-card__lbl">Registered Cases</div>
          </div>
        </Card>

        <Card padding="md" className="stat-card">
          <div className="stat-card__icon stat-card__icon--evidence">
            <FileSearch size={20} />
          </div>
          <div>
            <div className="mono stat-card__value">{stats ? stats.evidenceCount : 0}</div>
            <div className="eyebrow stat-card__lbl">Evidence Ingested</div>
          </div>
        </Card>

        <Card padding="md" className="stat-card">
          <div className="stat-card__icon stat-card__icon--channel">
            <Video size={20} />
          </div>
          <div>
            <div className="mono stat-card__value">{stats ? stats.cameraCount : 0}</div>
            <div className="eyebrow stat-card__lbl">extracted channels</div>
          </div>
        </Card>

        <Card padding="md" className="stat-card">
          <div className="stat-card__icon stat-card__icon--event">
            <Activity size={20} />
          </div>
          <div>
            <div className="mono stat-card__value">{stats ? stats.eventCount : 0}</div>
            <div className="eyebrow stat-card__lbl">correlated events</div>
          </div>
        </Card>
      </div>

      <div className="dashboard-content-grid">

        {/* Left Column: Recent Activity Logs */}
        <div className="dashboard-main-panel">

          {/* Active Case Context Status */}
          {!currentCase ? (
            <Card padding="lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
              <div className="text-center">
                <FolderOpenIcon size={44} className="text-secondary mb-4 mx-auto" />
                <h3>No Case Selected</h3>
                <p className="text-secondary mb-4 max-w-sm">
                  To view statistics, active camera channels, or chronolog trace logs, please select an active case.
                </p>
                <Link to="/cases" className="btn btn--primary">
                  Open Cases Registry
                </Link>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Recent Audit Timeline Feed */}
              <Card padding="lg">
                <div className="flex-apart mb-4">
                  <h3 className="section-title">Audit Ledger Feed</h3>
                  <Link to={`/timeline/${currentCase.id}`} className="btn-actions-link">
                    <span>View Timeline</span>
                    <History size={13} style={{ marginLeft: '4px' }} />
                  </Link>
                </div>

                {recentLogs.length === 0 ? (
                  <p className="text-muted italic">No activity logged in this case yet.</p>
                ) : (
                  <div className="activity-feed-list">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="feed-item-row">
                        <span className="mono text-muted text-xxs block mb-1">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex-apart">
                          <p className="feed-item-desc">{log.description}</p>
                          <span className="badge badge--neutral uppercase">{log.event_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* AI Alert Warnings */}
              <Card padding="lg">
                <h3 className="section-title mb-4">AI Vision Alert Detections</h3>

                {recentDetections.length === 0 ? (
                  <p className="text-muted italic">No computer vision alert markers logged.</p>
                ) : (
                  <div className="activity-feed-list">
                    {recentDetections.map((det) => (
                      <div key={det.id} className="feed-item-row" style={{ borderLeftColor: 'var(--amber-border)' }}>
                        <span className="mono text-muted text-xxs block mb-1">
                          {new Date(det.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex-apart">
                          <p className="feed-item-desc">{det.description}</p>
                          <span className="badge badge--warning font-semibold">AI ALERT</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        {/* Right Column: Vendor Breakdown and Systems */}
        <div className="dashboard-sidebar-panel">
          {currentCase && (
            <Card padding="lg" className="mb-6">
              <h3 className="section-title mb-4">Ingestion Vendors</h3>
              {Object.keys(vendorAggregation).length === 0 ? (
                <p className="text-muted italic text-xs">No media files parsed.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(vendorAggregation).map(([vendor, count]) => (
                    <div key={vendor} className="vendor-summary-row flex-apart">
                      <div className="flex-center" style={{ gap: '8px' }}>
                        <Building size={14} className="text-secondary" />
                        <span className="mono">{vendor}</span>
                      </div>
                      <span className="badge badge--info">{count} files</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Integrity validations */}
          <Card padding="lg">
            <h3 className="section-title mb-3">System Protection Check</h3>
            <div className="protection-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="flex-center" style={{ gap: '8px' }}>
                <AlertTriangle color="var(--amber)" size={16} />
                <span className="mono text-xs text-secondary">Write-Blocking: NOT IMPLEMENTED</span>
              </div>
              <div className="flex-center" style={{ gap: '8px' }}>
                {stats?.unverifiedCount > 0 ? (
                  <>
                    <AlertTriangle color="var(--red)" size={16} />
                    <span className="mono text-xs text-red" style={{ color: 'var(--red)' }}>
                      Integrity Failures ({stats.unverifiedCount})
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck color="var(--green)" size={16} />
                    <span className="mono text-xs text-secondary">Metadata Chain Validated</span>
                  </>
                )}
              </div>
              <div className="flex-center" style={{ gap: '8px' }}>
                <ShieldCheck color="var(--green)" size={16} />
                <span className="mono text-xs text-secondary">YOLOv8 Engine: AVAILABLE</span>
              </div>
            </div>
          </Card>
        </div>


      </div>
    </div>
  )
}
