export default function Footer({ onNavigatePassenger, onNavigateOwner, onNavigateConductor }) {
  return (
    <footer className="w-full bg-white border-t border-slate-200 py-6 px-4 sm:px-6 text-xs text-slate-500 mt-auto select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-800">Karavali-Transit</span>
          <span>•</span>
          <span>Mangaluru – Kundapura NH-66 Private Bus Network</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={onNavigatePassenger}
            className="hover:text-blue-600 cursor-pointer transition"
          >
            Passenger Home
          </button>
          <button
            type="button"
            onClick={onNavigateOwner}
            className="hover:text-blue-600 cursor-pointer transition"
          >
            Fleet Owner
          </button>
          <button
            type="button"
            onClick={onNavigateConductor}
            className="hover:text-blue-600 cursor-pointer transition"
          >
            Conductor
          </button>
        </div>
      </div>
    </footer>
  )
}
