import { useState, useEffect, useRef } from 'react'
import { ArrowLeftRight, Bus, CheckCircle2, ChevronDown, MapPin, Search } from 'lucide-react'
import { OFFICIAL_9_CORRIDOR_STOPS } from '../transitUtils.js'

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

  const safeFromIdx = Math.min(fromHighlightedIdx, Math.max(0, fromSuggestions.length - 1))
  const safeToIdx = Math.min(toHighlightedIdx, Math.max(0, toSuggestions.length - 1))
  const boardingStop = OFFICIAL_9_CORRIDOR_STOPS.find((stop) => stop.stop_name === currentStop)
  const destinationStop = OFFICIAL_9_CORRIDOR_STOPS.find((stop) => stop.stop_name === destination)
  const isJourneyValid =
    Boolean(boardingStop && destinationStop && boardingStop.stop_id < destinationStop.stop_id)

  const text = {
    heading: lang === 'kn' ? 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕಾಗಿದೆ?' : 'Plan your journey',
    subheading:
      lang === 'kn'
        ? 'ಕರಾವಳಿ ಹೆದ್ದಾರಿಯ (NH-66) ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ.'
        : 'Choose your boarding and destination stops along the NH-66 corridor.',
    noLoginBadge:
      lang === 'kn'
        ? 'ಪ್ರಯಾಣಿಕರ ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ'
        : 'No passenger login required',
    boardingLabel: lang === 'kn' ? 'ಹತ್ತುವ ನಿಲ್ದಾಣ' : 'From',
    destinationLabel: lang === 'kn' ? 'ಇಳಿಯುವ ನಿಲ್ದಾಣ' : 'To',
    filterPlaceholder: lang === 'kn' ? 'ನಿಲ್ದಾಣವನ್ನು ಹುಡುಕಿ...' : 'Search stops by name or landmark',
    searchBtn: lang === 'kn' ? 'ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಿ' : 'Find buses',
    searchingBtn: lang === 'kn' ? 'ಬಸ್‌ಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ...' : 'Searching for buses...',
    swapTitle: lang === 'kn' ? 'ಪ್ರಾರಂಭ ಮತ್ತು ಗಮ್ಯಸ್ಥಾನ ಬದಲಾಯಿಸಿ' : 'Swap boarding and destination',
    noStopsMatch: lang === 'kn' ? 'ಯಾವುದೇ ನಿಲ್ದಾಣ ಸಿಗಲಿಲ್ಲ' : 'No matching corridor stop found',
    selectStop: lang === 'kn' ? 'ನಿಲ್ದಾಣ ಆಯ್ಕೆಮಾಡಿ' : 'Select a stop',
    routeHint: lang === 'kn' ? 'NH-66 ಮಾರ್ಗದಲ್ಲಿ ಉತ್ತರದ ಕಡೆಗೆ' : 'Northbound along the NH-66 corridor',
    missingStops:
      lang === 'kn'
        ? 'ಹತ್ತುವ ಮತ್ತು ಇಳಿಯುವ ನಿಲ್ದಾಣಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ.'
        : 'Choose both a boarding stop and a destination.',
    sameStop:
      lang === 'kn'
        ? 'ಹತ್ತುವ ಮತ್ತು ಇಳಿಯುವ ನಿಲ್ದಾಣಗಳು ಬೇರೆಬೇರೆಯಾಗಿರಬೇಕು.'
        : 'Choose two different stops for your journey.',
    invalidDirection:
      lang === 'kn'
        ? 'ಈ ಹುಡುಕಾಟವು NH-66 ಮಾರ್ಗದಲ್ಲಿ ಉತ್ತರದ ಕಡೆಗೆ ಮಾತ್ರ ಲಭ್ಯವಿದೆ. ಮುಂದಿನ ನಿಲ್ದಾಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ.'
        : 'This search covers northbound NH-66 journeys. Choose a destination north of your boarding stop.',
  }

  const validationMessage = !boardingStop || !destinationStop
    ? text.missingStops
    : boardingStop.stop_id === destinationStop.stop_id
      ? text.sameStop
      : !isJourneyValid
        ? text.invalidDirection
        : ''

  const chooseFromStop = (stopName) => {
    onSelectFromStop(stopName)
    setFromDropdownOpen(false)
    setFromQuery('')
    setFromHighlightedIdx(0)
  }

  const chooseToStop = (stopName) => {
    onSelectToStop(stopName)
    setToDropdownOpen(false)
    setToQuery('')
    setToHighlightedIdx(0)
  }

  const handleSuggestionKeyDown = (e, suggestions, highlightedIdx, setHighlightedIdx, onSelect, setDropdownOpen, setQuery) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false)
      setQuery('')
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setHighlightedIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault()
      setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions[highlightedIdx]) onSelect(suggestions[highlightedIdx].stop_name)
    }
  }

  const renderSuggestions = ({
    suggestions,
    selectedStop,
    highlightedIdx,
    listId,
    query,
    setQuery,
    setHighlightedIdx,
    onSelect,
    setDropdownOpen,
  }) => (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      <label className="sr-only" htmlFor={`${listId}-filter`}>
        {text.filterPlaceholder}
      </label>
      <input
        id={`${listId}-filter`}
        type="search"
        role="combobox"
        aria-label={text.filterPlaceholder}
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={
          suggestions[highlightedIdx]
            ? `${listId}-option-${suggestions[highlightedIdx].stop_id}`
            : undefined
        }
        placeholder={text.filterPlaceholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlightedIdx(0)
        }}
        onKeyDown={(e) =>
          handleSuggestionKeyDown(
            e,
            suggestions,
            highlightedIdx,
            setHighlightedIdx,
            onSelect,
            setDropdownOpen,
            setQuery
          )
        }
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
        autoFocus
      />
      <div id={listId} role="listbox" className="mt-1 max-h-56 overflow-y-auto">
        {suggestions.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center text-sm font-medium text-slate-500">
            {text.noStopsMatch}
          </p>
        ) : (
          suggestions.map((stop, idx) => (
            <button
              key={stop.stop_id}
              id={`${listId}-option-${stop.stop_id}`}
              type="button"
              role="option"
              aria-selected={stop.stop_name === selectedStop}
              onClick={() => onSelect(stop.stop_name)}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                idx === highlightedIdx
                  ? 'bg-blue-50 text-blue-900'
                  : stop.stop_name === selectedStop
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                  {stop.stop_id}
                </span>
                <span className="truncate text-sm font-bold">{stop.stop_name}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-500">{stop.stop_name_kn}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )

  return (
    <section className="journey-search-card rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 sm:p-6 lg:p-7">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Bus size={22} strokeWidth={2.3} />
          </div>
          <div>
            <h1 className="m-0 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              {text.heading}
            </h1>
            <p className="m-0 mt-1 text-sm leading-relaxed text-slate-600">{text.subheading}</p>
          </div>
        </div>
        <div className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{text.noLoginBadge}</span>
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (isJourneyValid && !loadingBuses) onSearchBuses()
        }}
      >
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
          <div className="relative z-20" ref={fromContainerRef}>
            <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
              <MapPin size={15} className="text-emerald-600" />
              {text.boardingLabel}
            </label>
            <button
              type="button"
              aria-expanded={fromDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="boarding-stop-list"
              aria-describedby={validationMessage ? 'journey-validation-message' : undefined}
              aria-label={`${text.boardingLabel}: ${currentStop || text.selectStop}`}
              onClick={() => {
                setFromDropdownOpen(!fromDropdownOpen)
                setToDropdownOpen(false)
              }}
              className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 text-left transition hover:border-blue-400 hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
                fromDropdownOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'border-slate-200'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-black text-slate-900">
                  {currentStop || text.selectStop}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">NH-66 corridor</span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-slate-500 transition-transform ${fromDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {fromDropdownOpen &&
              renderSuggestions({
                suggestions: fromSuggestions,
                selectedStop: currentStop,
                highlightedIdx: safeFromIdx,
                listId: 'boarding-stop-list',
                query: fromQuery,
                setQuery: setFromQuery,
                setHighlightedIdx: setFromHighlightedIdx,
                onSelect: chooseFromStop,
                setDropdownOpen: setFromDropdownOpen,
              })}
          </div>

          <button
            type="button"
            onClick={onSwapStops}
            aria-label={text.swapTitle}
            title={text.swapTitle}
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 active:scale-95 md:mb-1"
          >
            <ArrowLeftRight size={18} strokeWidth={2.4} className="rotate-90 md:rotate-0" />
          </button>

          <div className="relative z-10" ref={toContainerRef}>
            <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
              <MapPin size={15} className="text-rose-600" />
              {text.destinationLabel}
            </label>
            <button
              type="button"
              aria-expanded={toDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="destination-stop-list"
              aria-describedby={validationMessage ? 'journey-validation-message' : undefined}
              aria-label={`${text.destinationLabel}: ${destination || text.selectStop}`}
              onClick={() => {
                setToDropdownOpen(!toDropdownOpen)
                setFromDropdownOpen(false)
              }}
              className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 text-left transition hover:border-blue-400 hover:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
                toDropdownOpen ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'border-slate-200'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-black text-slate-900">
                  {destination || text.selectStop}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-slate-500">NH-66 corridor</span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-slate-500 transition-transform ${toDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {toDropdownOpen &&
              renderSuggestions({
                suggestions: toSuggestions,
                selectedStop: destination,
                highlightedIdx: safeToIdx,
                listId: 'destination-stop-list',
                query: toQuery,
                setQuery: setToQuery,
                setHighlightedIdx: setToHighlightedIdx,
                onSelect: chooseToStop,
                setDropdownOpen: setToDropdownOpen,
              })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            id="journey-validation-message"
            role={validationMessage ? 'alert' : 'status'}
            aria-live="polite"
            className={`m-0 min-h-5 text-xs font-semibold ${
              validationMessage ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            {validationMessage || text.routeHint}
          </p>
          <button
            type="submit"
            disabled={loadingBuses || !isJourneyValid}
            className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-700 px-6 py-3 text-sm font-black text-white shadow-md shadow-blue-900/15 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none sm:w-auto"
          >
            <Search size={18} strokeWidth={2.6} className="shrink-0" />
            <span>{loadingBuses ? text.searchingBtn : text.searchBtn}</span>
          </button>
        </div>
      </form>
    </section>
  )
}
