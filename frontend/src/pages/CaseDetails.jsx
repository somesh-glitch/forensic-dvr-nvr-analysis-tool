import { useEffect, useState, useRef } from 'react'
import { useParams as useAppParams, Link } from 'react-router-dom'
import { Folder, User, Calendar, FileText, Upload, Copy, Check, Video, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getCase, getEvidenceList, uploadEvidence, getCaseStats, parseApiError } from '../api/apiClient'
import { Card, Button, SkeletonLine, EmptyState } from '../components/ui'
import { useCurrentCase } from '../context/CaseContext'
import './CaseDetails.css'

export default function CaseDetails() {
  const { caseId } = useAppParams()
  const { setCurrentCase } = useCurrentCase()

  const [caseRecord, setCaseRecord] = useState(null)
  const [evidenceList, setEvidenceList] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Upload state variables
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Copy status dictionary
  const [copiedText, setCopiedText] = useState({})

  const fetchCaseWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)

      // Direct O(1) backend lookup — no need to fetch all cases
      const found = await getCase(caseId)
      setCaseRecord(found)
      setCurrentCase(found) // Sync top bar

      // Fetch evidence list
      const evList = await getEvidenceList(caseId)
      setEvidenceList(evList)

      // Fetch stats from the real backend stats endpoint
      try {
        const statsData = await getCaseStats(caseId)
        setStats({
          evidenceCount: statsData.evidenceCount ?? statsData.evidence_count ?? evList.length,
          cameraCount: statsData.cameraCount ?? statsData.camera_count ?? 0,
          eventCount: statsData.eventCount ?? statsData.event_count ?? 0,
          integrityStatus: statsData.integrityStatus ?? (statsData.unverifiedCount > 0 ? 'COMPROMISED' : 'UNCOMPROMISED')
        })
      } catch (statsErr) {
        console.warn('Stats endpoint unavailable, falling back to evidence count', statsErr)
        setStats({ evidenceCount: evList.length, cameraCount: 0, eventCount: 0, integrityStatus: 'UNCOMPROMISED' })
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    fetchCaseWorkspace()
  }, [caseId])

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedText((prev) => ({ ...prev, [key]: false }))
      }, 1500)
    })
  }

  // Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
      setUploadError(null)
      setUploadSuccess(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0])
      setUploadError(null)
      setUploadSuccess(null)
    }
  }

  const triggerUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setUploadError(null)
    setUploadSuccess(null)
    setUploadProgress(15) // Indication of upload start

    try {
      setUploadProgress(45)
      const response = await uploadEvidence(caseId, selectedFile)
      setUploadProgress(90)
      setUploadSuccess(response)
      setSelectedFile(null)

      // Auto refresh case workspace data
      const evList = await getEvidenceList(caseId)
      setEvidenceList(evList)
      // Refresh stats after upload
      try {
        const statsData = await getCaseStats(caseId)
        setStats({
          evidenceCount: statsData.evidenceCount ?? statsData.evidence_count ?? evList.length,
          cameraCount: statsData.cameraCount ?? statsData.camera_count ?? 0,
          eventCount: statsData.eventCount ?? statsData.event_count ?? 0,
          integrityStatus: statsData.integrityStatus ?? (statsData.unverifiedCount > 0 ? 'COMPROMISED' : 'UNCOMPROMISED')
        })
      } catch (statsErr) {
        setStats({ evidenceCount: evList.length, cameraCount: 0, eventCount: 0, integrityStatus: 'UNCOMPROMISED' })
      }

      setUploadProgress(100)
      setTimeout(() => {
        setUploadSuccess(null)
        setUploadProgress(0)
      }, 3000)
    } catch (err) {
      setUploadError(parseApiError(err))
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="case-details-page">
        <SkeletonLine width="180px" height={14} className="mb-4" />
        <SkeletonLine width="40%" height={32} className="mb-8" />
        <div className="case-details-grid">
          <Card padding="lg" className="case-overview-card">
            <SkeletonLine width="100%" height={150} />
          </Card>
          <Card padding="lg">
            <SkeletonLine width="100%" height={150} />
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="case-details-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <div className="flex-center" style={{ gap: '12px' }}>
            <AlertTriangle size={24} color="var(--red)" />
            <div>
              <h3>Workspace Initialization Failed</h3>
              <p className="text-secondary">{error.message} {error.detail ? `(${error.detail})` : ''}</p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="case-details-page">
      <div className="case-header">
        <div className="eyebrow case-header__eyebrow">Case File</div>
        <h1>{caseRecord.title}</h1>
        <div className="case-meta">
          <div className="case-meta__item">
            <Folder size={14} />
            <span className="mono">{caseRecord.case_number}</span>
          </div>
          <div className="case-meta__item">
            <User size={14} />
            <span>{caseRecord.investigator}</span>
          </div>
          <div className="case-meta__item">
            <Calendar size={14} />
            <span>{new Date(caseRecord.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="case-details-grid">
        {/* Left Column: Stats & Description */}
        <div className="case-details-main">
          <Card padding="lg" className="mb-6">
            <h3 className="section-title">Investigation Details</h3>
            <p className="case-description">{caseRecord.description || 'No investigator description provided.'}</p>

            {stats && (
              <div className="case-stats-row">
                <div className="case-stat-box">
                  <span className="case-stat-value">{stats.evidenceCount}</span>
                  <span className="case-stat-label">Evidence Files</span>
                </div>
                <div className="case-stat-box">
                  <span className="case-stat-value">{stats.cameraCount}</span>
                  <span className="case-stat-label">Visual Channels</span>
                </div>
                <div className="case-stat-box">
                  <span className="case-stat-value">{stats.eventCount}</span>
                  <span className="case-stat-label">Forensic Events</span>
                </div>
                <div className="case-stat-box">
                  <span className={`case-stat-value text-${stats.integrityStatus === 'UNCOMPROMISED' ? 'green' : 'amber'}`}>
                    {stats.integrityStatus === 'UNCOMPROMISED' ? 'SECURE' : 'WARNING'}
                  </span>
                  <span className="case-stat-label">Integrity Status</span>
                </div>
              </div>
            )}
          </Card>

          {/* Evidence List */}
          <Card padding="lg">
            <h3 className="section-title">Ingested Evidence</h3>
            {evidenceList.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No evidence ingested"
                description="Upload raw surveillance files or disk image dumps in the sidebar panel to begin parsing."
              />
            ) : (
              <div className="evidence-table-wrapper">
                <table className="evidence-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Vendor / Serial</th>
                      <th>Size</th>
                      <th>Integrity Hashing (SHA-256)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceList.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <div className="evidence-file-cell">
                            <FileText size={16} className="text-secondary" />
                            <span className="evidence-file-name">{ev.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="vendor-badge-cell">
                            <span className="badge badge--info">{ev.vendor_detected}</span>
                            {ev.device_serial && <span className="mono serial-no">S/N: {ev.device_serial}</span>}
                          </div>
                        </td>
                        <td>
                          <span className="mono">{formatBytes(ev.file_size)}</span>
                        </td>
                        <td>
                          <div className="hash-copy-wrapper">
                            <span className="mono hash-text" title={ev.sha256}>
                              {ev.sha256.substring(0, 16)}...
                            </span>
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              onClick={() => copyToClipboard(ev.sha256, ev.id)}
                              title="Copy SHA-256"
                            >
                              {copiedText[ev.id] ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <Link to={`/evidence/${ev.id}`} className="btn-actions-link">
                            <span>Open Details</span>
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Upload Panel */}
        <div className="case-details-sidebar">
          <Card padding="lg">
            <h3 className="section-title">Evidence Ingestion</h3>
            <p className="text-secondary mb-4" style={{ fontSize: 'var(--text-sm)' }}>
              Add a new media or forensic image file.
            </p>

            <div
              className={`upload-zone ${isDragOver ? 'upload-zone--dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <Upload size={32} className="upload-zone__icon" />
              {selectedFile ? (
                <div style={{ textAlign: 'center' }}>
                  <p className="upload-zone__filename">{selectedFile.name}</p>
                  <p className="upload-zone__filesize mono">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p>Drag file here or click to browse</p>
                  <p className="upload-zone__helper text-muted">Supports MP4, AVI, or RAW disk formats</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="upload-actions">
                <Button variant="ghost" onClick={() => setSelectedFile(null)} disabled={isUploading}>
                  Clear
                </Button>
                <Button variant="primary" onClick={triggerUpload} loading={isUploading}>
                  Process Ingestion
                </Button>
              </div>
            )}

            {isUploading && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="progress-status">
                  <span>Uploading & Hashing...</span>
                  <span className="mono">{uploadProgress}%</span>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="alert alert--error mt-4">
                <AlertTriangle size={14} />
                <span>{uploadError.message}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="alert alert--success mt-4">
                <ShieldCheck size={14} />
                <span>Evidence ingested successfully, parsing sectors...</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
