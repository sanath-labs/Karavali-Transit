import { useState } from 'react'
import { Compass, X, Search, RotateCw } from 'lucide-react'
import { apiUrl } from '../api.js'
import { OFFICIAL_9_CORRIDOR_STOPS } from '../transitUtils.js'

export default function FindBusStopModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('name')
  const [query, setQuery] = useState('')
  const [nearMeStops, setNearMeStops] = useState([])
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [nearMeError, setNearMeError] = useState('')

  if (!isOpen) return null

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

  const filteredStops = OFFICIAL_9_CORRIDOR_STOPS.filter((stop) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    if (tab === 'name') {
      return (
        stop.stop_name.toLowerCase().includes(q) ||
        stop.stop_name_kn.includes(q) ||
        stop.alternative_names.toLowerCase().includes(q)
      )
    }
    if (tab === 'landmark') {
      return (
        stop.nearby_landmarks.toLowerCase().includes(q) ||
        stop.locality.toLowerCase().includes(q) ||
        stop.alternative_names.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
        onClick={onClose}
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
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('name')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'name'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            By Stop Name
          </button>
          <button
            type="button"
            onClick={() => setTab('landmark')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'landmark'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            By Landmark
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('nearme')
              handleFindStopsNearMe()
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              tab === 'nearme'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Nearby (GPS)
          </button>
        </div>

        {/* Search Input for Name & Landmark */}
        {tab !== 'nearme' && (
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={
                  tab === 'name'
                    ? 'Search official stop name (e.g. Surathkal)...'
                    : 'Search landmark (e.g. NITK, Temple, Hospital)...'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-600 outline-none"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Stop Results List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {tab === 'nearme' ? (
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
              No matching stops found for &quot;{query}&quot;
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
  )
}
