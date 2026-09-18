import { useEffect, useState } from 'react'
import { useParams as useParamsHookObj } from 'react-router-dom'
import { FileText, Printer, Download, Sparkles, AlertCircle, CheckCircle2, ChevronLeft, ShieldCheck } from 'lucide-react'
import { getReport, generateReport, parseApiError } from '../api/apiClient'
import { Card, Button, SkeletonLine } from '../components/ui'
import './Reports.css'

export default function Reports() {
  const { caseId } = useParamsHookObj()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Compilation Inputs
  const [reportTitle, setReportTitle] = useState('CCTV Forensic Audit Report')
  const [authorName, setAuthorName] = useState('D. Alvarez')
  const [compiling, setCompiling] = useState(false)
  const [compileStatus, setCompileStatus] = useState(null)

  const loadReportWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getReport(caseId)
      setReport(data)
    } catch (err) {
      // 404 is expected if no report has been compiled yet
      const apiErr = parseApiError(err)
      if (err.response && err.response.status === 404) {
        setReport(null)
      } else {
        setError(apiErr)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportWorkspace()
  }, [caseId])

  // Custom regex Markdown-to-HTML parser (lightweight & zero-dep)
  const parseMarkdownToHtml = (md) => {
    if (!md) return ''
    let html = md

    // 1. Clean HTML tags to prevent XSS
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // 2. Headings
    html = html.replace(/^# (.*?)$/gm, '<h1 class="report-h1">$1</h1>')
    html = html.replace(/^## (.*?)$/gm, '<h2 class="report-h2">$1</h2>')
    html = html.replace(/^### (.*?)$/gm, '<h3 class="report-h3">$1</h3>')

    // 3. Blockquotes
    html = html.replace(/^&gt;\s+(.*?)$/gm, '<blockquote>$1</blockquote>')

    // 4. Tables parsing
    // Split lines
    const lines = html.split('\n')
    let inTable = false
    let tableHtml = ''

    const parsedLines = lines.map((line) => {
      const isTableRow = line.startsWith('|') && line.endsWith('|')
      if (isTableRow) {
        // Skip separator line e.g., |---|---|
        if (line.includes('---')) {
          return ''
        }

        const cells = line.split('|').slice(1, -1).map(c => c.trim())
        const tag = !inTable ? 'th' : 'td'

        let row = '<tr>'
        cells.forEach((cell) => {
          row += `<${tag}>${cell}</${tag}>`
        })
        row += '</tr>'

        if (!inTable) {
          inTable = true
          return '<table class="report-table"><thead>' + row + '</thead><tbody>'
        }
        return row
      } else {
        if (inTable) {
          inTable = false
          return '</tbody></table>\n' + line
        }
        return line
      }
    })

    html = parsedLines.join('\n')
    if (inTable) {
      html += '</tbody></table>'
    }

    // 5. Bold & Unordered Lists & Code Blocks
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/`(.*?)`/g, '<code class="mono">$1</code>')
    html = html.replace(/^\-\s+(.*?)$/gm, '<li>$1</li>')
    html = html.replace(/^\*\s+(.*?)$/gm, '<li>$1</li>')

    // Wrap list items
    html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul class="report-ul">$&</ul>')

    // 6. Line breaks
    html = html.replace(/\n/g, '<br />')

    return html
  }

  const handleCompile = async (e) => {
    e.preventDefault()
    setCompiling(true)
    setCompileStatus(null)

    try {
      const compiled = await generateReport(caseId, {
        title: reportTitle,
        generated_by: authorName,
      })
      setReport(compiled)
      setCompileStatus({ type: 'success', message: 'Forensic dossier compiled successfully!' })

      setTimeout(() => {
        setCompileStatus(null)
      }, 3000)
    } catch (err) {
      setCompileStatus({ type: 'error', message: parseApiError(err).message })
    } finally {
      setCompiling(false)
    }
  }

  const triggerPrintPdf = () => {
    window.print()
  }

  const triggerDownloadMarkdown = () => {
    if (!report) return
    const blob = new Blob([report.content_markdown], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Report_${caseId}.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Generate evidence manifest package download
  const triggerDownloadManifest = async () => {
    try {
      const p = await import('../api/apiClient')
      const evList = await p.getEvidenceList(caseId)
      const logs = await p.getTimeline(caseId)

      const manifest = {
        case_id: caseId,
        downloaded_at: new Date().toISOString(),
        evidence: evList,
        audit_trail: logs
      }

      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Case_Manifest_${caseId}.json`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to export system manifest JSON', err)
    }
  }

  if (loading) {
    return (
      <div className="reports-page">
        <SkeletonLine width="180px" height={12} className="mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <SkeletonLine width="100%" height={200} />
          <SkeletonLine width="100%" height={400} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="reports-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Failed to Initialize Report Workspace</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="reports-page">
      <div className="workspace-header mb-6 no-print">
        <div className="eyebrow">Dossier Compilation Panel</div>
        <h1>Forensic Evidence Reporting</h1>
        <p className="text-secondary">Generate and compile structured forensic audit summaries for case review. <strong>Note: This prototype report is NOT court-certified.</strong></p>
      </div>

      <div className="reports-layout">

        {/* Left Column: Compiler Settings */}
        <div className="compiler-settings-col no-print">
          <Card padding="lg">
            <h3 className="section-title mb-4">Dossier Builder</h3>

            <form onSubmit={handleCompile} className="compiler-form">
              <label className="form-field mb-4">
                <span className="eyebrow block mb-1">Report Title</span>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </label>

              <label className="form-field mb-6">
                <span className="eyebrow block mb-1">Lead Author Investigator</span>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="form-input"
                  required
                />
              </label>

              <Button
                type="submit"
                variant="primary"
                loading={compiling}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Sparkles size={15} style={{ marginRight: '6px' }} />
                <span>Compile Forensic Dossier</span>
              </Button>
            </form>

            {compileStatus && (
              <div className={`alert alert--${compileStatus.type === 'success' ? 'success' : 'error'} mt-4`}>
                {compileStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{compileStatus.message}</span>
              </div>
            )}
          </Card>

          {report && (
            <Card padding="lg" className="mt-6">
              <h3 className="section-title mb-4 font-semibold">Dossier Exports</h3>

              <div className="export-buttons-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Button variant="secondary" icon={Printer} onClick={triggerPrintPdf} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  Print PDF Report
                </Button>
                <Button variant="secondary" icon={Download} onClick={triggerDownloadMarkdown} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  Download Markdown (.md)
                </Button>
                <Button variant="secondary" icon={Download} onClick={triggerDownloadManifest} style={{ width: '100%', justifyContent: 'flex-start' }}>
                  Export JSON Manifest Package
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Preview of the PDF */}
        <div className="report-preview-col">
          {report ? (
            <Card padding="lg" className="report-markdown-card print-target">
              {/* Print header */}
              <div className="print-only-logo mb-6 mono select-none">
                <div className="badge badge--info mb-2">Forensic Report — SHA-256 Integrity Digest Included</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>DVR/NVR FORENSIC ANALYSIS PLATFORM — PROTOTYPE</div>
              </div>

              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(report.content_markdown) }}
              />
            </Card>
          ) : (
            <Card padding="lg" className="empty-preview-card no-print" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-center">
                <FileText size={48} className="text-secondary mb-4 mx-auto" style={{ opacity: 0.3 }} />
                <h3>No Dossier Compiled Yet</h3>
                <p className="text-secondary max-w-sm">
                  Click the compiler button on the sidebar to build case temporal logs, carving reports, and YOLO alerts.
                </p>
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}
