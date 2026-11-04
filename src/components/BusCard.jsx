import { Bus, MapPin } from 'lucide-react'

export default function BusCard({
  bus,
  currentStop,
  destination,
  onTrack,
  onViewDetails,
}) {
  const isLive = Boolean(
    bus.tracking_status === 'LIVE' ||
      (bus.is_live && bus.tracking_status !== 'LOCATION STALE' && bus.tracking_status !== 'OFFLINE')
  )
  const isStale = bus.tracking_status === 'LOCATION STALE'
  const isNotTracking = bus.tracking_status === 'NOT TRACKING'
  const canTrack = isLive || isStale

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-blue-400 hover:shadow-xs transition flex flex-col justify-between space-y-4 select-none">
      {/* Header Row: Operator, Vehicle, Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Bus size={20} strokeWidth={2.4} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 leading-tight m-0">
              {bus.bus_name}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 m-0">
              {bus.vehicle_number} • {bus.service_type || 'Non AC'}
            </p>
          </div>
        </div>

        {isLive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        ) : isStale ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Signal Stale
          </span>
        ) : isNotTracking ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Not Tracking
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            Scheduled
          </span>
        )}
      </div>

      {/* Timetable Stop Row */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Boarding</span>
          <strong className="text-sm font-black text-slate-900 block">
            {bus.boarding_planned_time || '10:40 AM'}
          </strong>
          <span className="text-slate-600 font-semibold">{bus.boarding_stop || currentStop}</span>
        </div>

        <div className="text-slate-400 font-black text-sm px-2 select-none">
          →
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Arrival</span>
          <strong className="text-sm font-black text-slate-900 block">
            {bus.destination_planned_time || '12:15 PM'}
          </strong>
          <span className="text-slate-600 font-semibold">{bus.destination_stop || destination}</span>
        </div>
      </div>

      {/* Conductor Details if assigned */}
      {bus.conductor_name && (
        <div className="text-[11px] text-slate-500 font-medium">
          <strong className="text-slate-700">Conductor:</strong> {bus.conductor_name} ({bus.conductor_phone || 'Assigned'})
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {canTrack ? (
          <>
            <button
              type="button"
              onClick={() => onTrack(bus)}
              className="py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <MapPin size={14} strokeWidth={2.4} />
              <span>Track Bus</span>
            </button>

            <button
              type="button"
              onClick={() => onViewDetails(bus)}
              className="py-2.5 bg-white border border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-800 font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              View Details
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onViewDetails(bus)}
            className="col-span-2 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 active:scale-98 text-slate-800 font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            View Details &amp; Stop Timetable
          </button>
        )}
      </div>
    </div>
  )
}
