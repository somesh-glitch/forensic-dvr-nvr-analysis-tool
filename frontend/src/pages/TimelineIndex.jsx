import { useEffect } from 'react'
import { useNavigate as useAppNavigate } from 'react-router-dom'
import { useCurrentCase } from '../context/CaseContext'
import { EmptyState } from '../components/ui'
import { History } from 'lucide-react'

export default function TimelineIndex() {
  const navigate = useAppNavigate()
  const { currentCase } = useCurrentCase()

  useEffect(() => {
    if (currentCase) {
      navigate(`/timeline/${currentCase.id}`)
    }
  }, [currentCase, navigate])

  return (
    <div className="flex-center" style={{ minHeight: '60vh' }}>
      <EmptyState
        icon={History}
        title="Timeline Context Required"
        description="Please select or register an active investigation case from the Cases registry."
      />
    </div>
  )
}
