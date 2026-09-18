/**
 * Mock data layer.
 *
 * This file is the ONLY place that fabricates forensic data. Pages
 * never invent numbers themselves — they call the getters below,
 * which are shaped the way the real backend responses will be
 * (see the integration spec: GET /api/v1/cases/, GET /api/v1/evidence/,
 * GET /api/v1/timeline/{case_id}, etc.). When the backend teammate's
 * API is ready, swap the getter bodies for real `casesApi`/`evidenceApi`
 * calls — the pages consuming them shouldn't need to change shape.
 */

export const mockCases = [
  {
    id: 'case_0042',
    case_number: 'CASE-2026-0042',
    title: 'Multi-Vendor CCTV Investigation',
    investigator: 'D. Alvarez',
    description:
      'Suspected break-in captured across a mixed Hikvision/Dahua camera network at a commercial property.',
    vendor_detected: 'Hikvision',
    device_serial: 'HK-DS7608-2024X',
    camera_count: 8,
    status: 'ACTIVE',
    created_at: '2026-08-19T09:14:00Z',
  },
  {
    id: 'case_0041',
    case_number: 'CASE-2026-0041',
    title: 'Office Security Investigation',
    investigator: 'K. Moreno',
    description: 'After-hours entry review pulled from an 8-channel Dahua NVR.',
    vendor_detected: 'Dahua',
    device_serial: 'DH-NVR5208-4KS2',
    camera_count: 8,
    status: 'CLOSED',
    created_at: '2026-08-14T08:30:00Z',
  },
  {
    id: 'case_0038',
    case_number: 'CASE-2026-0038',
    title: 'Parking Structure Vehicle Theft',
    investigator: 'D. Alvarez',
    description: 'DVR extraction from a Dahua NVR covering the north parking structure.',
    vendor_detected: 'Dahua',
    device_serial: 'DH-NVR4208-8P',
    camera_count: 4,
    status: 'ACTIVE',
    created_at: '2026-08-11T14:02:00Z',
  },
  {
    id: 'case_0031',
    case_number: 'CASE-2026-0031',
    title: 'Retail Loss Prevention Review',
    investigator: 'K. Moreno',
    description: 'Routine evidence review for a retail loss-prevention referral.',
    vendor_detected: 'Uniview',
    device_serial: 'UNV-NVR302-16E',
    camera_count: 12,
    status: 'CLOSED',
    created_at: '2026-07-30T11:45:00Z',
  },
]

/**
 * Evidence items, keyed loosely by case_id — mirrors what
 * GET /api/v1/evidence/?case_id={id} will eventually return.
 */
export const mockEvidenceByCase = {
  case_0042: {
    evidence_count: 126,
    video_count: 34,
    ai_detection_count: 17,
    integrity_status: 'verified', // 'verified' | 'warning' | 'failed'
  },
  case_0041: {
    evidence_count: 74,
    video_count: 19,
    ai_detection_count: 9,
    integrity_status: 'verified',
  },
  case_0038: {
    evidence_count: 58,
    video_count: 12,
    ai_detection_count: 6,
    integrity_status: 'verified',
  },
  case_0031: {
    evidence_count: 203,
    video_count: 41,
    ai_detection_count: 29,
    integrity_status: 'warning',
  },
}

/**
 * Recent forensic activity feed. `tone` maps directly to the app's
 * badge/semantic colors: 'verified' (green), 'warning' (amber),
 * 'critical' (red), 'info' (cyan).
 */
export const mockActivityLog = [
  {
    id: 'act_1',
    case_id: 'case_0042',
    tone: 'verified',
    message: 'Evidence imported',
    detail: 'CAM-06_2026-08-19.mp4 ingested from Hikvision DVR export',
    timestamp: '2026-08-19T09:20:00Z',
  },
  {
    id: 'act_2',
    case_id: 'case_0042',
    tone: 'verified',
    message: 'SHA-256 hash verified',
    detail: 'Checksum matched against original media on ingest',
    timestamp: '2026-08-19T09:21:00Z',
  },
  {
    id: 'act_3',
    case_id: 'case_0042',
    tone: 'warning',
    message: 'Anomaly detected',
    detail: 'Timestamp gap of 4m12s found on CAM-03 between 02:14–02:18',
    timestamp: '2026-08-19T10:02:00Z',
  },
  {
    id: 'act_4',
    case_id: 'case_0042',
    tone: 'verified',
    message: 'Timeline generated',
    detail: 'Unified timeline built from 8 camera sources',
    timestamp: '2026-08-19T10:05:00Z',
  },
  {
    id: 'act_5',
    case_id: 'case_0038',
    tone: 'info',
    message: 'AI analysis started',
    detail: 'Person/vehicle detection queued on 4 videos',
    timestamp: '2026-08-11T15:10:00Z',
  },
]

function delay(ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns the case list. Shaped like a resolved GET /api/v1/cases/
 * response and deliberately async so calling code already handles
 * a loading state, matching how the real API call will behave.
 */
export async function getMockCases() {
  await delay()
  return mockCases
}

/**
 * Aggregate stats for a given case — evidence count, camera count,
 * AI event count, and an overall integrity status. In the real
 * integration this will likely be composed client-side from
 * GET /api/v1/evidence/?case_id=... and GET /api/v1/analysis/...
 * rather than a single endpoint, so the shape here is intentionally
 * a plain object rather than mimicking one specific response.
 */
export async function getDashboardStats(caseId) {
  await delay()
  const evidence = mockEvidenceByCase[caseId]
  const caseRecord = mockCases.find((c) => c.id === caseId)
  if (!evidence || !caseRecord) return null

  return {
    evidenceCount: evidence.evidence_count,
    cameraCount: caseRecord.camera_count,
    eventCount: evidence.ai_detection_count,
    integrityStatus: evidence.integrity_status,
  }
}

/**
 * Recent activity, optionally scoped to a case. Mirrors what a
 * future GET /api/v1/timeline/{case_id} (filtered/sorted) could
 * feed into an activity-style view.
 */
export async function getRecentActivity(caseId, limit = 6) {
  await delay()
  const scoped = caseId
    ? mockActivityLog.filter((a) => a.case_id === caseId)
    : mockActivityLog
  return [...scoped]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit)
}

/**
 * Evidence file count for a case, for use in list/summary views
 * that don't need the full stats object.
 */
export function getEvidenceCountForCase(caseId) {
  return mockEvidenceByCase[caseId]?.evidence_count ?? 0
}

/**
 * Creates a new case in the in-memory mock store and returns it —
 * stands in for POST /api/v1/cases/. Mutates the module-level
 * arrays directly, which is sufficient for this prototype (state
 * resets on reload); the real implementation will just be a
 * casesApi.createCase() call returning the backend's response body.
 */
export async function createMockCase({ case_number, title, investigator, description }) {
  await delay(400)

  const id = `case_${Math.random().toString(36).slice(2, 8)}`
  const newCase = {
    id,
    case_number,
    title,
    investigator,
    description,
    vendor_detected: null,
    device_serial: null,
    camera_count: 0,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
  }

  mockCases.unshift(newCase)
  mockEvidenceByCase[id] = {
    evidence_count: 0,
    video_count: 0,
    ai_detection_count: 0,
    integrity_status: 'verified',
  }

  return newCase
}
