import { Bus, MapPin, ChevronDown, ArrowUpDown, Search } from 'lucide-react'

export default function JourneySearchCard({
  currentStop,
  destination,
  fromDropdownOpen,
  setFromDropdownOpen,
  toDropdownOpen,
  setToDropdownOpen,
  fromQuery,
  setFromQuery,
  toQuery,
  setToQuery,
  fromSuggestions,
  toSuggestions,
  onSelectFromStop,
  onSelectToStop,
  onSwapStops,
  onSearchBuses,
  loadingBuses,
}) {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-5 select-none">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Bus size={18} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 m-0 leading-tight">
            Plan Your Journey
          </h2>
          <p className="text-xs font-medium text-slate-500 m-0">
            Select your boarding bus stop and destination stop
          </p>
        </div>
      </div>

      {/* Responsive Desktop Horizontal / Mobile Vertical Form */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] items-end gap-3 sm:gap-4">
        {/* Current Bus Stop (From) */}
        <div className="relative">
          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin size={13} className="text-emerald-600 shrink-0" />
            <span>Boarding Stop</span>
          </label>

          <div
            onClick={() => {
              setFromDropdownOpen(!fromDropdownOpen)
              setToDropdownOpen(false)
            }}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-600 cursor-pointer transition"
          >
            <span className="text-sm font-bold text-slate-900">
              {currentStop}
            </span>
            <ChevronDown size={17} className="text-slate-400" />
          </div>

          {fromDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-60 overflow-y-auto">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Type to filter stops..."
                  value={fromQuery}
                  onChange={(e) => setFromQuery(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-3 py-2 outline-none"
                  autoFocus
                />
              </div>
              {fromSuggestions.map((s) => (
                <button
                  key={s.stop_id}
                  type="button"
                  onClick={() => {
                    onSelectFromStop(s.stop_name)
                    setFromDropdownOpen(false)
                    setFromQuery('')
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{s.stop_name}</span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {s.stop_name_kn}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Swap Button */}
        <div className="flex justify-center md:pb-1">
          <button
            type="button"
            onClick={onSwapStops}
            className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-blue-500 text-slate-700 hover:text-blue-600 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
            title="Swap Boarding and Destination"
            aria-label="Swap Boarding and Destination"
          >
            <ArrowUpDown size={17} strokeWidth={2.4} />
          </button>
        </div>

        {/* Destination (To) */}
        <div className="relative">
          <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin size={13} className="text-rose-600 shrink-0" />
            <span>Destination</span>
          </label>

          <div
            onClick={() => {
              setToDropdownOpen(!toDropdownOpen)
              setFromDropdownOpen(false)
            }}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-600 cursor-pointer transition"
          >
            <span className="text-sm font-bold text-slate-900">
              {destination}
            </span>
            <ChevronDown size={17} className="text-slate-400" />
          </div>

          {toDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-60 overflow-y-auto">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Type to filter stops..."
                  value={toQuery}
                  onChange={(e) => setToQuery(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-100 rounded-lg px-3 py-2 outline-none"
                  autoFocus
                />
              </div>
              {toSuggestions.map((s) => (
                <button
                  key={s.stop_id}
                  type="button"
                  onClick={() => {
                    onSelectToStop(s.stop_name)
                    setToDropdownOpen(false)
                    setToQuery('')
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{s.stop_name}</span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {s.stop_name_kn}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Button */}
        <div className="w-full md:w-auto">
          <button
            type="button"
            onClick={onSearchBuses}
            disabled={loadingBuses}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <Search size={18} strokeWidth={2.4} />
            <span>{loadingBuses ? 'Searching...' : 'Search Buses'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
