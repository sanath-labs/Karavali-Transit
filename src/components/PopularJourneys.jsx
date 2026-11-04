export default function PopularJourneys({ routes = [], onSelectJourney }) {
  if (!routes || routes.length === 0) return null

  return (
    <div className="pt-4 border-t border-slate-100 select-none">
      <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2.5">
        Popular Journeys Along Corridor
      </span>
      <div className="flex flex-wrap gap-2">
        {routes.map((route) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => onSelectJourney(route.from, route.to)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-800 transition cursor-pointer shadow-2xs"
          >
            {route.from} → {route.to}
          </button>
        ))}
      </div>
    </div>
  )
}
