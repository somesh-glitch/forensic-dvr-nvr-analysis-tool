import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import { CaseProvider } from './context/CaseContext'

import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseDetails from './pages/CaseDetails'
import EvidenceAnalysis from './pages/EvidenceAnalysis'
import VideoInvestigation from './pages/VideoInvestigation'
import AnalysisIndex from './pages/AnalysisIndex'
import TimelineIndex from './pages/TimelineIndex'
import Timeline from './pages/Timeline'
import CustodyIndex from './pages/CustodyIndex'
import ChainOfCustody from './pages/ChainOfCustody'
import ReportsIndex from './pages/ReportsIndex'
import Reports from './pages/Reports'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const location = useLocation()

  return (
    <CaseProvider>
      {/* Ambient background: quiet grid + two soft radial glows,
          fixed behind the whole app shell. */}
      <div className="app-background">
        <div className="app-background__glow-a" />
        <div className="app-background__glow-b" />
      </div>

      <div className="app-shell">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
        <div className="app-main">
          <Topbar />
          <main className="app-content page-transition" key={location.pathname}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/cases/:caseId" element={<CaseDetails />} />
              <Route path="/evidence/:evidenceId" element={<EvidenceAnalysis />} />
              <Route path="/videos/:videoId" element={<VideoInvestigation />} />
              <Route path="/analysis" element={<AnalysisIndex />} />
              <Route path="/timeline" element={<TimelineIndex />} />
              <Route path="/timeline/:caseId" element={<Timeline />} />
              <Route path="/custody" element={<CustodyIndex />} />
              <Route path="/custody/:evidenceId" element={<ChainOfCustody />} />
              <Route path="/reports" element={<ReportsIndex />} />
              <Route path="/reports/:caseId" element={<Reports />} />
            </Routes>
          </main>
        </div>
      </div>
    </CaseProvider>
  )
}
