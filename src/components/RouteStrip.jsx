import { OFFICIAL_9_CORRIDOR_STOPS } from '../transitUtils.js'

export default function RouteStrip({ onSelectStop }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-6 py-2 overflow-x-auto scrollbar-none select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs font-bold text-slate-600 whitespace-nowrap min-w-max">
        {OFFICIAL_9_CORRIDOR_STOPS.map((stop, idx) => (
          <div key={stop.stop_id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectStop && onSelectStop(stop.stop_name)}
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
  )
}
