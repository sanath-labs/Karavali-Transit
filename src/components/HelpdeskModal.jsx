import { HelpCircle, X } from 'lucide-react'

export default function HelpdeskModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-blue-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
              Helpdesk &amp; Transit Guidelines
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

        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">
              What is Karavali-Transit?
            </h4>
            <p className="m-0 leading-relaxed">
              Karavali-Transit is a real-time public passenger tracking and information network designed for private buses operating on the Mangaluru – Kundapura NH-66 corridor.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">
              How accurate is live bus tracking?
            </h4>
            <p className="m-0 leading-relaxed">
              Bus locations are streamed directly from onboard conductor mobile GPS terminals. Active buses display a green live badge with current position and estimated arrival time.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">
              Are passengers required to register or login?
            </h4>
            <p className="m-0 leading-relaxed">
              No registration or personal information is required. The passenger portal is 100% open and accessible to all commuters.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">
              What stops are served by this network?
            </h4>
            <p className="m-0 leading-relaxed">
              The network strictly serves the 9 official NH-66 stops: Mangaluru, Kuntikana, Kulur, Surathkal, Mulki, Padubidri, Kaup, Udupi, and Kundapura.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
