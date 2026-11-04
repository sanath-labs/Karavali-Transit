import { useState } from 'react'
import OfficialHeader from './components/OfficialHeader.jsx'
import RouteStrip from './components/RouteStrip.jsx'
import NavigationDrawer from './components/NavigationDrawer.jsx'
import FindBusStopModal from './components/FindBusStopModal.jsx'
import HelpdeskModal from './components/HelpdeskModal.jsx'
import FeedbackModal from './components/FeedbackModal.jsx'
import ContactUsModal from './components/ContactUsModal.jsx'

export default function OfficialNavigation({
  role = 'passenger',
  onSelectRole,
  lang = 'en',
  toggleLanguage,
  dbStatus = true,
  onSelectCorridorStop,
  onNavigateHome,
  onNavigateRadar,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // 'findStop' | 'helpdesk' | 'feedback' | 'contact'

  return (
    <>
      {/* 1. Official Top Website Header */}
      <OfficialHeader
        role={role}
        onOpenDrawer={() => setDrawerOpen(true)}
        onNavigateHome={() => {
          if (role !== 'passenger') onSelectRole('passenger')
          if (onNavigateHome) onNavigateHome()
        }}
        lang={lang}
        toggleLanguage={toggleLanguage}
        dbStatus={dbStatus}
      />

      {/* 2. Official 9-Stop Corridor Route Strip */}
      {role === 'passenger' && (
        <RouteStrip onSelectStop={onSelectCorridorStop} />
      )}

      {/* 3. Universal Slide-out Navigation Drawer */}
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={role}
        onSelectRole={onSelectRole}
        onNavigateHome={onNavigateHome}
        onNavigateRadar={onNavigateRadar}
        onOpenModal={(modalName) => setActiveModal(modalName)}
        lang={lang}
        toggleLanguage={toggleLanguage}
      />

      {/* 4. Shared Modals */}
      <FindBusStopModal
        isOpen={activeModal === 'findStop'}
        onClose={() => setActiveModal(null)}
      />

      <HelpdeskModal
        isOpen={activeModal === 'helpdesk'}
        onClose={() => setActiveModal(null)}
      />

      <FeedbackModal
        isOpen={activeModal === 'feedback'}
        onClose={() => setActiveModal(null)}
      />

      <ContactUsModal
        isOpen={activeModal === 'contact'}
        onClose={() => setActiveModal(null)}
      />
    </>
  )
}
