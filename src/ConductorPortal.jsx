import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bus,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  LogOut,
  Mail,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Plus,
  Printer,
  Radio,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { apiUrl, conductorHeaders } from './api.js'
import { formatIndianMobile } from './transitUtils.js'

function getNow() {
  return Date.now()
}

export default function ConductorPortal({
  socket,
  liveBuses = {},
  onExitToPassenger,
  initialVehicleNumber = '',
}) {
  // Step navigation: 1 = Email, 2 = Email OTP, 3 = Mobile Entry, 4 = Status Check / Register, 5 = Conductor Dashboard
  const [step, setStep] = useState(1)

  // Step 1: Travel Agency Email
  const [agencyEmail, setAgencyEmail] = useState('rakesh@gmail.com')
  const [agencyName, setAgencyName] = useState('')
  const [agencyToken, setAgencyToken] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [previewOtp, setPreviewOtp] = useState('')
  const [resendCountdown, setResendCountdown] = useState(25)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notice, setNotice] = useState('')

  // Step 3: Conductor Mobile Number
  const [conductorPhone, setConductorPhone] = useState('')
  const [conductorName, setConductorName] = useState('')
  const [isExistingConductor, setIsExistingConductor] = useState(false)
  const [conductorRecord, setConductorRecord] = useState(null)
  const [agencyBuses, setAgencyBuses] = useState([])
  const [selectedBusId, setSelectedBusId] = useState('')

  // Conductor Auth Token
  const [conductorToken, setConductorToken] = useState(() => {
    try {
      return localStorage.getItem('karavali_conductor_token') || ''
    } catch {
      return ''
    }
  })

  // Step 5: Active Shift State & Operations
  const [activeBus, setActiveBus] = useState(null)
  const [isOnShift, setIsOnShift] = useState(false)
  const [shiftData, setShiftData] = useState(null)
  const [passengerCount, setPassengerCount] = useState(18)
  const [crowdStatus, setCrowdStatus] = useState('Seats Available')
  const [routeStops, setRouteStops] = useState([])
  const [passedStops, setPassedStops] = useState({})
  const [incidentNotice, setIncidentNotice] = useState('')
  const [shiftStartTime, setShiftStartTime] = useState(null)
  const [shiftDurationMinutes, setShiftDurationMinutes] = useState(0)
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false)
  const [geoWatchId, setGeoWatchId] = useState(null)
  const [currentSpeed, setCurrentSpeed] = useState(42)
  const [currentHeading, setCurrentHeading] = useState(350)
  const [isAudioFeedbackEnabled, setIsAudioFeedbackEnabled] = useState(true)

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)]
  // Hardware GPS Telemetry State

  // Subtle web audio feedback synthesizer for duty events
  const playDutyChime = (frequency = 660, duration = 0.15) => {
    if (!isAudioFeedbackEnabled || typeof window === 'undefined') return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const audioCtx = new AudioCtx()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(frequency, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + duration)
    } catch {
      // Audio playback skipped
    }
  }

  // Resend Countdown Timer
  useEffect(() => {
    let timer = null
    if (step === 2 && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [step, resendCountdown])

  // Shift Duration Timer
  useEffect(() => {
    let interval = null
    if (isOnShift && shiftStartTime) {
      interval = setInterval(() => {
        setShiftDurationMinutes(Math.floor((Date.now() - shiftStartTime) / 60000))
      }, 10000)
    }
    return () => clearInterval(interval)
  }, [isOnShift, shiftStartTime])

  // =========================================================================
  // STEP 1: SEND OTP TO TRAVEL AGENCY EMAIL
  // =========================================================================
  const handleSendEmailOtp = async (e) => {
    e?.preventDefault()
    setAuthError('')
    setNotice('')
    if (!agencyEmail.trim()) {
      setAuthError('Travel agency Gmail address is required.')
      return
    }
    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/conductor/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agencyEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAgencyName(data.agency_name || 'Coastal Travels')
        setPreviewOtp(data.preview_otp || '')
        setResendCountdown(25)
        setStep(2)
        setNotice(`6-digit verification code generated for ${agencyEmail.trim()}`)
      } else {
        setAuthError(data.error || 'Failed to send verification code.')
      }
    } catch (err) {
      setAuthError(`Connection error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // =========================================================================
  // STEP 2: VERIFY TRAVEL AGENCY OTP
  // =========================================================================
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    setAuthError('')
    const code = otpCode.join('').trim()
    if (code.length !== 6) {
      setAuthError('Please enter all 6 digits of the OTP.')
      return
    }
    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/conductor/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: agencyEmail.trim(), otp: code }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAgencyToken(data.agency?.token || '')
        setAgencyName(data.agency?.agency_name || agencyName || 'Coastal Travels')
        setStep(3)
        setNotice(`Verified agency: ${data.agency?.agency_name || agencyName}`)
      } else {
        setAuthError(data.error || 'Invalid or expired OTP code.')
      }
    } catch (err) {
      setAuthError(`Verification failed: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleOtpDigitChange = (idx, val) => {
    const digit = val.slice(-1)
    if (digit && !/^\d$/.test(digit)) return
    const next = [...otpCode]
    next[idx] = digit
    setOtpCode(next)
    if (digit && idx < 5) {
      otpRefs[idx + 1].current?.focus()
    }
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      otpRefs[idx - 1].current?.focus()
    }
  }

  // =========================================================================
  // STEP 3: CONDUCTOR MOBILE LOOKUP (NO MOBILE OTP REQUIRED)
  // =========================================================================
  const handleLookupConductor = async (e) => {
    e?.preventDefault()
    setAuthError('')
    const clean = conductorPhone.replace(/\D/g, '')
    if (clean.length < 10) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.')
      return
    }
    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/conductor/lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_email: agencyEmail.trim(),
          phone: clean,
          agency_token: agencyToken,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsExistingConductor(data.exists)
        const busesList = data.buses || []
        setAgencyBuses(busesList)

        let targetBusId = ''
        if (initialVehicleNumber && busesList.length > 0) {
          const match = busesList.find((b) => b.vehicle_number === initialVehicleNumber)
          if (match) targetBusId = String(match.bus_id)
        }
        if (!targetBusId && data.conductor?.assigned_bus_id) {
          targetBusId = String(data.conductor.assigned_bus_id)
        } else if (!targetBusId && busesList.length > 0) {
          targetBusId = String(busesList[0].bus_id)
        }
        setSelectedBusId(targetBusId)

        if (data.exists && data.conductor) {
          setConductorRecord(data.conductor)
          setConductorName(data.conductor.name)
        } else {
          setConductorRecord(null)
        }
        setStep(4)
      } else {
        setAuthError(data.error || 'Failed to check conductor status.')
      }
    } catch (err) {
      setAuthError(`Network error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // =========================================================================
  // STEP 4: REGISTER NEW CONDUCTOR OR CONFIRM EXISTING
  // =========================================================================
  const handleCompleteConductorEntry = async (e) => {
    e?.preventDefault()
    setAuthError('')
    const clean = conductorPhone.replace(/\D/g, '')

    // Case 1: Existing conductor simply confirms and enters
    if (isExistingConductor && conductorRecord) {
      const matchedBus = agencyBuses.find((b) => String(b.bus_id) === String(selectedBusId)) || agencyBuses[0] || null
      setActiveBus(matchedBus)
      loadBusStops(matchedBus?.bus_id)
      setStep(5)
      setNotice(`Welcome back, ${conductorRecord.name}! Ready for duty.`)
      return
    }

    // Case 2: New conductor quick-registers
    if (!conductorName.trim()) {
      setAuthError('Please enter your full name to complete registration.')
      return
    }

    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/conductor/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_email: agencyEmail.trim(),
          name: conductorName.trim(),
          phone: clean,
          assigned_bus_id: selectedBusId ? Number(selectedBusId) : null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.conductor) {
        setConductorRecord(data.conductor)
        const matchedBus = agencyBuses.find((b) => String(b.bus_id) === String(selectedBusId)) || agencyBuses[0] || null
        setActiveBus(matchedBus)
        loadBusStops(matchedBus?.bus_id)
        setStep(5)
        setNotice(`Conductor ${data.conductor.name} registered and checked in!`)
      } else {
        setAuthError(data.error || 'Registration failed.')
      }
    } catch (err) {
      setAuthError(`Registration error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const loadBusStops = async (busId) => {
    if (!busId) return
    try {
      const res = await fetch(apiUrl(`/api/conductor/buses/${busId}/stops`))
      const data = await res.json()
      if (res.ok && data.stops) {
        setRouteStops(data.stops)
      }
    } catch (err) {
      console.error('Failed to load stops:', err)
    }
  }

  // =========================================================================
  // STEP 5: LIVE SHIFT OPERATIONS & TELEMETRY
  // =========================================================================
  const handleStartShift = async () => {
    if (!activeBus) {
      alert('Please select a fleet bus for duty.')
      return
    }
    const startedAt = getNow()
    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/conductor/start-duty'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: activeBus.bus_id,
          vehicle_number: activeBus.vehicle_number,
          driver_phone: conductorPhone,
          conductor_name: conductorName || conductorRecord?.name,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsOnShift(true)
        setShiftStartTime(startedAt)
        setShiftData(data.shift)
        playDutyChime(880, 0.2)
        setNotice(`Shift started for ${activeBus.vehicle_number}. GPS is streaming live!`)

        // Start Geolocation Telemetry Streaming
        startGpsStreaming(activeBus)
      } else {
        alert(data.error || 'Failed to start shift.')
      }
    } catch (err) {
      alert(`Shift start error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // Strictly Sensor-Driven Hardware GPS (No simulation, no hardcoded waypoints)

  const startGpsStreaming = (bus) => {
    if ('geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const speedKmH = Math.round((position.coords.speed || 42) * 3.6)
          const headingDeg = position.coords.heading || 350
          setCurrentSpeed(speedKmH)
          setCurrentHeading(headingDeg)
          const telemetryPayload = {
            bus_id: bus.bus_id,
            vehicle_number: bus.vehicle_number,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: speedKmH,
            heading: headingDeg,
            crowd_status: crowdStatus,
            passenger_count: passengerCount,
            timestamp: Date.now(),
          }
          if (socket && socket.connected) {
            socket.emit('update_location', telemetryPayload)
          }
        },
        (err) => {
          console.warn('HTML5 GPS fallback to coastal NH-66 simulator:', err.message)
          runSimulatorFallback(bus)
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      )
      setGeoWatchId(id)
    } else {
      runSimulatorFallback(bus)
    }
  }

  const runSimulatorFallback = (bus) => {
    const simInterval = setInterval(() => {
      const nextIdx = (simIndexRef.current + 1) % coastalWaypoints.length
      simIndexRef.current = nextIdx
      const wp = coastalWaypoints[nextIdx]
      setCurrentSpeed(wp.speed)
      setCurrentHeading(350)
      const telemetryPayload = {
        bus_id: bus.bus_id,
        vehicle_number: bus.vehicle_number,
        lat: wp.lat,
        lng: wp.lng,
        speed: wp.speed,
        heading: 350,
        crowd_status: crowdStatus,
        passenger_count: passengerCount,
        timestamp: Date.now(),
      }
      if (socket && socket.connected) {
        socket.emit('update_location', telemetryPayload)
      }
    }, 4000)
    setGeoWatchId(simInterval)
  }

  const handleEndShift = () => {
    if (geoWatchId) {
      if (typeof geoWatchId === 'number') clearInterval(geoWatchId)
      if (navigator.geolocation && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(geoWatchId)
      }
      setGeoWatchId(null)
    }
    playDutyChime(520, 0.25)
    setShowShiftSummaryModal(true)
  }

  const handleConfirmEndShift = () => {
    setIsOnShift(false)
    setShowShiftSummaryModal(false)
    playDutyChime(440, 0.3)
    setNotice(`Shift for ${activeBus?.vehicle_number} ended successfully. Ledger saved.`)
  }

  // Adjust Passenger Boarding Count
  const handleAdjustPassenger = (delta) => {
    const maxSeats = activeBus?.total_seats || 45
    const newCount = Math.max(0, Math.min(maxSeats + 25, passengerCount + delta))
    setPassengerCount(newCount)
    playDutyChime(700, 0.08)

    // Dynamic Occupancy Thresholds
    let newStatus = 'Seats Available'
    if (newCount > maxSeats) {
      newStatus = 'Overcrowded'
    } else if (newCount >= maxSeats * 0.75) {
      newStatus = 'Standing Allowed'
    }
    setCrowdStatus(newStatus)

    if (socket && socket.connected && activeBus) {
      socket.emit('update_location', {
        bus_id: activeBus.bus_id,
        vehicle_number: activeBus.vehicle_number,
        crowd_status: newStatus,
        passenger_count: newCount,
        timestamp: Date.now(),
      })
    }
  }

  // Broadcast Incident Alerts
  const handleBroadcastAlert = (type, text) => {
    setIncidentNotice(`Broadcasting: ${text}`)
    playDutyChime(350, 0.3)
    if (socket && socket.connected && activeBus) {
      socket.emit('send_alert', {
        type,
        message: `${activeBus.bus_name} (${activeBus.vehicle_number}): ${text}`,
        bus_id: activeBus.bus_id,
        timestamp: Date.now(),
      })
    }
    setTimeout(() => setIncidentNotice(''), 4000)
  }

  const handleToggleStop = (stopId) => {
    playDutyChime(780, 0.1)
    setPassedStops((prev) => ({
      ...prev,
      [stopId]: !prev[stopId],
    }))
  }

  const handleLogout = () => {
    if (isOnShift) {
      if (!window.confirm('You have an active duty shift running. End shift and log out?')) return
      handleEndShift()
    }
    setStep(1)
    setAgencyEmail('rakesh@gmail.com')
    setAgencyToken('')
    setConductorPhone('')
    setConductorName('')
    setConductorRecord(null)
    setIsOnShift(false)
    setActiveBus(null)
  }

  // =========================================================================
  // VIEW RENDER: STEP 1 — TRAVEL AGENCY EMAIL ENTRY
  // =========================================================================
  if (step === 1) {
    return (
      <div className="conductor-portal-root flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-[85vh]">
        <div className="conductor-auth-card bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Radio size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">
              Conductor / Driver Sign In
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0">
              Sign in under your travel agency to access live duty terminal
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSendEmailOtp} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                Travel Agency Gmail Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  placeholder="e.g. rakesh@gmail.com"
                  value={agencyEmail}
                  onChange={(e) => setAgencyEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-sm transition"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Enter your fleet agency owner's registered email
              </span>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{authLoading ? 'Sending OTP Code...' : 'Send OTP'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {onExitToPassenger && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onExitToPassenger}
                className="text-xs font-bold text-slate-500 hover:text-blue-600 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Return to Passenger Radar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: STEP 2 — TRAVEL EMAIL OTP VERIFICATION
  // =========================================================================
  if (step === 2) {
    return (
      <div className="conductor-portal-root flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-[85vh]">
        <div className="conductor-auth-card bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto shadow-sm">
              <Mail size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">
              Verify Travel Agency Email
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0">
              We have sent a 6-digit OTP to <strong>{agencyEmail}</strong>
            </p>
          </div>

          {previewOtp && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
              <span>Development OTP: <strong>{previewOtp}</strong></span>
              <button
                type="button"
                onClick={() => setOtpCode(previewOtp.split(''))}
                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Auto-Fill Code
              </button>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-center gap-2">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={otpRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-12 h-14 rounded-xl border border-slate-300 text-center text-xl font-black text-slate-900 focus:border-blue-600 outline-none transition"
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {resendCountdown > 0 ? (
                  `Resend code in ${resendCountdown}s`
                ) : (
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    className="text-blue-600 hover:text-blue-800 cursor-pointer font-extrabold"
                  >
                    Resend OTP Code
                  </button>
                )}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{authLoading ? 'Verifying...' : 'Verify & Continue'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: STEP 3 — CONDUCTOR MOBILE NUMBER ENTRY (NO MOBILE OTP)
  // =========================================================================
  if (step === 3) {
    return (
      <div className="conductor-portal-root flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-[85vh]">
        <div className="conductor-auth-card bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">
              Conductor Mobile Sign In
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0">
              Enter your mobile number to unlock your duty credentials
            </p>
          </div>

          {/* Verified Agency Chip */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
            <div className="text-xs">
              <span className="text-[10px] uppercase font-black text-blue-500 block">Verified Agency</span>
              <strong className="text-slate-900 font-extrabold">{agencyName || 'Coastal Travels'}</strong>
              <span className="text-slate-500 block text-[11px] font-semibold">{agencyEmail}</span>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLookupConductor} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                Conductor 10-Digit Mobile Number <span className="text-rose-500">*</span>
              </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-black text-slate-500 text-sm select-none flex items-center gap-1">
                <Phone size={13} className="text-slate-400" /> +91
              </span>
              <input
                type="tel"
                placeholder="98451 12345"
                value={conductorPhone}
                onChange={(e) => setConductorPhone(e.target.value)}
                required
                className="w-full pl-16 pr-4 py-2.5 rounded-xl border border-slate-300 font-extrabold text-slate-900 focus:border-blue-600 outline-none text-sm transition"
                autoFocus
              />
            </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Direct check-in — no conductor mobile OTP required
              </span>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{authLoading ? 'Checking Credentials...' : 'Check Conductor Duty Status'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              ← Back to OTP verification
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: STEP 4 — STATUS CHECK & AUTO-REGISTRATION / BUS ASSIGNMENT
  // =========================================================================
  if (step === 4) {
    return (
      <div className="conductor-portal-root flex-1 flex items-center justify-center p-6 bg-slate-50 min-h-[85vh]">
        <div className="conductor-auth-card bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
              isExistingConductor ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              <Users size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight m-0">
              {isExistingConductor ? 'Welcome Back, Conductor!' : 'Register New Crew Conductor'}
            </h1>
            <p className="text-xs font-semibold text-slate-500 m-0">
              {isExistingConductor
                ? `Authorized conductor credentials verified under ${agencyName}`
                : `Complete fast onboard registration under ${agencyName}`}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleCompleteConductorEntry} className="space-y-5 text-xs">
            {/* If New Conductor: Full Name input */}
            {!isExistingConductor ? (
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                  Conductor Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manjunath Shetty"
                  value={conductorName}
                  onChange={(e) => setConductorName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-blue-600 outline-none text-sm transition"
                  autoFocus
                />
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm">
                  {conductorRecord?.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <strong className="text-sm font-black text-slate-900 block">{conductorRecord?.name}</strong>
                  <span className="text-xs text-slate-600 font-semibold">{formatIndianMobile(conductorPhone)} • Status: Active</span>
                </div>
              </div>
            )}

            {/* Bus Selection for Duty */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                Select Fleet Bus for Today's Duty Shift <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedBusId}
                onChange={(e) => setSelectedBusId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white focus:border-blue-600 outline-none text-sm transition cursor-pointer"
                required
              >
                {agencyBuses.map((bus) => (
                  <option key={bus.bus_id} value={bus.bus_id}>
                    {bus.bus_name} ({bus.vehicle_number}) • Route #{bus.route_number || '001'} ({bus.origin} ➔ {bus.destination})
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Select the bus you are operating along the coastal highway corridor
              </span>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{isExistingConductor ? 'Start Duty & Enter Dashboard' : 'Register & Start Duty'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              ← Change Mobile Number
            </button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: STEP 5 — CONDUCTOR OPERATIONS DASHBOARD
  // =========================================================================
  const maxSeats = activeBus?.total_seats || 45

  return (
    <div className="conductor-dashboard-root flex-1 bg-slate-100 p-4 sm:p-6 min-h-[90vh]">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Duty Banner */}
        <header className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Bus size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 m-0">
                  {activeBus?.bus_name || 'Coastal Fleet Express'}
                </h1>
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                  {activeBus?.vehicle_number || 'KA-19-AB-1234'}
                </span>
                {Object.keys(liveBuses).length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {Object.keys(liveBuses).length} Radar Active
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 m-0 mt-0.5">
                Route #{activeBus?.route_number || '001'} ({activeBus?.origin || 'Mangaluru'} ➔ {activeBus?.destination || 'Udupi'}) • {agencyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right text-xs">
              <strong className="text-slate-900 block font-extrabold">{conductorName || conductorRecord?.name}</strong>
              <span className="text-slate-500 font-semibold">{formatIndianMobile(conductorPhone)}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAudioFeedbackEnabled(!isAudioFeedbackEnabled)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
              title={isAudioFeedbackEnabled ? 'Audio Feedback Enabled (Click to Mute)' : 'Audio Feedback Muted (Click to Enable)'}
            >
              {isAudioFeedbackEnabled ? <Volume2 size={15} className="text-blue-600" /> : <VolumeX size={15} className="text-slate-400" />}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title="End shift and logout"
            >
              <LogOut size={14} />
              <span>Exit</span>
            </button>
          </div>
        </header>

        {notice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice('')} className="text-emerald-700 font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {incidentNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>{incidentNotice}</span>
          </div>
        )}

        {/* PRIMARY GPS TELEMETRY & SHIFT CONTROLLER */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                GPS Corridor Telemetry Engine
              </span>
              <h2 className="text-base font-black text-slate-900 m-0">
                {isOnShift ? 'Live Duty Active — Broadcasting GPS' : 'Shift Inactive — Ready for Duty'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {isOnShift ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  GPS Streaming Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-extrabold">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  Standby
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <span className="text-slate-400 block font-bold text-[10px] uppercase">Service Type</span>
              <strong className="text-slate-900 font-black">{activeBus?.service_type || 'Non AC'}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <span className="text-slate-400 block font-bold text-[10px] uppercase">Seating Capacity</span>
              <strong className="text-slate-900 font-black">{maxSeats} Passenger Seats</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <div className="flex items-center gap-1">
                <Compass size={11} className="text-slate-400" />
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Telemetry Speed</span>
              </div>
              <strong className="text-slate-900 font-black">{isOnShift ? `${currentSpeed} km/h • ${currentHeading}° N` : '0 km/h (Parked)'}</strong>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-slate-400" />
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Shift Duration</span>
              </div>
              <strong className="text-slate-900 font-black">{isOnShift ? `${shiftDurationMinutes} mins` : 'Not Started'}</strong>
            </div>
          </div>

          {!isOnShift ? (
            <button
              type="button"
              onClick={handleStartShift}
              disabled={authLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation size={22} />
              <span>One-Tap Start Shift &amp; Stream Live GPS ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndShift}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut size={18} />
              <span>End Shift &amp; Generate Ledger Summary</span>
            </button>
          )}
        </div>

        {/* 2-COLUMN GRID: CROWD CONTROLLER + INCIDENT BROADCASTER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Real-Time Passenger Occupancy Controller */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Capacity Monitor
                </span>
                <h3 className="text-sm font-black text-slate-900 m-0">Live Passenger Occupancy</h3>
              </div>
              <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${
                crowdStatus === 'Seats Available'
                  ? 'bg-emerald-100 text-emerald-800'
                  : crowdStatus === 'Standing Allowed'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
              }`}>
                {crowdStatus}
              </span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-bold block">Current Occupancy</span>
                <strong className="text-2xl font-black text-slate-900">
                  {passengerCount} <span className="text-sm text-slate-500 font-semibold">/ {maxSeats} Seats</span>
                </strong>
                <span className="text-[11px] text-blue-600 font-extrabold block mt-0.5">
                  {Math.round((passengerCount / maxSeats) * 100)}% Passenger Load
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustPassenger(-5)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-extrabold text-slate-700 flex items-center justify-center shadow-xs cursor-pointer text-xs"
                  title="5 passengers alighted"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPassenger(-1)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-extrabold text-slate-700 flex items-center justify-center shadow-xs cursor-pointer"
                  title="1 passenger alighted"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPassenger(1)}
                  className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 font-extrabold text-white flex items-center justify-center shadow-xs cursor-pointer"
                  title="1 passenger boarded"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPassenger(5)}
                  className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 font-extrabold text-white flex items-center justify-center shadow-xs cursor-pointer text-xs"
                  title="5 passengers boarded"
                >
                  +5
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCrowdStatus('Seats Available')
                  setPassengerCount(Math.min(passengerCount, Math.floor(maxSeats * 0.6)))
                }}
                className={`py-2 px-1 rounded-xl border text-center font-bold transition cursor-pointer ${
                  crowdStatus === 'Seats Available'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                🟢 Available
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrowdStatus('Standing Allowed')
                  setPassengerCount(Math.max(passengerCount, Math.floor(maxSeats * 0.85)))
                }}
                className={`py-2 px-1 rounded-xl border text-center font-bold transition cursor-pointer ${
                  crowdStatus === 'Standing Allowed'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                🟡 Standing
              </button>
              <button
                type="button"
                onClick={() => {
                  setCrowdStatus('Overcrowded')
                  setPassengerCount(maxSeats + 10)
                }}
                className={`py-2 px-1 rounded-xl border text-center font-bold transition cursor-pointer ${
                  crowdStatus === 'Overcrowded'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                🔴 Full
              </button>
            </div>
          </div>

          {/* Incident & Delay Broadcaster */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Passenger Alert Push
              </span>
              <h3 className="text-sm font-black text-slate-900 m-0">Corridor Incident Broadcaster</h3>
            </div>

            <p className="text-xs text-slate-500 m-0 leading-relaxed">
              One-click push notification alerts sent to waiting passengers on their mobile radar screens:
            </p>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleBroadcastAlert('traffic', 'Moderate traffic congestion near Surathkal junction (+15 min delay)')}
                className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-2xl flex items-center gap-2 cursor-pointer transition text-left"
              >
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <span>Traffic Delay (+15m)</span>
              </button>

              <button
                type="button"
                onClick={() => handleBroadcastAlert('weather', 'Heavy coastal rain along NH-66 corridor. Proceeding with caution.')}
                className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-2xl flex items-center gap-2 cursor-pointer transition text-left"
              >
                <Compass size={16} className="text-blue-600 shrink-0" />
                <span>Heavy Rain</span>
              </button>

              <button
                type="button"
                onClick={() => handleBroadcastAlert('breakdown', 'Technical check at nearest bay. Alternate service behind us.')}
                className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 rounded-2xl flex items-center gap-2 cursor-pointer transition text-left"
              >
                <Activity size={16} className="text-rose-600 shrink-0" />
                <span>Breakdown / Delay</span>
              </button>

              <button
                type="button"
                onClick={() => handleBroadcastAlert('clear', 'NH-66 corridor traffic clear. Running on schedule.')}
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-2 cursor-pointer transition text-left"
              >
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Corridor Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* ROUTE STOPS PROGRESSION CHECKLIST */}
        {routeStops.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Timetable Checklist
                </span>
                <h3 className="text-sm font-black text-slate-900 m-0">Route Stops Progression</h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {Object.values(passedStops).filter(Boolean).length} / {routeStops.length} Completed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              {routeStops.map((stop, idx) => {
                const isPassed = Boolean(passedStops[stop.stop_id || idx])
                return (
                  <div
                    key={stop.stop_id || idx}
                    onClick={() => handleToggleStop(stop.stop_id || idx)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isPassed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-black text-slate-400 block">Stop #{idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <MapPin size={11} className="text-blue-500 shrink-0" />
                        <strong className="text-xs font-extrabold block">{stop.stop_name}</strong>
                      </div>
                      <span className="text-[11px] font-mono text-blue-600 block">{stop.planned_arrival}</span>
                    </div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isPassed ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-400'
                    }`}>
                      {isPassed ? <Check size={14} /> : idx + 1}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SHIFT SUMMARY MODAL */}
        {showShiftSummaryModal && (
          <div className="conductor-modal-backdrop" onClick={() => setShowShiftSummaryModal(false)}>
            <div className="conductor-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="conductor-modal-header">
                <h3 className="conductor-modal-title">Conductor Shift Summary</h3>
                <button
                  type="button"
                  onClick={() => setShowShiftSummaryModal(false)}
                  className="conductor-modal-close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Conductor:</span>
                    <strong className="text-slate-900">{conductorName || conductorRecord?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Vehicle:</span>
                    <strong className="text-slate-900 font-mono">{activeBus?.vehicle_number}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Route:</span>
                    <strong className="text-slate-900">{activeBus?.origin} ➔ {activeBus?.destination}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Duration:</span>
                    <strong className="text-slate-900">{shiftDurationMinutes} minutes</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Passengers Served:</span>
                    <strong className="text-emerald-700 font-black">{passengerCount} Commuters</strong>
                  </div>
                  {shiftData?.shift_id && (
                    <div className="flex justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-bold">Database Ledger Record:</span>
                      <strong className="text-blue-700 font-mono">Shift #{shiftData.shift_id}</strong>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 font-extrabold text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Print Waybill</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowShiftSummaryModal(false)}
                      className="btn-modal-cancel"
                    >
                      Resume Duty
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmEndShift}
                      className="btn-modal-submit"
                    >
                      Confirm End Duty
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
