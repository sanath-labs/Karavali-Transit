import { useState } from 'react'
import {
  Menu,
  X,
  Bus,
  Navigation,
  Compass,
  Building,
  Radio,
  HelpCircle,
  MessageSquare,
  Phone,
  MapPin,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react'
import { apiUrl } from './api.js'
import { OFFICIAL_9_CORRIDOR_STOPS } from './transitUtils.js'

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

  // Modal State for Find Stop
  const [findStopTab, setFindStopTab] = useState('name')
  const [findStopQuery, setFindStopQuery] = useState('')
  const [nearMeStops, setNearMeStops] = useState([])
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [nearMeError, setNearMeError] = useState('')

  // Modal State for Feedback
  const [feedbackName, setFeedbackName] = useState('')
  const [feedbackEmail, setFeedbackEmail] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState('Service Quality')
  const [feedbackRating, setFeedbackRating] = useState(5)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  // Geolocation for Nearby Stops (on-demand only, strictly no tracking)
  const handleFindStopsNearMe = () => {
    if (!navigator.geolocation) {
      setNearMeError('Geolocation is not supported by your browser.')
      return
    }
    setNearMeLoading(true)
    setNearMeError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            apiUrl(`/api/public/stops/nearby?lat=${latitude}&lng=${longitude}&radius=35`)
          )
          const data = await res.json()
          if (data.success && Array.isArray(data.stops)) {
            setNearMeStops(data.stops)
          } else {
            setNearMeStops([])
          }
        } catch {
          setNearMeError('Failed to retrieve nearby bus stops.')
        } finally {
          setNearMeLoading(false)
        }
      },
      (err) => {
        setNearMeLoading(false)
        setNearMeError('Location permission was denied or unavailable.')
        console.warn('Geolocation denied:', err)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Handle Feedback Submission
  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackMessage.trim()) return
    setFeedbackSubmitting(true)
    try {
      const res = await fetch(apiUrl('/api/public/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName.trim() || 'Passenger',
          email: feedbackEmail.trim(),
          category: feedbackCategory,
          rating: feedbackRating,
          message: feedbackMessage.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedbackSuccess(true)
        setFeedbackMessage('')
      }
    } catch (err) {
      console.error('Feedback submit failed:', err)
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // Filtered stops for Find Stop modal
  const filteredStops = OFFICIAL_9_CORRIDOR_STOPS.filter((stop) => {
    const q = findStopQuery.trim().toLowerCase()
    if (!q) return true
    if (findStopTab === 'name') {
      return (
        stop.stop_name.toLowerCase().includes(q) ||
        stop.stop_name_kn.includes(q) ||
        stop.alternative_names.toLowerCase().includes(q)
      )
    }
    if (findStopTab === 'landmark') {
      return (
        stop.nearby_landmarks.toLowerCase().includes(q) ||
        stop.locality.toLowerCase().includes(q) ||
        stop.alternative_names.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <>
      {/* ============================================================== */}
      {/* 1. OFFICIAL TOP WEBSITE HEADER                                  */}
      {/* ============================================================== */}
      <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Left: Hamburger Button & Official Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              aria-label="Open Navigation Menu"
              title="Open Navigation Menu"
            >
              <Menu size={22} strokeWidth={2.4} />
            </button>

            <div
              onClick={() => {
                if (role !== 'passenger') {
                  onSelectRole('passenger')
                }
                if (onNavigateHome) onNavigateHome()
              }}
              className="flex items-center gap-2.5 cursor-pointer"
              title="Karavali-Transit Home"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Bus size={19} strokeWidth={2.4} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 leading-none">
                    Karavali-Transit
                  </span>
                  <span className="hidden md:inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {role === 'owner'
                      ? 'Fleet Owner Portal'
                      : role === 'conductor'
                      ? 'Conductor Terminal'
                      : 'Public Transit Network'}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 leading-tight hidden sm:block mt-0.5">
                  Coastal Karnataka NH-66 Corridor
                </p>
              </div>
            </div>
          </div>

          {/* Right: GPS Status & Language Switcher */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Real-time Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{dbStatus ? 'Network Connected' : 'GPS Active'}</span>
            </div>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-600 bg-slate-50 hover:bg-blue-50 text-slate-800 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title={lang === 'en' ? 'ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಿ' : 'Switch to English'}
            >
              <span className="text-sm">🌐</span>
              <span>{lang === 'en' ? 'ಕನ್ನಡ' : 'English'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. OFFICIAL ROUTE STRIP (STRICTLY 9 STOPS)                     */}
        {/* ============================================================== */}
        {role === 'passenger' && (
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6 py-2 overflow-x-auto scrollbar-none">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold text-slate-600 whitespace-nowrap min-w-max">
              {OFFICIAL_9_CORRIDOR_STOPS.map((stop, idx) => (
                <div key={stop.stop_id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectCorridorStop && onSelectCorridorStop(stop.stop_name)}
                    className="hover:text-blue-700 hover:underline cursor-pointer transition text-slate-700"
                    title={`Select stop: ${stop.stop_name}`}
                  >
                    {stop.stop_name}
                  </button>
                  {idx < OFFICIAL_9_CORRIDOR_STOPS.length - 1 && (
                    <span className="text-slate-300 font-bold select-none">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 3. UNIVERSAL SLIDE-OUT NAVIGATION DRAWER (HAMBURGER ☰)         */}
      {/* ============================================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex select-none">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity cursor-pointer"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-80 max-w-[85%] bg-white text-slate-900 h-full shadow-2xl flex flex-col z-10 border-r border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Bus size={18} strokeWidth={2.4} />
                </span>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight text-white m-0">
                    Karavali-Transit
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium m-0">
                    Public Transportation Network
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close Navigation Menu"
              >
                <X size={19} />
              </button>
            </div>

            {/* Navigation Groups */}
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto text-xs">
              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Passenger Services
              </div>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  if (role !== 'passenger') onSelectRole('passenger')
                  if (onNavigateHome) onNavigateHome()
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-left font-bold flex items-center gap-3 transition cursor-pointer ${
                  role === 'passenger'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Navigation size={17} className="text-blue-600" />
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  if (role !== 'passenger') onSelectRole('passenger')
                  if (onNavigateRadar) onNavigateRadar()
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
              >
                <Bus size={17} className="text-blue-600" />
                <span>Passenger Radar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setActiveModal('findStop')
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
              >
                <Compass size={17} className="text-blue-600" />
                <span>Find Bus Stop</span>
              </button>

              <div className="my-2 border-t border-slate-100" />

              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Operator Portals
              </div>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  onSelectRole('owner')
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-left font-bold flex items-center gap-3 transition cursor-pointer ${
                  role === 'owner'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Building size={17} className="text-slate-500" />
                <span>Fleet Owner Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  onSelectRole('conductor')
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-left font-bold flex items-center gap-3 transition cursor-pointer ${
                  role === 'conductor'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Radio size={17} className="text-slate-500" />
                <span>Conductor Login</span>
              </button>

              <div className="my-2 border-t border-slate-100" />

              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Transit Information
              </div>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setActiveModal('helpdesk')
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
              >
                <HelpCircle size={17} className="text-slate-500" />
                <span>Helpdesk</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setActiveModal('feedback')
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
              >
                <MessageSquare size={17} className="text-slate-500" />
                <span>Feedback</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setActiveModal('contact')
                }}
                className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
              >
                <Phone size={17} className="text-slate-500" />
                <span>Contact Us</span>
              </button>
            </nav>

            {/* Drawer Footer with Language Selection */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
              <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                <span>🌐</span>
                <span>Language:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (lang !== 'en') toggleLanguage()
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (lang !== 'kn') toggleLanguage()
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    lang === 'kn'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ಕನ್ನಡ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SHARED MODALS: FIND BUS STOP                                */}
      {/* ============================================================== */}
      {activeModal === 'findStop' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
                  Find Bus Stop
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setFindStopTab('name')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  findStopTab === 'name'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                By Stop Name
              </button>
              <button
                type="button"
                onClick={() => setFindStopTab('landmark')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  findStopTab === 'landmark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                By Landmark
              </button>
              <button
                type="button"
                onClick={() => {
                  setFindStopTab('nearme')
                  handleFindStopsNearMe()
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  findStopTab === 'nearme'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nearby (GPS)
              </button>
            </div>

            {/* Search Input for Name & Landmark */}
            {findStopTab !== 'nearme' && (
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      findStopTab === 'name'
                        ? 'Search official stop name (e.g. Surathkal)...'
                        : 'Search landmark (e.g. NITK, Temple, Hospital)...'
                    }
                    value={findStopQuery}
                    onChange={(e) => setFindStopQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-600 outline-none"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Stop Results List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {findStopTab === 'nearme' ? (
                nearMeLoading ? (
                  <div className="text-center py-8 text-xs font-bold text-slate-500">
                    <RotateCw size={24} className="mx-auto text-blue-600 animate-spin mb-2" />
                    Calculating distance to coastal corridor stops...
                  </div>
                ) : nearMeError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl text-center">
                    {nearMeError}
                  </div>
                ) : nearMeStops.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-bold">
                    No stops found near your current position.
                  </div>
                ) : (
                  nearMeStops.map((stop) => (
                    <div
                      key={stop.stop_id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 m-0">
                          {stop.stop_name} ({stop.stop_name_kn})
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium m-0 mt-0.5">
                          {stop.nearby_landmarks || stop.locality}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-black bg-blue-100 text-blue-800 shrink-0">
                        {stop.distance_km} km away
                      </span>
                    </div>
                  ))
                )
              ) : filteredStops.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-bold">
                  No matching stops found for &quot;{findStopQuery}&quot;
                </div>
              ) : (
                filteredStops.map((stop) => (
                  <div
                    key={stop.stop_id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/50 flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {stop.stop_id}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-slate-900 m-0">
                          {stop.stop_name}
                        </h4>
                        <span className="text-[11px] font-medium text-slate-500">
                          {stop.stop_name_kn}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium mt-1 mb-0">
                        <strong className="text-slate-700">Landmarks:</strong> {stop.nearby_landmarks}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 mb-0">
                        {stop.locality}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. SHARED MODALS: HELPDESK                                     */}
      {/* ============================================================== */}
      {activeModal === 'helpdesk' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
                  Helpdesk &amp; Passenger Guidelines
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  What is Karavali-Transit?
                </h4>
                <p className="m-0 leading-relaxed">
                  Karavali-Transit is a real-time public passenger tracking and information network designed for private buses operating on the Mangaluru – Kundapura NH-66 corridor.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  How accurate is live bus tracking?
                </h4>
                <p className="m-0 leading-relaxed">
                  Bus locations are streamed directly from onboard conductor mobile GPS terminals. Active buses display a green live badge with current position and estimated arrival time.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  Are passengers required to register or login?
                </h4>
                <p className="m-0 leading-relaxed">
                  No registration or personal information is required. The passenger portal is 100% open and accessible to all commuters.
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  What stops are served by this network?
                </h4>
                <p className="m-0 leading-relaxed">
                  The network strictly serves the 9 official NH-66 stops: Mangaluru, Kuntikana, Kulur, Surathkal, Mulki, Padubidri, Kaup, Udupi, and Kundapura.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. SHARED MODALS: FEEDBACK                                     */}
      {/* ============================================================== */}
      {activeModal === 'feedback' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
                  Passenger Feedback
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {feedbackSuccess ? (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Thank You for Your Feedback
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Your remarks have been recorded to help maintain coastal transit quality and reliability.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSuccess(false)
                      setActiveModal(null)
                    }}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Shetty"
                      value={feedbackName}
                      onChange={(e) => setFeedbackName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:border-blue-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="ramesh@example.com"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:border-blue-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Feedback Category
                    </label>
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold bg-white focus:border-blue-600 outline-none cursor-pointer"
                    >
                      <option value="Service Quality">Service Quality &amp; Comfort</option>
                      <option value="Punctuality">Punctuality &amp; Timing</option>
                      <option value="Conductor Behavior">Conductor Assistance</option>
                      <option value="App Usability">App &amp; Tracking Accuracy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Rating
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className={`w-9 h-9 rounded-xl border font-bold text-xs flex items-center justify-center cursor-pointer transition ${
                            feedbackRating >= star
                              ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          ★ {star}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-1">
                      Your Comments <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Share details regarding your commute experience along NH-66..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-medium focus:border-blue-600 outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={feedbackSubmitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. SHARED MODALS: CONTACT US                                   */}
      {/* ============================================================== */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone size={20} className="text-blue-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
                  Contact Karavali-Transit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-slate-600">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 m-0">
                    Coastal Transit Helpline
                  </h4>
                  <p className="text-sm font-black text-blue-700 m-0 mt-0.5">
                    +91 824 244 5566
                  </p>
                  <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                    Operating Hours: 06:00 AM – 10:00 PM (Daily)
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 m-0">
                    Depot Coordination Office
                  </h4>
                  <p className="text-xs text-slate-700 font-medium m-0 mt-0.5">
                    Statebank Bus Terminus Complex, Mangaluru – 575001, Karnataka
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 m-0">
                    Transit Emergency Support
                  </h4>
                  <p className="text-xs text-slate-700 font-medium m-0 mt-0.5">
                    For road incidents or service delays along NH-66, dial 112 or notify station master.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
