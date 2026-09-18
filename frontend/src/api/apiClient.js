import axios from 'axios'

// Use VITE_API_BASE_URL env var (set in .env) — fallback to port 8000
export const BACKEND_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const API_BASE_URL = `${BACKEND_BASE_URL}/api/v1`

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Sync AI analysis can take some time
})

const STATUS_MESSAGES = {
  400: 'Invalid request or duplicate case number.',
  404: 'Requested forensic record was not found.',
  422: 'Invalid parameters.',
  500: 'Backend forensic processing failed.',
}

export function parseApiError(error) {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        status: null,
        message: 'Unable to connect to forensic backend. Make sure FastAPI is running on port 8000.',
        detail: error.message,
      }
    }

    const status = error.response.status
    const backendDetail = error.response.data?.detail

    return {
      status,
      message: STATUS_MESSAGES[status] || `Unexpected backend error (HTTP ${status}).`,
      detail: typeof backendDetail === 'string' ? backendDetail : JSON.stringify(backendDetail ?? ''),
    }
  }

  return {
    status: null,
    message: 'An unexpected error occurred.',
    detail: error?.message ?? String(error),
  }
}

/**
 * Converts backend file system paths to HTTP static URLs.
 * Backend mounts /static → storage/ directory.
 * Examples:
 *   C:\...\storage\uploads\foo.mp4  →  http://localhost:8000/static/uploads/foo.mp4
 *   storage/uploads/foo.mp4         →  http://localhost:8000/static/uploads/foo.mp4
 *   uploads/foo.mp4                 →  http://localhost:8000/static/uploads/foo.mp4
 */
export function getStaticUrl(filePath) {
  if (!filePath) return ''
  // Normalize Windows backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')
  // Find the 'storage/' segment (absolute or relative Windows paths both contain it)
  const storageIndex = normalized.indexOf('storage/')
  if (storageIndex !== -1) {
    // Everything after 'storage/' is the relative path served by FastAPI /static
    const relativePath = normalized.substring(storageIndex + 'storage/'.length)
    return `${BACKEND_BASE_URL}/static/${encodeURI(relativePath)}`
  }
  // Fallback: assume it's a bare filename or 'uploads/filename'
  const uploadsIndex = normalized.indexOf('uploads/')
  if (uploadsIndex !== -1) {
    const relativePath = normalized.substring(uploadsIndex)
    return `${BACKEND_BASE_URL}/static/${encodeURI(relativePath)}`
  }
  // Last resort: treat as bare filename in uploads
  const parts = normalized.split('/')
  return `${BACKEND_BASE_URL}/static/uploads/${encodeURIComponent(parts[parts.length - 1])}`
}

// ==================== API FUNCTIONS ====================

export async function getCases() {
  const response = await apiClient.get('/cases')
  return response.data
}

export async function getCase(caseId) {
  const response = await apiClient.get(`/cases/${caseId}`)
  return response.data
}

export async function createCase(payload) {
  const response = await apiClient.post('/cases', payload)
  return response.data
}

export async function getRecoveryFragments(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}/recovery`)
  return response.data;
}

export async function getEvidenceList(caseId) {
  const response = await apiClient.get('/evidence', {
    params: { case_id: caseId }
  })
  return response.data
}

export async function getEvidence(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}`)
  return response.data
}

export async function uploadEvidence(caseId, file) {
  const formData = new FormData()
  formData.append('case_id', caseId)
  formData.append('file', file)

  const response = await apiClient.post('/evidence/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export async function getVideosForEvidence(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}/videos`)
  return response.data
}

export async function getVideoDetails(videoId) {
  const response = await apiClient.get(`/videos/${videoId}`)
  return response.data
}

export async function getAIDetections(videoId) {
  const response = await apiClient.get(`/analysis/${videoId}`)
  return response.data
}

export async function runAIAnalysis(videoId, payload) {
  const response = await apiClient.post(`/analysis/${videoId}`, payload)
  return response.data
}

export async function getTimeline(caseId) {
  const response = await apiClient.get(`/timeline/${caseId}`)
  return response.data
}

export async function getChainOfCustody(evidenceId) {
  const response = await apiClient.get(`/chain-of-custody/${evidenceId}`)
  return response.data
}

export async function getReport(caseId) {
  const response = await apiClient.get(`/reports/${caseId}`)
  return response.data
}

export async function generateReport(caseId, payload) {
  const response = await apiClient.post(`/reports/${caseId}`, payload)
  return response.data
}

export function downloadReportUrl(caseId) {
  return `${API_BASE_URL}/reports/download/${caseId}`
}

export async function pingBackend() {
  try {
    // Use health endpoint — faster and doesn't touch the full cases list
    await apiClient.get('/system/health')
    return true
  } catch (err) {
    return false
  }
}

export async function verifyEvidence(evidenceId) {
  const response = await apiClient.post(`/evidence/${evidenceId}/verify`)
  return response.data
}

export async function getEvidenceIntegrity(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}/integrity`)
  return response.data
}

export async function getEvidenceDevice(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}/device`)
  return response.data
}

export async function getEvidenceCameras(evidenceId) {
  const response = await apiClient.get(`/evidence/${evidenceId}/cameras`)
  return response.data
}

export async function getCaseSummary(caseId) {
  const response = await apiClient.get(`/cases/${caseId}/summary`)
  return response.data
}

export async function getCaseStats(caseId) {
  const response = await apiClient.get(`/cases/${caseId}/stats`)
  return response.data
}

export async function getSystemHealth() {
  const response = await apiClient.get('/system/health')
  return response.data
}


