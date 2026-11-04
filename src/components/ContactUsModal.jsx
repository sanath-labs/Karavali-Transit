import { Phone, X, MapPin, AlertTriangle } from 'lucide-react'

export default function ContactUsModal({ isOpen, onClose }) {
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
            <Phone size={20} className="text-blue-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
              Contact Karavali-Transit
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

        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-slate-600">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Phone size={18} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 m-0">
                Coastal Transit Helpline
              </h4>
              <p className="text-sm font-black text-blue-700 m-0 mt-0.5">
                +91 824 244 5566
              </p>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                Operating Hours: 06:00 AM – 10:00 PM (Daily)
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 m-0">
                Depot Coordination Office
              </h4>
              <p className="text-xs text-slate-700 font-medium m-0 mt-0.5">
                Statebank Bus Terminus Complex, Mangaluru – 575001, Karnataka
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 m-0">
                Transit Emergency Support
              </h4>
              <p className="text-xs text-slate-700 font-medium m-0 mt-0.5">
                For road incidents or service delays along NH-66, dial 112 or notify station master.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
