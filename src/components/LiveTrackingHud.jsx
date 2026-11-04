import { Bus, RotateCw } from 'lucide-react'

export default function LiveTrackingHud({ bus, telemetry, secondsAgo = 15 }) {
  if (!bus) return null

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-10 select-none">
      <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 space-y-3">
        {/* Bus Title & Active Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Bus size={18} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight m-0">
                {bus.bus_name}
              </h3>
              <p className="text-xs font-semibold text-slate-500 m-0">
                {bus.vehicle_number}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        </div>

        {/* Next Stop & ETA Boxes */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Next Stop
            </span>
            <strong className="text-sm font-black text-slate-900 mt-0.5 block">
              {telemetry?.next_stop || 'Kaup'}
            </strong>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              ETA
            </span>
            <strong className="text-sm font-black text-slate-900 mt-0.5 block">
              ~ {telemetry?.eta_minutes || 18} min
            </strong>
          </div>
        </div>

        {/* Freshness Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <RotateCw size={12} className="text-blue-600 animate-spin" />
            <span>
              Last Updated: 11:02 AM • 🟢 Live ({secondsAgo}s)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
