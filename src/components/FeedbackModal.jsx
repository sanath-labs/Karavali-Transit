import { useState } from 'react'
import { MessageSquare, X, CheckCircle2 } from 'lucide-react'
import { apiUrl } from '../api.js'

export default function FeedbackModal({ isOpen, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('Service Quality')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl('/api/public/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Passenger',
          email: email.trim(),
          category,
          rating,
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setMessage('')
      }
    } catch (err) {
      console.error('Feedback submit failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs cursor-pointer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 m-0">
              Passenger Feedback
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

        <div className="p-5 overflow-y-auto">
          {success ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
              <h4 className="text-sm font-extrabold text-slate-900">
                Thank You for Your Feedback
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Your remarks have been recorded to help maintain coastal transit quality and reliability.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false)
                  onClose()
                }}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Shetty"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="ramesh@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Feedback Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-bold bg-white focus:border-blue-600 outline-none cursor-pointer"
                >
                  <option value="Service Quality">Service Quality &amp; Comfort</option>
                  <option value="Punctuality">Punctuality &amp; Timing</option>
                  <option value="Conductor Behavior">Conductor Assistance</option>
                  <option value="App Usability">App &amp; Tracking Accuracy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`w-9 h-9 rounded-xl border font-bold text-xs flex items-center justify-center cursor-pointer transition ${
                        rating >= star
                          ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Your Comments <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Share details regarding your commute experience along NH-66..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-medium focus:border-blue-600 outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
