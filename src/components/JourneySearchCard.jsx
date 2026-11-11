import { useState, useEffect, useRef } from 'react'
import { Bus, MapPin, ChevronDown, ArrowUpDown, Search, CheckCircle2 } from 'lucide-react'

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
  lang = 'en',
}) {
  const fromContainerRef = useRef(null)
  const toContainerRef = useRef(null)
  const [fromHighlightedIdx, setFromHighlightedIdx] = useState(0)
  const [toHighlightedIdx, setToHighlightedIdx] = useState(0)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (fromContainerRef.current && !fromContainerRef.current.contains(e.target)) {
        setFromDropdownOpen(false)
      }
      if (toContainerRef.current && !toContainerRef.current.contains(e.target)) {
        setToDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setFromDropdownOpen, setToDropdownOpen])

  // Derive safe highlighted indices
  const safeFromIdx = Math.min(fromHighlightedIdx, Math.max(0, fromSuggestions.length - 1))
  const safeToIdx = Math.min(toHighlightedIdx, Math.max(0, toSuggestions.length - 1))

  // Bilingual strings
  const text = {
    heading: lang === 'kn' ? 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕಾಗಿದೆ?' : 'Where do you want to go?',
    subheading:
      lang === 'kn'
        ? 'ಕರಾವಳಿ ಹೆದ್ದಾರಿಯ (NH-66) ಖಾಸಗಿ ಎಕ್ಸ್‌ಪ್ರೆಸ್ ಬಸ್‌ಗಳ ವೇಳಾಪಟ್ಟಿ ಮತ್ತು ಲೈವ್ ಜಿಪಿಎಸ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಹುಡುಕಿ.'
        : 'Search private express buses along the NH-66 coastal highway corridor and track your bus in real time.',
    noLoginBadge:
      lang === 'kn'
        ? 'ಪ್ರಯಾಣಿಕರ ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ • ಉಚಿತ ಸಾರ್ವಜನಿಕ ಸೇವೆ'
        : 'No passenger login required • Free public transit search',
    boardingLabel: lang === 'kn' ? 'ಹತ್ತುವ ನಿಲ್ದಾಣ (Boarding)' : 'Boarding Stop',
    destinationLabel: lang === 'kn' ? 'ಇಳಿಯುವ ನಿಲ್ದಾಣ (Destination)' : 'Destination Stop',
    filterPlaceholder: lang === 'kn' ? 'ನಿಲ್ದಾಣದ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ...' : 'Type stop name to filter...',
    searchBtn: lang === 'kn' ? 'ಲಭ್ಯವಿರುವ ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ' : 'Find Available Buses',
    searchingBtn: lang === 'kn' ? 'ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : 'Finding Buses...',
    swapTitle: lang === 'kn' ? 'ನಿಲ್ದಾಣಗಳನ್ನು ಅದಲು ಬದಲು ಮಾಡಿ' : 'Swap Boarding and Destination stops',
    noStopsMatch: lang === 'kn' ? 'ಯಾವುದೇ ನಿಲ್ದಾಣ ಸಿಗಲಿಲ್ಲ' : 'No matching corridor stop found',
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-5 select-none">
      {/* Header: Simple Heading, Explanation & Login-Free Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bus size={20} strokeWidth={2.4} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 m-0 tracking-tight">
              {text.heading}
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-600 m-0 pt-1 leading-relaxed max-w-2xl">
            {text.subheading}
          </p>
        </div>

        {/* Prominent "No passenger login required" Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start shrink-0 shadow-2xs">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span>{text.noLoginBadge}</span>
        </div>
      </div>

      {/* Responsive Search Form: Desktop Horizontal Grid / Mobile Vertical Stack */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto] items-end gap-3 sm:gap-4">
        {/* 1. Boarding Stop (From) */}
        <div className="relative" ref={fromContainerRef}>
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin size={14} className="text-emerald-600 shrink-0" />
            <span>{text.boardingLabel}</span>
          </label>

          <div
            role="combobox"
            aria-expanded={fromDropdownOpen}
            aria-haspopup="listbox"
            aria-label="Select boarding bus stop"
            tabIndex={0}
            onClick={() => {
              setFromDropdownOpen(!fromDropdownOpen)
              setToDropdownOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault()
                setFromDropdownOpen(true)
                setToDropdownOpen(false)
              }
            }}
            className="flex items-center justify-between px-4 py-3.5 min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                {currentStop}
              </span>
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                (NH-66 Corridor)
              </span>
            </div>
            <ChevronDown
              size={18}
              className={`text-slate-500 transition-transform ${fromDropdownOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {/* From Suggestions Dropdown */}
          {fromDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 max-h-72 overflow-y-auto">
              <div className="px-3 pb-2 border-b border-slate-100">
                <input
                  type="text"
                  placeholder={text.filterPlaceholder}
                  value={fromQuery}
                  onChange={(e) => {
                    setFromQuery(e.target.value)
                    setFromHighlightedIdx(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setFromDropdownOpen(false)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setFromHighlightedIdx((prev) =>
                        prev < fromSuggestions.length - 1 ? prev + 1 : 0
                      )
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setFromHighlightedIdx((prev) =>
                        prev > 0 ? prev - 1 : fromSuggestions.length - 1
                      )
                    } else if (e.key === 'Enter' && fromSuggestions[safeFromIdx]) {
                      e.preventDefault()
                      onSelectFromStop(fromSuggestions[safeFromIdx].stop_name)
                      setFromDropdownOpen(false)
                      setFromQuery('')
                    }
                  }}
                  className="w-full text-xs font-semibold bg-slate-100 focus:bg-white text-slate-900 rounded-lg px-3 py-2.5 border border-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div role="listbox" className="pt-1">
                {fromSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 text-center font-medium">
                    {text.noStopsMatch}
                  </div>
                ) : (
                  fromSuggestions.map((s, idx) => (
                    <button
                      key={s.stop_id}
                      type="button"
                      role="option"
                      aria-selected={s.stop_name === currentStop}
                      onClick={() => {
                        onSelectFromStop(s.stop_name)
                        setFromDropdownOpen(false)
                        setFromQuery('')
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between cursor-pointer transition ${
                        idx === safeFromIdx
                          ? 'bg-blue-50 text-blue-900'
                          : s.stop_name === currentStop
                          ? 'bg-slate-100 text-slate-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {s.stop_id}
                        </span>
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {s.stop_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold shrink-0 ml-2">
                        {s.stop_name_kn}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Swap Button */}
        <div className="flex justify-center md:pb-1">
          <button
            type="button"
            onClick={onSwapStops}
            className="w-11 h-11 rounded-xl border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-500 text-slate-700 hover:text-blue-600 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            title={text.swapTitle}
            aria-label={text.swapTitle}
          >
            <ArrowUpDown size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* 3. Destination (To) */}
        <div className="relative" ref={toContainerRef}>
          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin size={14} className="text-rose-600 shrink-0" />
            <span>{text.destinationLabel}</span>
          </label>

          <div
            role="combobox"
            aria-expanded={toDropdownOpen}
            aria-haspopup="listbox"
            aria-label="Select destination bus stop"
            tabIndex={0}
            onClick={() => {
              setToDropdownOpen(!toDropdownOpen)
              setFromDropdownOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault()
                setToDropdownOpen(true)
                setFromDropdownOpen(false)
              }
            }}
            className="flex items-center justify-between px-4 py-3.5 min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 hover:bg-white hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                {destination}
              </span>
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                (NH-66 Corridor)
              </span>
            </div>
            <ChevronDown
              size={18}
              className={`text-slate-500 transition-transform ${toDropdownOpen ? 'rotate-180' : ''}`}
            />
          </div>

          {/* To Suggestions Dropdown */}
          {toDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 max-h-72 overflow-y-auto">
              <div className="px-3 pb-2 border-b border-slate-100">
                <input
                  type="text"
                  placeholder={text.filterPlaceholder}
                  value={toQuery}
                  onChange={(e) => {
                    setToQuery(e.target.value)
                    setToHighlightedIdx(0)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setToDropdownOpen(false)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setToHighlightedIdx((prev) =>
                        prev < toSuggestions.length - 1 ? prev + 1 : 0
                      )
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setToHighlightedIdx((prev) =>
                        prev > 0 ? prev - 1 : toSuggestions.length - 1
                      )
                    } else if (e.key === 'Enter' && toSuggestions[safeToIdx]) {
                      e.preventDefault()
                      onSelectToStop(toSuggestions[safeToIdx].stop_name)
                      setToDropdownOpen(false)
                      setToQuery('')
                    }
                  }}
                  className="w-full text-xs font-semibold bg-slate-100 focus:bg-white text-slate-900 rounded-lg px-3 py-2.5 border border-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div role="listbox" className="pt-1">
                {toSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 text-center font-medium">
                    {text.noStopsMatch}
                  </div>
                ) : (
                  toSuggestions.map((s, idx) => (
                    <button
                      key={s.stop_id}
                      type="button"
                      role="option"
                      aria-selected={s.stop_name === destination}
                      onClick={() => {
                        onSelectToStop(s.stop_name)
                        setToDropdownOpen(false)
                        setToQuery('')
                      }}
                      className={`w-full px-4 py-2.5 text-left flex items-center justify-between cursor-pointer transition ${
                        idx === safeToIdx
                          ? 'bg-blue-50 text-blue-900'
                          : s.stop_name === destination
                          ? 'bg-slate-100 text-slate-900'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {s.stop_id}
                        </span>
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {s.stop_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-semibold shrink-0 ml-2">
                        {s.stop_name_kn}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. Large "Find Available Buses" Button */}
        <div className="w-full md:w-auto">
          <button
            type="button"
            onClick={onSearchBuses}
            disabled={loadingBuses}
            className="w-full md:w-auto min-h-[48px] px-7 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm sm:text-base rounded-xl shadow-xs flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Search size={19} strokeWidth={2.6} className="shrink-0" />
            <span>{loadingBuses ? text.searchingBtn : text.searchBtn}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
