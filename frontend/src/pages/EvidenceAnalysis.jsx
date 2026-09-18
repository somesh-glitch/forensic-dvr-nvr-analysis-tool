import { useEffect, useState } from 'react'
import { useParams as useAppParams, Link } from 'react-router-dom'
import { ArrowLeft, Shield, Cpu, Calendar, Database, Eye, Film, Layers, Copy, Check, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react'
import { getEvidence, getVideosForEvidence, getChainOfCustody, getRecoveryFragments, parseApiError, getEvidenceDevice, verifyEvidence, apiClient } from '../api/apiClient'
import { Card, Button, SkeletonLine, EmptyState } from '../components/ui'
import './EvidenceAnalysis.css'

export default function EvidenceAnalysis() {
  const { evidenceId } = useAppParams()

  const [evidence, setEvidence] = useState(null)
  const [videos, setVideos] = useState([])
  const [recoveredFiles, setRecoveredFiles] = useState([])
  const [custodyLogs, setCustodyLogs] = useState([])
  const [deviceSpecs, setDeviceSpecs] = useState(null)
  const [integrityState, setIntegrityState] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [copiedText, setCopiedText] = useState({})

  const fetchEvidenceDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch evidence metadata
      const evData = await getEvidence(evidenceId)
      setEvidence(evData)

      // Fetch video channels list
      const videoData = await getVideosForEvidence(evidenceId)
      setVideos(videoData)

      // Fetch device/vendor support characteristics
      try {
        const specs = await getEvidenceDevice(evidenceId)
        setDeviceSpecs(specs)
      } catch (e) {
        console.warn('Failed to load device support parameters', e)
        setDeviceSpecs(null)
      }

      // Fetch current verification/integrity details
      try {
        const integrityData = await apiClient.get(`/evidence/${evidenceId}/integrity`).then(r => r.data)
        setIntegrityState(integrityData)
      } catch (e) {
        console.warn('Failed to load cryptographic integrity state', e)
        setIntegrityState(null)
      }

      // Fetch recovered carved fragments (unallocated space scans)
      try {
        const recoveryData = await getRecoveryFragments(evidenceId)
        setRecoveredFiles(recoveryData)
      } catch (e) {
        console.warn('Failed to load sector carve data, falling back to empty', e)
        setRecoveredFiles([])
      }

      // Fetch custody log ledger
      const custodyData = await getChainOfCustody(evidenceId)
      setCustodyLogs(custodyData)

    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyIntegrity = async () => {
    try {
      setVerifying(true)
      const res = await verifyEvidence(evidenceId)
      setIntegrityState(res)
      // Refresh custody logs log feed
      const custodyData = await getChainOfCustody(evidenceId)
      setCustodyLogs(custodyData)
    } catch (err) {
      alert('Verification calculation failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    fetchEvidenceDetails()
  }, [evidenceId])

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopiedText((prev) => ({ ...prev, [key]: false }))
      }, 1500)
    })
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  if (loading) {
    return (
      <div className="evidence-analysis-page">
        <SkeletonLine width="120px" height={12} className="mb-4" />
        <SkeletonLine width="30%" height={28} className="mb-8" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <SkeletonLine width="100%" height={300} />
          <SkeletonLine width="100%" height={300} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="evidence-analysis-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Failed to Load Ingestion Record</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  // Detect whether vendor was genuinely identified via binary signature vs. generic
  const isProprietaryVendor = evidence.vendor_detected && evidence.vendor_detected !== 'Not detected' && evidence.vendor_detected !== 'Generic'

  return (
    <div className="evidence-analysis-page">
      <div className="back-link-row">
        <Link to={`/cases/${evidence.case_id}`} className="back-link">
          <ArrowLeft size={14} />
          <span>Back to Case Overview</span>
        </Link>
      </div>

      <div className="evidence-header-panel">
        <div>
          <div className="eyebrow">Forensic Ingestion File</div>
          <h1>{evidence.name}</h1>
        </div>
        <div className="badge-fidelity-row">
          <span className={`badge badge--${isProprietaryVendor ? 'green' : 'neutral'}`}>
            {isProprietaryVendor ? 'PROPRIETARY DVR' : 'STANDARD VIDEO'}
          </span>
        </div>
      </div>

      <div className="evidence-grid">
        {/* Left Column: Metadata details & recovery files */}
        <div className="evidence-main-col">

          {/* Metadata Cards */}
          <div className="details-cards-row">
            <Card padding="md" className="details-card-item">
              <div className="details-card-header">
                <Shield size={16} className="text-secondary" />
                <span className="eyebrow">Cryptographic Integrity</span>
              </div>
              <div className="details-card-body">
                {integrityState && (
                  <div className={`integrity-status-alert mb-3 p-2 rounded flex items-center gap-2`} style={{
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderColor: integrityState.verified ? 'var(--green-border)' : 'var(--red-border)',
                    backgroundColor: integrityState.verified ? 'rgba(74, 222, 128, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: integrityState.verified ? 'var(--green)' : 'var(--red)'
                  }}>
                    {integrityState.verified ? <CheckCircle size={13} color="var(--green)" /> : <AlertTriangle size={13} color="var(--red)" />}
                    <span className="font-semibold">{integrityState.message}</span>
                  </div>
                )}
                <div className="hash-row">
                  <span className="hash-lbl mono">MD5:</span>
                  <span className={`hash-val mono ${integrityState && !integrityState.verified ? 'text-red' : ''}`}>
                    {evidence.md5}
                  </span>
                  <button type="button" className="btn-icon-subtle" onClick={() => copyToClipboard(evidence.md5, 'md5')}>
                    {copiedText['md5'] ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="hash-row mt-2">
                  <span className="hash-lbl mono">SHA-256:</span>
                  <span className={`hash-val mono ${integrityState && !integrityState.verified ? 'text-red' : ''}`}>
                    {evidence.sha256}
                  </span>
                  <button type="button" className="btn-icon-subtle" onClick={() => copyToClipboard(evidence.sha256, 'sha256')}>
                    {copiedText['sha256'] ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
                  </button>
                </div>

                <Button
                  size="sm"
                  onClick={handleVerifyIntegrity}
                  disabled={verifying}
                  style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                >
                  <RefreshCw size={12} style={{ marginRight: '6px' }} className={verifying ? 'animate-spin' : ''} />
                  <span>{verifying ? 'Calculating...' : 'Verify Cryptographic Integrity'}</span>
                </Button>
              </div>
            </Card>

            <Card padding="md" className="details-card-item">
              <div className="details-card-header">
                <Cpu size={16} className="text-secondary" />
                <span className="eyebrow">Device Characteristics</span>
              </div>
              <div className="details-card-body">
                <p className="device-spec">
                  <span className="text-secondary">Vendor:</span> <strong className="mono">{evidence.vendor_detected}</strong>
                </p>
                <p className="device-spec">
                  <span className="text-secondary">Source Type:</span>{' '}
                  <span className="badge badge--neutral uppercase" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    {evidence.source_type || 'STANDARD_VIDEO'}
                  </span>
                </p>
                <p className="device-spec">
                  <span className="text-secondary">Detection Method:</span>{' '}
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {evidence.detection_method || 'NO_PROPRIETARY_SIGNATURE'}
                  </span>
                </p>
                {evidence.detection_confidence > 0 && (
                  <p className="device-spec">
                    <span className="text-secondary">Detection Confidence:</span>{' '}
                    <strong className="mono">{(evidence.detection_confidence * 100).toFixed(0)}%</strong>
                  </p>
                )}
                {deviceSpecs && deviceSpecs.support_level && (
                  <p className="device-spec">
                    <span className="text-secondary">Support Level:</span>{' '}
                    <span className="badge badge--neutral uppercase" style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {deviceSpecs.support_level}
                    </span>
                  </p>
                )}
                <p className="device-spec">
                  <span className="text-secondary">Serial No:</span> <strong className="mono">{evidence.device_serial || 'Not detected'}</strong>
                </p>
                <p className="device-spec">
                  <span className="text-secondary">File Size:</span> <strong className="mono">{formatBytes(evidence.file_size)}</strong>
                </p>
              </div>
            </Card>
          </div>

          {/* Extracted Camera Channels */}
          <Card padding="lg" className="mb-6">
            <div className="flex-apart mb-4">
              <h3 className="section-title">Extracted Visual Channels</h3>
              <span className="text-muted mono" style={{ fontSize: 'var(--text-sm)' }}>
                {videos.length} video streams located
              </span>
            </div>
            {videos.length === 0 ? (
              <EmptyState
                icon={Film}
                title="No video channels extracted"
                description="The custom sector check was unable to discover index metadata or video partitions in this binary file."
              />
            ) : (
              <div className="channels-grid">
                {videos.map((vid, idx) => (
                  <Card key={vid.id} padding="md" className="channel-box-card">
                    <div className="channel-box-header">
                      <Film size={15} className="text-secondary" />
                      <span className="mono channel-badge">CH-{String(idx + 1).padStart(2, '0')}</span>
                    </div>

                    <div className="channel-box-specs">
                      <p className="mono font-semibold" style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                        Resolution: {vid.resolution || 'MPEG Stream'}
                      </p>
                      <p className="mono text-secondary" style={{ fontSize: '11.5px' }}>
                        Duration: {vid.duration_seconds ? `${Math.round(vid.duration_seconds)}s` : 'Unknown'} | FPS: {vid.fps || 'N/A'}
                      </p>
                      <p className="mono text-muted" style={{ fontSize: '11px', marginTop: '6px' }}>
                        Start: {new Date(vid.start_time).toLocaleString()}
                      </p>
                    </div>

                    <div className="channel-box-action mt-4">
                      <Link to={`/videos/${vid.id}`} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                        <Eye size={13} style={{ marginRight: '6px' }} />
                        <span>Navigate to Analyze</span>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Sector Carver Recovery */}
          <Card padding="lg">
            <div className="flex-apart mb-4">
              <h3 className="section-title">Sector Carver Report (Deleted Files)</h3>
              <span className={`badge badge--${isProprietaryVendor ? 'green' : 'neutral'}`}>
                {isProprietaryVendor ? 'REAL CARVER' : 'SIGNATURE SCAN'}
              </span>
            </div>
            {recoveredFiles.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No carved file fragments found"
                description="Scanning unallocated sectors yielded no carve headers or signature remnants."
              />
            ) : (
              <div className="carver-table-wrapper">
                <table className="evidence-table">
                  <thead>
                    <tr>
                      <th>Sector Range</th>
                      <th>Size</th>
                      <th>Format</th>
                      <th>Fragment ID</th>
                      <th>Estimated Time</th>
                      <th>Structure Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveredFiles.map((frag, idx) => (
                      <tr key={idx}>
                        <td className="mono">{frag.start_sector} - {frag.end_sector}</td>
                        <td className="mono">{formatBytes(frag.size_bytes)}</td>
                        <td>
                          <span className="badge badge--neutral">{frag.file_extension}</span>
                        </td>
                        <td className="mono" style={{ fontSize: '11px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={frag.id}>
                          {frag.id ? frag.id.substring(0, 12) + '…' : 'N/A'}
                        </td>
                        <td className="mono">
                          {frag.estimated_time ? new Date(frag.estimated_time).toUTCString() : 'Unknown'}
                        </td>
                        <td>
                          <span className={`badge badge--${frag.status === 'Recovered' ? 'green' : 'amber'}`}>
                            {frag.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Custody Ledger snapshot */}
        <div className="evidence-sidebar-col">
          <Card padding="lg" className="custody-history-card">
            <h3 className="section-title">Audit Ledger Snapshot</h3>
            <p className="text-secondary mb-4" style={{ fontSize: 'var(--text-sm)' }}>
              Acquisition and parsing checkpoints.
            </p>
            {custodyLogs.length === 0 ? (
              <p className="text-muted italic mono text-xs">No ledger markers logged.</p>
            ) : (
              <div className="custody-mini-timeline">
                {custodyLogs.map((log) => (
                  <div key={log.id} className="custody-mini-node">
                    <div className="custody-mini-meta">
                      <span className="mono custody-mini-action">{log.action}</span>
                      <span className="mono custody-mini-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="custody-mini-desc">{log.description}</p>
                    <span className="mono custody-mini-operator">Operator: {log.operator}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-subtle">
              <Link to={`/custody/${evidenceId}`} className="btn btn--secondary" style={{ width: '100%', justifyContent: 'center' }}>
                View Immutable Ledger
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
