import { Bus, Clock, Gauge, RotateCw } from 'lucide-react'

export default function LiveTrackingHud({
  bus,
  telemetry,
  status = 'OFFLINE',
  secondsAgo = 0,
  nextStop = '',
  journeyInfo = null,
}) {
  if (!bus) return null

  // Compute display status
  const normalizedStatus = (
    telemetry?.tracking_status ||
    status ||
    (telemetry?.latitude && telemetry?.longitude ? 'LIVE' : 'NOT TRACKING')
  ).toUpperCase()

  const isLive = normalizedStatus === 'LIVE'
  const isStale = normalizedStatus === 'LOCATION STALE'
  const isNotTracking = normalizedStatus === 'NOT TRACKING'

  // Formatted last update time
  const lastUpdateFormatted = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-10 select-none">
      <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-200 space-y-3">
        {/* Bus Title & Real-time Status Badge */}
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

          {/* Status Indicators: LIVE, LOCATION STALE, NOT TRACKING, OFFLINE */}
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          ) : isStale ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              LOCATION STALE
            </span>
          ) : isNotTracking ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              NOT TRACKING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              OFFLINE
            </span>
          )}
        </div>

        {/* Real Journey Details & Speed */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Destination Stop
            </span>
            <strong className="text-sm font-black text-slate-900 mt-0.5 block truncate">
              {journeyInfo?.to || bus.destination || nextStop || 'Kundapura'}
            </strong>
          </div>

          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <div className="flex items-center gap-1">
              <Gauge size={12} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {isLive ? 'Telemetry Speed' : 'Scheduled Arrival'}
              </span>
            </div>
            <strong className="text-sm font-black text-slate-900 mt-0.5 block">
              {isLive
                ? `${telemetry?.speed || 0} km/h`
                : bus.destination_planned_time || 'On Timetable'}
            </strong>
          </div>
        </div>

        {/* Conductor & Planned Timing if available */}
        {bus.conductor_name && (
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Crew: <strong className="text-slate-700">{bus.conductor_name}</strong></span>
            {bus.departure_time && <span>Dep: {bus.departure_time}</span>}
          </div>
        )}

        {/* Freshness Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <>
                <RotateCw size={12} className="text-emerald-600 animate-spin" />
                <span>
                  Last Updated: {lastUpdateFormatted || 'Just now'} • ({secondsAgo}s ago)
                </span>
              </>
            ) : isStale ? (
              <>
                <Clock size={12} className="text-amber-600" />
                <span>
                  Signal Stale: Last seen {secondsAgo}s ago
                </span>
              </>
            ) : (
              <>
                <Clock size={12} className="text-slate-400" />
                <span>
                  {isNotTracking ? 'Waiting for conductor GPS stream' : 'Bus not on active shift'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
