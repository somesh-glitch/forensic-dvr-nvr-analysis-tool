import { useEffect, useState } from 'react'
import { useParams as useParamsHook, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Clock, User, Compass, CheckCircle2, Lock, FileText, Info } from 'lucide-react'
import { getChainOfCustody, getEvidence, parseApiError } from '../api/apiClient'
import { Card, SkeletonLine } from '../components/ui'
import './ChainOfCustody.css'

export default function ChainOfCustody() {
  const { evidenceId } = useParamsHook()

  const [logs, setLogs] = useState([])
  const [evidence, setEvidence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadCustodyLedger = async () => {
    try {
      setLoading(true)
      setError(null)

      const custodyData = await getChainOfCustody(evidenceId)
      setLogs(custodyData)

      const evData = await getEvidence(evidenceId)
      setEvidence(evData)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustodyLedger()
  }, [evidenceId])

  if (loading) {
    return (
      <div className="custody-page">
        <SkeletonLine width="150px" height={12} className="mb-4" />
        <SkeletonLine width="100%" height={300} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="custody-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Failed to Load Chain of Custody</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="custody-page">
      <div className="back-link-row">
        <Link to={`/evidence/${evidenceId}`} className="back-link">
          <ArrowLeft size={14} />
          <span>Back to Ingestion Record</span>
        </Link>
      </div>

      <div className="workspace-header mb-6">
        <div className="eyebrow flex-center" style={{ gap: '6px', color: 'var(--green)' }}>
          <span>AUDIT LEDGER</span>
        </div>
        <h1>Chain of Custody Ledger</h1>
        <p className="text-secondary">Immutable history logs verifying the transfer, hashing, and parsing checks of evidence asset.</p>
      </div>

      <div className="custody-grid">
        {/* Left Column: Log timeline */}
        <div className="custody-ledger-col">
          <Card padding="lg">
            <h3 className="section-title mb-6">Cryptographic Audit Trail</h3>

            {logs.length === 0 ? (
              <p className="text-muted italic">No custody transfer ledger items exist.</p>
            ) : (
              <div className="custody-timeline">
                {logs.map((log, index) => {
                  const dateObj = new Date(log.timestamp)
                  return (
                    <div key={log.id} className="custody-node">
                      <div className="custody-node__connector" />

                      <div className="custody-node__icon">
                        <Lock size={12} />
                      </div>

                      <div className="custody-node__content">
                        <div className="custody-node__header">
                          <span className="mono custody-node__action">{log.action}</span>
                          <span className="mono custody-node__index text-muted">BLOCK #{index + 1}</span>
                        </div>

                        <p className="custody-node__desc">{log.description}</p>

                        <div className="custody-node__footer">
                          <span className="custody-node__meta">
                            <User size={11} />
                            <span>{log.operator}</span>
                          </span>
                          <span className="custody-node__meta">
                            <Clock size={11} />
                            <span>{dateObj.toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Key Details & Integrity Statement */}
        <div className="custody-sidebar-col">
          <Card padding="lg" className="mb-6">
            <h3 className="section-title">Evidence Parameters</h3>

            <div className="spec-table mt-3">
              <div className="spec-row">
                <span className="text-secondary font-medium">Acquisition ID:</span>
                <span className="mono text-ellipsis" style={{ maxWidth: '140px' }} title={evidence.id}>
                  {evidence.id}
                </span>
              </div>
              <div className="spec-row">
                <span className="text-secondary font-medium">Filename:</span>
                <span>{evidence.name}</span>
              </div>
              <div className="spec-row">
                <span className="text-secondary font-medium">Identified Vendor:</span>
                <span className="badge badge--info">{evidence.vendor_detected}</span>
              </div>
              <div className="spec-row">
                <span className="text-secondary font-medium">Ingestion Time:</span>
                <span className="mono text-xs">{new Date(evidence.ingested_at).toLocaleString()}</span>
              </div>
            </div>
          </Card>

          <Card padding="lg" style={{ borderColor: 'var(--amber-border)', background: 'var(--amber-dim)' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Info color="var(--amber)" size={20} style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 6px 0', color: 'var(--amber)' }}>Prototype Disclosure</h4>
                <p className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>
                  This audit log records forensic actions on this evidence file. Actions are logged to the database with SHA-256/MD5 acquisition hashes.
                  Legal admissibility is determined by the reviewing authority — not by this tool.
                </p>
                <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginTop: '8px' }}>
                  <strong>Digital Signature:</strong> NOT IMPLEMENTED<br />
                  <strong>Write-Blocking:</strong> NOT IMPLEMENTED<br />
                  <strong>Cryptographic Chain Binding:</strong> NOT IMPLEMENTED
                </p>
                <div className="mt-4 pt-3 border-t border-subtle">
                  <div className="mono text-xxs text-muted mb-1">ACQUISITION HASH (SHA-256)</div>
                  <div className="mono text-xxs word-break text-secondary bg-dark-subtle p-2 rounded">
                    {evidence.sha256}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
