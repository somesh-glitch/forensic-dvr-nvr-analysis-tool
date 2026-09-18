import { useEffect, useState, useRef } from 'react'
import { useParams as useAppParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Pause, RefreshCw, Cpu, Activity, Clock, Sliders, ShieldAlert, Sparkles, CheckSquare, Square } from 'lucide-react'
import { getVideoDetails, getAIDetections, runAIAnalysis, getStaticUrl, parseApiError } from '../api/apiClient'
import { Card, Button, SkeletonLine } from '../components/ui'
import './VideoInvestigation.css'

export default function VideoInvestigation() {
  const { videoId } = useAppParams()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [video, setVideo] = useState(null)
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // AI run configuration
  const [targetClasses, setTargetClasses] = useState(['person', 'vehicle'])
  const [aiMode, setAiMode] = useState('REAL')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisMetrics, setAnalysisMetrics] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Fetch initial details
  const fetchVideoWorkspace = async () => {
    try {
      setLoading(true)
      setError(null)
      const vDetails = await getVideoDetails(videoId)
      setVideo(vDetails)

      const dets = await getAIDetections(videoId)
      setDetections(dets)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideoWorkspace()
  }, [videoId])

  // Align canvas layers on page size changes or video metadata load
  const resizeCanvas = () => {
    const videoEl = videoRef.current
    const canvasEl = canvasRef.current
    if (videoEl && canvasEl) {
      canvasEl.width = videoEl.clientWidth
      canvasEl.height = videoEl.clientHeight
    }
  }

  // Draw overlays timed with playback update ticking
  const drawBoundingBoxes = () => {
    const videoEl = videoRef.current
    const canvasEl = canvasRef.current
    if (!videoEl || !canvasEl || !video) return

    const ctx = canvasEl.getContext('2d')
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

    const fps = video.fps || 25.0
    // Find expected frame index at current playback time
    const currentFrame = Math.round(videoEl.currentTime * fps)

    // filter detections matching the current frame
    const activeDetections = detections.filter(
      (det) => Math.abs(det.frame_number - currentFrame) <= 1
    )

    activeDetections.forEach((det) => {
      const box = det.bounding_box
      if (!box) return

      // Convert ratios to coordinate offsets inside active client dimensions
      const left = box.x_min * canvasEl.width
      const top = box.y_min * canvasEl.height
      const width = (box.x_max - box.x_min) * canvasEl.width
      const height = (box.y_max - box.y_min) * canvasEl.height

      // Render drawing bounding box
      ctx.strokeStyle = det.inference_source === 'REAL_MODEL' ? '#22d3ee' : '#f2a93c'
      ctx.lineWidth = 2
      ctx.strokeRect(left, top, width, height)

      // Render tags label background
      ctx.fillStyle = det.inference_source === 'REAL_MODEL' ? 'rgba(34, 211, 238, 0.85)' : 'rgba(242, 169, 60, 0.85)'
      const text = `${det.label.toUpperCase()} (${Math.round(det.confidence * 100)}%)`
      ctx.font = '11px IBM Plex Mono'
      const textWidth = ctx.measureText(text).width

      const labelTop = top > 18 ? top - 18 : top
      ctx.fillRect(left, labelTop, textWidth + 8, 18)

      // Render label text
      ctx.fillStyle = '#05070a'
      ctx.fillText(text, left + 4, labelTop + 13)
    })
  }

  useEffect(() => {
    if (!video) return
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [video, detections])

  // Track playback time update events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      drawBoundingBoxes()
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      resizeCanvas()
    }
  }

  // Playback Controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const seekToSelection = (frameNumber) => {
    const fps = video.fps || 25.0
    const targetSeconds = frameNumber / fps
    if (videoRef.current) {
      videoRef.current.currentTime = targetSeconds
      setCurrentTime(targetSeconds)
      if (!isPlaying) {
        // Force refresh drawing box overlay on seek when paused
        setTimeout(drawBoundingBoxes, 50)
      }
    }
  }

  const handleSliderSeek = (e) => {
    const targetSeconds = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = targetSeconds
      setCurrentTime(targetSeconds)
      if (!isPlaying) {
        setTimeout(drawBoundingBoxes, 50)
      }
    }
  }

  // Run AI trigger action handler
  const handleStartAnalysis = async () => {
    if (analyzing) return
    setAnalyzing(true)
    setAnalysisError(null)
    setAnalysisMetrics(null)

    try {
      const response = await runAIAnalysis(videoId, {
        classes: targetClasses,
        mode: aiMode,
      })
      setAnalysisMetrics(response)

      // Reload detection log details output
      const dets = await getAIDetections(videoId)
      setDetections(dets)
    } catch (err) {
      setAnalysisError(parseApiError(err))
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleClassSelection = (cls) => {
    setTargetClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    )
  }

  if (loading) {
    return (
      <div className="video-workspace-page">
        <SkeletonLine width="200px" height={12} className="mb-4" />
        <div className="workspace-layout">
          <SkeletonLine width="100%" height={400} />
          <SkeletonLine width="100%" height={400} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="video-workspace-page">
        <Card padding="lg" style={{ borderColor: 'var(--red-border)', background: 'var(--red-dim)' }}>
          <h3>Workspace Loading Failed</h3>
          <p className="text-secondary">{error.message}</p>
        </Card>
      </div>
    )
  }

  const normalizedStreamUrl = getStaticUrl(video.file_path)

  return (
    <div className="video-workspace-page">
      <div className="back-link-row">
        <Link to={`/cases`} className="back-link">
          <ArrowLeft size={14} />
          <span>Exit Workspace</span>
        </Link>
      </div>

      <div className="workspace-header">
        <div>
          <div className="eyebrow">Digital Forensic Video Player</div>
          <h1>Stream Channel Asset Analysis</h1>
          <p className="subtitle mono text-ellipsis">{video.file_path}</p>
        </div>
      </div>

      <div className="workspace-layout">

        {/* Left Column: Player & Baskets */}
        <div className="player-col">
          <Card padding="none" className="player-wrapper-card">
            <div className="video-viewport">
              <video
                ref={videoRef}
                src={normalizedStreamUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                preload="auto"
                playsInline
                className="html5-video-player"
              />
              <canvas ref={canvasRef} className="bounding-boxes-overlay" />
            </div>

            {/* Custom controls row */}
            <div className="player-controls">
              <button type="button" className="btn-play-pause" onClick={togglePlay}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <div className="timeline-scrubber">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.05}
                  value={currentTime}
                  onChange={handleSliderSeek}
                  className="scrubber-input"
                />
              </div>

              <div className="player-time mono">
                <span>{Math.round(currentTime * 10) / 10}s</span>
                <span className="text-muted">/</span>
                <span>{Math.round(duration * 10) / 10}s</span>
              </div>
            </div>
          </Card>

          {/* AI trigger panels */}
          <Card padding="lg" className="mt-6">
            <div className="flex-apart mb-4">
              <h3 className="section-title">Inference Execution Settings</h3>
              <Activity size={16} className="text-secondary" />
            </div>

            <div className="analysis-settings-grid">
              <div>
                <span className="eyebrow block mb-2">Class Classification Filters</span>
                <div className="class-selectors">
                  {['person', 'vehicle', 'car', 'bicycle'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      className={`cls-btn ${targetClasses.includes(cls) ? 'cls-btn--active' : ''}`}
                      onClick={() => toggleClassSelection(cls)}
                    >
                      {targetClasses.includes(cls) ? <CheckSquare size={13} /> : <Square size={13} />}
                      <span>{cls}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="eyebrow block mb-2">Detection Inference Mode</span>
                <div className="mode-toggle-group">
                  <button
                    type="button"
                    className={`mode-btn ${aiMode === 'REAL' ? 'mode-btn--active' : ''}`}
                    onClick={() => setAiMode('REAL')}
                  >
                    REAL YOLOv8
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${aiMode === 'SIMULATED' ? 'mode-btn--active' : ''}`}
                    onClick={() => setAiMode('SIMULATED')}
                  >
                    SIMULATED
                  </button>
                </div>
              </div>
            </div>

            <div className="analysis-action-row mt-6">
              <Button
                variant="primary"
                onClick={handleStartAnalysis}
                loading={analyzing}
                disabled={targetClasses.length === 0}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Cpu size={16} style={{ marginRight: '8px' }} />
                <span>Run Object Detection Analysis Model</span>
              </Button>
            </div>

            {analysisError && (
              <div className="alert alert--error mt-4">
                <ShieldAlert size={14} />
                <span>AI processing failed: {analysisError.message}</span>
              </div>
            )}

            {analysisMetrics && (
              <div className="alert alert--success mt-4">
                <Sparkles size={14} />
                <span>
                  Analysis completed! Found {analysisMetrics.detections_found} objects in {analysisMetrics.frames_processed} frames (Time: {analysisMetrics.processing_time_seconds.toFixed(2)}s).
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Video Specs & Detection logs list */}
        <div className="metadata-col">
          <Card padding="lg" className="mb-6">
            <h3 className="section-title">Extraction Parameters</h3>
            <div className="spec-table mt-3">
              <div className="spec-row">
                <span className="text-secondary mono">Resolution:</span>
                <span className="mono">{video.resolution || 'MPEG Stream'}</span>
              </div>
              <div className="spec-row">
                <span className="text-secondary mono">Framerate:</span>
                <span className="mono">{video.fps ? `${video.fps} FPS` : 'Undetermined'}</span>
              </div>
              <div className="spec-row">
                <span className="text-secondary mono">Decoder Codec:</span>
                <span className="mono">{video.codec || 'H.264 / AAC'}</span>
              </div>
              <div className="spec-row">
                <span className="text-secondary mono">Duration:</span>
                <span className="mono">{video.duration_seconds ? `${video.duration_seconds.toFixed(1)} Sec` : 'Unknown'}</span>
              </div>
            </div>
          </Card>

          {/* Detections List */}
          <Card padding="lg" className="detections-history-card">
            <div className="flex-apart mb-3">
              <h3 className="section-title">Synchronized AI Logs</h3>
              <span className="mono badge badge--neutral">{detections.length} matches</span>
            </div>

            {detections.length === 0 ? (
              <EmptyState
                icon={Sliders}
                title="No detections logged"
                description="Run AI Analysis above to process the frames using YOLOv8 computer vision model."
              />
            ) : (
              <div className="detections-ledger-list">
                {detections.map((det) => {
                  const fps = video.fps || 25.0
                  const isCurrent = Math.abs(currentTime - (det.frame_number / fps)) <= 0.4

                  return (
                    <button
                      key={det.id}
                      type="button"
                      className={`det-ledger-node ${isCurrent ? 'det-ledger-node--current' : ''}`}
                      onClick={() => seekToSelection(det.frame_number)}
                    >
                      <div className="det-ledger-header">
                        <span className="mono label-glow-text">{det.label.toUpperCase()}</span>
                        <span className="mono confidence-value">
                          {Math.round(det.confidence * 100)}%
                        </span>
                      </div>

                      <div className="det-ledger-footer">
                        <span className="mono text-muted text-xs">
                          Frame: #{det.frame_number}
                        </span>
                        <span className="mono text-muted text-xs flex-center" style={{ gap: '4px' }}>
                          <Clock size={11} />
                          {Math.round((det.frame_number / fps) * 10) / 10}s
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  )
}
