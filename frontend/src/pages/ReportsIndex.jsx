import { useEffect } from 'react'
import { useNavigate as useAppNavigate } from 'react-router-dom'
import { useCurrentCase } from '../context/CaseContext'
import { EmptyState } from '../components/ui'
import { FileText } from 'lucide-react'

export default function ReportsIndex() {
  const navigate = useAppNavigate()
  const { currentCase } = useCurrentCase()

  useEffect(() => {
    if (currentCase) {
      navigate(`/reports/${currentCase.id}`)
    }
  }, [currentCase, navigate])

  return (
    <div className="flex-center" style={{ minHeight: '60vh' }}>
      <EmptyState
        icon={FileText}
        title="Reports Context Required"
        description="Please select or register an active investigation case from the Cases registry."
      />
    </div>
  )
}
