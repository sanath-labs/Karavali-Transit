import { Bus, Clock, Gauge, RotateCw, AlertCircle, Compass } from 'lucide-react'

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
    <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[420px] z-10 select-none">
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5">
        {/* Header: Bus Title, Vehicle Number & Real-time Status Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Bus size={20} strokeWidth={2.4} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight m-0">
                {bus.bus_name}
              </h3>
              <p className="text-xs font-mono font-bold text-slate-600 m-0 mt-0.5">
                {bus.vehicle_number}
              </p>
            </div>
          </div>

          {/* Status Indicators: LIVE, LOCATION STALE, NOT TRACKING, OFFLINE */}
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE GPS
            </span>
          ) : isStale ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              SIGNAL STALE
            </span>
          ) : isNotTracking ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              NOT TRACKING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              OFFLINE
            </span>
          )}
        </div>

        {/* Real Journey Details & Speed vs Scheduled Arrival */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* Destination / Next Stop */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
              <Compass size={11} className="text-blue-600" />
              <span>{nextStop ? 'Next Corridor Stop' : 'Destination Stop'}</span>
            </span>
            <strong className="text-sm font-black text-slate-900 mt-1 block truncate">
              {nextStop || journeyInfo?.to || bus.destination || 'Kundapura'}
            </strong>
          </div>

          {/* Distinguish Scheduled Arrival from Live Telemetry Speed */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            {isLive ? (
              <>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <Gauge size={11} className="text-emerald-600" />
                  <span>Telemetry Speed</span>
                </div>
                <strong className="text-sm font-black text-emerald-800 mt-1 block">
                  {telemetry?.speed || 0} km/h
                </strong>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <Clock size={11} className="text-slate-500" />
                  <span>Scheduled Arrival</span>
                </div>
                <strong className="text-sm font-black text-slate-900 mt-1 block">
                  {bus.destination_planned_time || 'On Timetable'}
                </strong>
              </>
            )}
          </div>
        </div>

        {/* Conductor & Planned Departure Info */}
        {bus.conductor_name && (
          <div className="text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
            <span>
              Crew: <strong className="text-slate-800">{bus.conductor_name}</strong>
            </span>
            {bus.departure_time && (
              <span className="text-[11px] font-bold text-slate-500">
                Dep: {bus.departure_time}
              </span>
            )}
          </div>
        )}

        {/* GPS Freshness and Availability Status Message */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
          {isLive ? (
            <div className="flex items-center gap-1.5 text-emerald-700">
              <RotateCw size={13} className="animate-spin text-emerald-600 shrink-0" />
              <span className="truncate">
                Last updated: {lastUpdateFormatted || 'Just now'} ({secondsAgo}s ago)
              </span>
            </div>
          ) : isStale ? (
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span className="truncate">
                Location stale: Last signal received {secondsAgo}s ago
              </span>
            </div>
          ) : isNotTracking ? (
            <div className="flex items-center gap-1.5 text-blue-700">
              <Clock size={13} className="text-blue-500 shrink-0" />
              <span className="truncate">
                Conductor GPS not started • Bus operating on timetable
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <AlertCircle size={13} className="text-slate-400 shrink-0" />
              <span className="truncate">
                Bus offline • Showing scheduled corridor timetable
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
