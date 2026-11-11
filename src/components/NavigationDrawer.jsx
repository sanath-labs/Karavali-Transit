import {
  X,
  Bus,
  Navigation,
  Compass,
  Building,
  Radio,
  HelpCircle,
  MessageSquare,
  Phone,
} from 'lucide-react'

export default function NavigationDrawer({
  isOpen,
  onClose,
  role = 'passenger',
  onSelectRole,
  onNavigateHome,
  onNavigateRadar,
  onOpenModal,
  lang = 'en',
  toggleLanguage,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity cursor-pointer"
        onClick={onClose}
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
            onClick={onClose}
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
              onClose()
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
              onClose()
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
              onClose()
              onOpenModal('findStop')
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
              onClose()
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
              onClose()
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
              onClose()
              onOpenModal('helpdesk')
            }}
            className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
          >
            <HelpCircle size={17} className="text-slate-500" />
            <span>Helpdesk</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenModal('feedback')
            }}
            className="w-full px-3 py-2.5 rounded-xl text-left font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-3 transition cursor-pointer"
          >
            <MessageSquare size={17} className="text-slate-500" />
            <span>Feedback</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenModal('contact')
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
  )
}
