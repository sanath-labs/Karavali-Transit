import { MapPin } from 'lucide-react'

export default function RouteTimeline({ stops = [], currentStop, destination }) {
  return (
    <div className="space-y-0 relative pl-2 pt-2 select-none">
      {stops.map((stop, idx) => {
        const isLast = idx === stops.length - 1
        const isBoarding = stop.stop_name.toLowerCase() === currentStop.toLowerCase()
        const isDestination = stop.stop_name.toLowerCase() === destination.toLowerCase()

        return (
          <div key={stop.stop_id || idx} className="flex items-start gap-4 relative pb-5 last:pb-0">
            {/* Connecting Vertical Line */}
            {!isLast && (
              <div className="absolute left-[7px] top-[18px] bottom-0 w-0.5 bg-slate-200" />
            )}

            {/* Node Bullet */}
            {isBoarding ? (
              <div className="w-4 h-4 rounded-full border-[3px] border-emerald-600 bg-white shrink-0 mt-0.5 z-10 shadow-2xs" />
            ) : isDestination ? (
              <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 z-10 shadow-2xs">
                <MapPin size={10} strokeWidth={3} />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white shrink-0 mt-0.5 ml-[1px] z-10" />
            )}

            {/* Stop Info */}
            <div className="flex-1 -mt-0.5 flex items-center justify-between">
              <div>
                <div
                  className={`text-xs ${
                    isBoarding
                      ? 'font-black text-emerald-800 text-sm'
                      : isDestination
                      ? 'font-black text-rose-800 text-sm'
                      : 'font-bold text-slate-800'
                  }`}
                >
                  {stop.stop_name}
                  {isBoarding && (
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                      (Boarding)
                    </span>
                  )}
                  {isDestination && (
                    <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                      (Destination)
                    </span>
                  )}
                </div>
                {stop.nearby_landmarks && (
                  <span className="text-[11px] text-slate-400 font-medium block">
                    {stop.nearby_landmarks.split(',')[0]}
                  </span>
                )}
              </div>

              <div className="text-xs font-mono font-bold text-slate-700">
                {stop.planned_arrival}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
