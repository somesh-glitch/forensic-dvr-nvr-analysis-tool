import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentCase } from '../context/CaseContext'
import { getEvidenceList, getVideosForEvidence } from '../api/apiClient'
import { Card, EmptyState } from '../components/ui'
import { ScanSearch, Film, ChevronRight, Video } from 'lucide-react'

export default function AnalysisIndex() {
  const { currentCase } = useCurrentCase()

  const [videoList, setVideoList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentCase) {
      setLoading(true)
      getEvidenceList(currentCase.id)
        .then(async (evidenceData) => {
          const allVideos = []
          for (const ev of evidenceData) {
            try {
              const vids = await getVideosForEvidence(ev.id)
              // Attach evidence name for clarity
              const withEv = vids.map(v => ({ ...v, evidenceName: ev.name }))
              allVideos.push(...withEv)
            } catch (e) {
              console.warn(e)
            }
          }
          setVideoList(allVideos)
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
          icon={ScanSearch}
          title="Case Selection Required"
          description="Please select or register an active investigation case from the Cases registry."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="workspace-header mb-6">
        <div className="eyebrow">Visual Analysis Workspace</div>
        <h1>Select Video Stream Channel</h1>
        <p className="text-secondary">Choose an extracted channel segment in &ldquo;{currentCase.title}&rdquo; to begin frame-accurate YOLO analysis.</p>
      </div>

      {loading ? (
        <Card padding="lg">Loading video streams...</Card>
      ) : videoList.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No video channels extracted"
          description="Go to Case Details and upload or parse evidence first."
        />
      ) : (
        <div className="video-selector-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {videoList.map((vid) => (
            <Card key={vid.id} padding="md" className="flex-apart" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Film size={18} className="text-secondary" />
                <div>
                  <h4 style={{ margin: 0 }}>Channel segment CH-{vid.id.substring(0, 1)}</h4>
                  <span className="mono text-muted" style={{ fontSize: '11px' }}>
                    Source: {vid.evidenceName} | Resolution: {vid.resolution || 'MPEG'}
                  </span>
                </div>
              </div>
              <Link to={`/videos/${vid.id}`} className="btn btn--secondary flex-center" style={{ gap: '6px' }}>
                <span>Open Workspace</span>
                <ChevronRight size={14} />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
