import { Menu, Bus } from 'lucide-react'

export default function OfficialHeader({
  role = 'passenger',
  onOpenDrawer,
  onNavigateHome,
  lang = 'en',
  toggleLanguage,
  dbStatus = true,
}) {
  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Left: Hamburger Button & Official Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
            aria-label="Open Navigation Menu"
            title="Open Navigation Menu"
          >
            <Menu size={22} strokeWidth={2.4} />
          </button>

          <div
            onClick={onNavigateHome}
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
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{dbStatus ? 'Network Connected' : 'GPS Active'}</span>
          </div>

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
    </header>
  )
}
