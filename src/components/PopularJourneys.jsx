import { ArrowRight } from 'lucide-react'

export default function PopularJourneys({
  routes = [],
  onSelectJourney,
  lang = 'en',
}) {
  if (!routes || routes.length === 0) return null

  const label =
    lang === 'kn'
      ? 'ಜನಪ್ರಿಯ ಕರಾವಳಿ ಪ್ರಯಾಣಗಳು (ಹೆದ್ದಾರಿ NH-66)'
      : 'Popular Corridor Journeys'

  return (
    <div className="pt-2 select-none">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">
          — Click to search instantly
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {routes.map((route) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => onSelectJourney(route.from, route.to)}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-500 text-xs sm:text-sm font-bold text-slate-900 transition cursor-pointer shadow-2xs flex items-center gap-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <span>{route.from}</span>
            <ArrowRight size={14} className="text-blue-600 shrink-0" />
            <span>{route.to}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
