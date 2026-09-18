import { useEffect, useState } from 'react'
import { useParams as useAppParams, Link } from 'react-router-dom'
import { History, Search, Calendar, Video, FileText, Cpu, AlertTriangle, Eye, Shield } from 'lucide-react'
import { getTimeline, getEvidenceList, getVideosForEvidence, parseApiError } from '../api/apiClient'
import { Card, Button, SkeletonLine } from '../components/ui'
import './Timeline.css'

const CATEGORY_TONE = {
  INGESTION: 'info',
  AI_DETECTION: 'warning',
  AUDIT: 'success',
  RECOVERY: 'neutral',
  AI_ANALYSIS_FAILED: 'danger'
}

export default function Timeline() {
  const { caseId } = useAppParams()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [eventType, setEventType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [cameraFilter, setCameraFilter] = useState('ALL')
  const [availableChannels, setAvailableChannels] = useState([])

  // Load timeline and metadata sources
  const loadTimelineWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch matching event list (passing ALL filters to API is done or client side filtering to make it dynamic!)
      // Since client side filtering allows instant typing-search responsiveness, let's load all and filter dynamically!
      const timelineData = await getTimeline(caseId)
      setEvents(timelineData)

      // Fetch evidence list to discover video channels to filter by
      const evidenceData = await getEvidenceList(caseId)
      const allVideos = []
      for (const ev of evidenceData) {
        try {
          const vids = await getVideosForEvidence(ev.id)
          allVideos.push(...vids)
        } catch (e) {
          console.warn(e)
        }
      }
      setAvailableChannels(allVideos)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTimelineWorkspace()
  }, [caseId])

  // Filter computation client-side
  const filteredEvents = events.filter((evt) => {
    // Category check
    if (eventType !== 'ALL' && evt.event_type !== eventType) {
      return false
    }

    // Camera channel check
    if (cameraFilter !== 'ALL') {
      // In the database model, the event 'source' or 'description' mentions the channel or camera.
      // Search is more reliable. Or if event has camera_id or video_id.
      const descLower = evt.description.toLowerCase()
      const matchesChannel = descLower.includes(`channel ${cameraFilter}`) || descLower.includes(`ch-0${cameraFilter}`)
      if (!matchesChannel) return false
    }

    // Text search
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      const matchesText =
        evt.description.toLowerCase().includes(query) ||
        evt.event_type.toLowerCase().includes(query) ||
        evt.source.toLowerCase().includes(query)
      if (!matchesText) return false
    }

    return true
  })

  // Links context actions based on logs properties
  const renderActionLink = (evt) => {
    const descLower = evt.description.toLowerCase()

    // Check if channel extraction or video reference exists
    if (evt.event_type === 'INGESTION' && descLower.includes('extracted')) {
      return (
        <Link to="/cases" className="timeline-item__action font-semibold text-cyan">
          <span>View Ingestion Folder</span>
          <Eye size={12} style={{ marginLeft: '4px' }} />
        </Link>
      )
    }

    if (evt.event_type === 'AI_DETECTION') {
      return (
        <Link to="/analysis" className="timeline-item__action font-semibold text-cyan">
          <span>Open Analysis Player</span>
          <Video size={12} style={{ marginLeft: '4px' }} />
        </Link>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="timeline-page">
        <SkeletonLine width="200px" height={12} className="mb-4" />
        <SkeletonLine width="100%" height={250} className="mb-6" />
        <SkeletonLine width="100%" height={250} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="timeline-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Failed to Load Case Timeline</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="timeline-page">
      <div className="workspace-header mb-6">
        <div className="eyebrow">Temporal Correlation Ledger</div>
        <h1>Unified Forensic Timeline</h1>
        <p className="text-secondary">Chronological trace of ingestions, user commands, carving fragments, and computer vision alerts.</p>
      </div>

      <div className="timeline-layout">
        {/* Filter bar */}
        <Card padding="md" className="timeline-filter-card mb-6">
          <div className="filter-controls-row">

            {/* Event Category select */}
            <div className="filter-group">
              <label className="eyebrow block mb-1">Event Category</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="filter-select">
                <option value="ALL">All Categories</option>
                <option value="INGESTION">Ingestions & Carves</option>
                <option value="AI_DETECTION">AI Detections</option>
                <option value="AUDIT">User Audit Events</option>
                <option value="RECOVERY">Recoveries</option>
              </select>
            </div>

            {/* Video channels select */}
            <div className="filter-group">
              <label className="eyebrow block mb-1">Filter by Channel</label>
              <select value={cameraFilter} onChange={(e) => setCameraFilter(e.target.value)} className="filter-select">
                <option value="ALL">All Channels</option>
                {Array.from(new Set(availableChannels.map(v => v.camera_id))).map((camId, i) => (
                  <option key={camId} value={i + 1}>
                    Channel {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Search query */}
            <div className="filter-group filter-group--expand">
              <label className="eyebrow block mb-1">Search Keywords</label>
              <div className="search-input-wrapper">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter timeline by description keywords or labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

          </div>
        </Card>

        {/* Timeline list */}
        {filteredEvents.length === 0 ? (
          <Card padding="lg" style={{ textAlign: 'center' }}>
            <p className="text-muted italic">No timeline events located matching active filters.</p>
          </Card>
        ) : (
          <div className="timeline-container">
            {filteredEvents.map((evt) => {
              const tone = CATEGORY_TONE[evt.event_type] || 'neutral'
              const dateObj = new Date(evt.timestamp)
              const formattedTime = dateObj.toLocaleTimeString()
              const formattedDate = dateObj.toLocaleDateString()

              return (
                <div key={evt.id} className={`timeline-item timeline-item--${evt.event_type.toLowerCase()}`}>
                  <div className="timeline-item__connector" />

                  {/* Left Column: Date and Time */}
                  <div className="timeline-item__time-col">
                    <span className="mono timeline-time">{formattedTime}</span>
                    <span className="mono timeline-date">{formattedDate}</span>
                  </div>

                  {/* Middle Column: Event Icon node */}
                  <div className={`timeline-item__icon-node timeline-item__icon-node--${tone}`}>
                    {evt.event_type === 'INGESTION' && <FileText size={13} />}
                    {evt.event_type === 'AI_DETECTION' && <Cpu size={13} />}
                    {evt.event_type === 'AUDIT' && <Shield size={13} />}
                    {evt.event_type === 'RECOVERY' && <History size={13} />}
                    {evt.event_type === 'AI_ANALYSIS_FAILED' && <AlertTriangle size={13} />}
                  </div>

                  {/* Right Column: Content Card */}
                  <Card padding="md" className="timeline-item__content-card">
                    <div className="flex-apart mb-2">
                      <span className={`badge badge--${tone} font-semibold`} style={{ letterSpacing: '0.05em' }}>
                        {evt.event_type}
                      </span>
                      <span className="mono text-muted text-xxs">ID: {evt.id.substring(0, 8)}</span>
                    </div>

                    <p className="timeline-item__desc">{evt.description}</p>

                    <div className="flex-apart mt-3 pt-2 border-t border-subtle">
                      <span className="mono text-muted text-xxs">Source: {evt.source}</span>
                      {renderActionLink(evt)}
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
