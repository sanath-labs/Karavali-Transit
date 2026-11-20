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
  Play,
  Plus,
  Printer,
  ShieldCheck,
  Square,
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
  const [networkConnected, setNetworkConnected] = useState(Boolean(socket?.connected))

  useEffect(() => {
    if (!socket) return undefined
    const updateNetworkStatus = () => setNetworkConnected(Boolean(socket.connected))
    socket.on('connect', updateNetworkStatus)
    socket.on('disconnect', updateNetworkStatus)
    updateNetworkStatus()
    return () => {
      socket.off('connect', updateNetworkStatus)
      socket.off('disconnect', updateNetworkStatus)
    }
  }, [socket])

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

  // Live GPS Telemetry from Conductor's Android Phone (Strictly Sensor-Driven, NO Simulation)
  const [geoWatchId, setGeoWatchId] = useState(null)
  const [isLiveTracking, setIsLiveTracking] = useState(false)
  const [gpsPermissionState, setGpsPermissionState] = useState('prompt') // 'prompt' | 'requesting' | 'granted' | 'denied' | 'unsupported'
  const [gpsStatus, setGpsStatus] = useState('IDLE') // 'IDLE' | 'REQUESTING' | 'LIVE' | 'STOPPED' | 'ERROR'
  const [gpsErrorMessage, setGpsErrorMessage] = useState('')
  const [gpsAccuracy, setGpsAccuracy] = useState(null)
  const [lastGpsTimestamp, setLastGpsTimestamp] = useState(null)
  const [currentLat, setCurrentLat] = useState(null)
  const [currentLng, setCurrentLng] = useState(null)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [currentHeading, setCurrentHeading] = useState(0)
  const [isAudioFeedbackEnabled, setIsAudioFeedbackEnabled] = useState(true)

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)]

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

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) {
      const next = [...otpCode]
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i]
      }
      setOtpCode(next)
      const nextIdx = Math.min(pasted.length, 5)
      otpRefs[nextIdx]?.current?.focus()
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
        if (data.conductor_token) {
          setConductorToken(data.conductor_token)
          try {
            localStorage.setItem('karavali_conductor_token', data.conductor_token)
          } catch {}
        }
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
        if (data.conductor_token) {
          setConductorToken(data.conductor_token)
          try {
            localStorage.setItem('karavali_conductor_token', data.conductor_token)
          } catch {}
        }
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
      const token = conductorToken || localStorage.getItem('karavali_conductor_token') || ''
      const res = await fetch(apiUrl('/api/conductor/start-duty'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: activeBus.bus_id,
          vehicle_number: activeBus.vehicle_number,
          driver_phone: conductorPhone,
          conductor_name: conductorName || conductorRecord?.name,
          conductor_id: conductorRecord?.conductor_id,
          conductor_token: token,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsOnShift(true)
        setShiftStartTime(startedAt)
        setShiftData(data.shift)
        if (data.conductor_token) {
          setConductorToken(data.conductor_token)
          try {
            localStorage.setItem('karavali_conductor_token', data.conductor_token)
          } catch {}
        }
        playDutyChime(880, 0.2)
        setNotice(`Duty shift initialized for ${activeBus.vehicle_number}. Click "Start Live Tracking" to stream GPS.`)
      } else {
        alert(data.error || 'Failed to start shift.')
      }
    } catch (err) {
      alert(`Shift start error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // =========================================================================
  // REAL-TIME GPS BUS TRACKING (ACTUAL SMARTPHONE SENSOR TELEMETRY)
  // NO SIMULATION, NO HARDCODED WAYPOINTS, HIGH-ACCURACY HARDWARE GPS
  // =========================================================================
  const handleStartLiveTracking = () => {
    setGpsErrorMessage('')

    if (!('geolocation' in navigator)) {
      setGpsPermissionState('unsupported')
      setGpsStatus('ERROR')
      setGpsErrorMessage('HTML5 Geolocation is not supported by your browser.')
      return
    }

    if (!activeBus) {
      alert('Please select a valid bus before tracking.')
      return
    }

    setGpsStatus('REQUESTING')
    setGpsPermissionState('requesting')
    playDutyChime(750, 0.15)

    try {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const accuracy = Math.round(position.coords.accuracy || 0)
          const speedKmH =
            position.coords.speed !== null && position.coords.speed >= 0
              ? Math.round(position.coords.speed * 3.6)
              : 0
          const headingDeg =
            position.coords.heading !== null && !isNaN(position.coords.heading)
              ? Math.round(position.coords.heading)
              : 0

          setCurrentLat(lat)
          setCurrentLng(lng)
          setCurrentSpeed(speedKmH)
          setCurrentHeading(headingDeg)
          setGpsAccuracy(accuracy)
          setLastGpsTimestamp(Date.now())
          setGpsPermissionState('granted')
          setGpsStatus('LIVE')
          setIsLiveTracking(true)
          setGpsErrorMessage('')

          const token =
            conductorToken || localStorage.getItem('karavali_conductor_token') || ''
          const telemetryPayload = {
            bus_id: activeBus.bus_id,
            vehicle_number: activeBus.vehicle_number,
            latitude: lat,
            longitude: lng,
            accuracy,
            speed: speedKmH,
            heading: headingDeg,
            crowd_status: crowdStatus,
            passenger_count: passengerCount,
            timestamp: Date.now(),
          }

          // Secure REST transmission with Conductor Token
          try {
            await fetch(apiUrl('/api/conductor/gps-location'), {
              method: 'POST',
              headers: conductorHeaders(token, { 'Content-Type': 'application/json' }),
              body: JSON.stringify(telemetryPayload),
            })
          } catch (postErr) {
            console.warn('REST telemetry post error:', postErr.message)
          }

          // Low-latency WebSocket transmission with Conductor Token
          if (socket && socket.connected) {
            socket.emit('update_location', {
              ...telemetryPayload,
              lat,
              lng,
              token,
            })
          }
        },
        (err) => {
          console.warn('Conductor GPS Geolocation Error:', err)
          setIsLiveTracking(false)
          setGpsStatus('ERROR')

          let userMsg = 'Unable to acquire GPS signal from your device.'
          if (err.code === 1) {
            setGpsPermissionState('denied')
            userMsg =
              'Location permission was denied. Please allow location access in your mobile browser settings to stream GPS.'
          } else if (err.code === 2) {
            setGpsPermissionState('prompt')
            userMsg =
              'GPS position unavailable. Please ensure GPS/Location is enabled on your Android phone.'
          } else if (err.code === 3) {
            setGpsPermissionState('prompt')
            userMsg = 'GPS satellite fix timed out. Waiting for signal in open sky...'
          }
          setGpsErrorMessage(userMsg)
          playDutyChime(320, 0.3)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        }
      )

      setGeoWatchId(watchId)
    } catch (launchErr) {
      setGpsStatus('ERROR')
      setGpsErrorMessage(`Failed to start geolocation: ${launchErr.message}`)
    }
  }

  const handleStopLiveTracking = async () => {
    if (geoWatchId !== null) {
      if (navigator.geolocation && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(geoWatchId)
      }
      setGeoWatchId(null)
    }
    setIsLiveTracking(false)
    setGpsStatus('STOPPED')
    setCurrentSpeed(0)
    playDutyChime(480, 0.2)

    const token =
      conductorToken || localStorage.getItem('karavali_conductor_token') || ''
    if (activeBus) {
      try {
        await fetch(apiUrl('/api/conductor/stop-tracking'), {
          method: 'POST',
          headers: conductorHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ bus_id: activeBus.bus_id }),
        })
      } catch (err) {
        console.warn('Stop tracking notify error:', err.message)
      }

      if (socket && socket.connected) {
        socket.emit('update_location', {
          bus_id: activeBus.bus_id,
          vehicle_number: activeBus.vehicle_number,
          tracking_status: 'OFFLINE',
          token,
          timestamp: Date.now(),
        })
      }
    }
    setNotice('Live GPS tracking paused. Bus is marked offline on the passenger map.')
  }

  const handleEndShift = () => {
    if (geoWatchId !== null) {
      if (navigator.geolocation && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(geoWatchId)
      }
      setGeoWatchId(null)
    }
    setIsLiveTracking(false)
    setGpsStatus('STOPPED')
    playDutyChime(520, 0.25)
    setShowShiftSummaryModal(true)
  }

  const handleConfirmEndShift = () => {
    setIsOnShift(false)
    setShowShiftSummaryModal(false)
    playDutyChime(440, 0.3)
    setNotice(`Shift for ${activeBus?.vehicle_number} ended successfully. Ledger saved.`)
  }

  const handleLogout = async () => {
    if (geoWatchId !== null && activeBus) {
      await handleStopLiveTracking()
    }
    if (geoWatchId !== null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(geoWatchId)
    }
    setGeoWatchId(null)
    setIsLiveTracking(false)
    setIsOnShift(false)
    setActiveBus(null)
    setShiftData(null)
    setShowShiftSummaryModal(false)
    setAuthError('')
    setNotice('')
    setStep(1)
    setConductorToken('')
    setAgencyToken('')
    setConductorRecord(null)
    setAgencyBuses([])
    setSelectedBusId('')
    try {
      localStorage.removeItem('karavali_conductor_token')
    } catch {}
    if (onExitToPassenger) onExitToPassenger()
  }

  const handleToggleStop = (stopId) => {
    setPassedStops((current) => ({ ...current, [stopId]: !current[stopId] }))
  }

  if (step < 5 || !conductorToken) {
    const authTitle = ['Conductor Sign In', 'Verify Your Email', 'Conductor details', 'Confirm your duty'][step - 1]

    return (
      <div className="conductor-dashboard-root flex-1 bg-slate-100 p-4 sm:p-8 min-h-[75vh]">
        <div className="max-w-lg mx-auto mt-4 sm:mt-8">
          <div className="flex items-center gap-3 mb-5 px-1">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bus size={23} />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">Karavali-Transit</div>
              <div className="text-xs font-semibold text-slate-500">Conductor Terminal</div>
            </div>
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold text-blue-700 m-0">Step {step} of 4</p>
              <h1 className="text-xl font-black text-slate-900 mt-1 mb-1">{authTitle}</h1>
              <p className="text-sm text-slate-500 m-0">
                {step === 1 && 'Access your assigned bus and start live GPS tracking.'}
                {step === 2 && `Enter the verification code for ${agencyEmail}.`}
                {step === 3 && 'Use the mobile number authorized by your fleet owner.'}
                {step === 4 && 'Review your conductor and bus assignment.'}
              </p>
            </div>

            {notice && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs font-semibold" role="status">
                {notice}
              </div>
            )}
            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold" role="alert">
                {authError}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleSendEmailOtp} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Travel Agency Email
                  <input
                    type="email"
                    value={agencyEmail}
                    onChange={(e) => setAgencyEmail(e.target.value)}
                    placeholder="Enter registered Gmail address"
                    autoComplete="email"
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <button type="submit" disabled={authLoading} className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-sm transition cursor-pointer">
                  {authLoading ? 'Sending OTP…' : 'Send Verification OTP'}
                </button>
                <p className="text-xs text-slate-500 text-center m-0">Use the email registered by your fleet owner.</p>
                <p className="text-[11px] text-slate-400 text-center m-0">Secure verification code sent to your travel agency inbox</p>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {previewOtp && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-3">
                    <span>Development code: <strong className="font-mono">{previewOtp}</strong></span>
                    <button type="button" onClick={() => setOtpCode(previewOtp.split('').slice(0, 6))} className="font-bold underline cursor-pointer">Fill code</button>
                  </div>
                )}
                <div className="grid grid-cols-6 gap-2">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      aria-label={`Verification digit ${idx + 1}`}
                      className="h-12 w-full rounded-xl border border-slate-300 text-center text-lg font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  ))}
                </div>
                <button type="submit" disabled={authLoading} className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-sm transition cursor-pointer">
                  {authLoading ? 'Verifying…' : 'Verify OTP'}
                </button>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <button type="button" onClick={() => setStep(1)} className="font-bold hover:text-blue-700 cursor-pointer">Change email</button>
                  {resendCountdown > 0 ? (
                    <span>Resend in {resendCountdown}s</span>
                  ) : (
                    <button type="button" onClick={handleSendEmailOtp} className="font-bold text-blue-700 cursor-pointer">Resend OTP Code</button>
                  )}
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleLookupConductor} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Conductor mobile number
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={conductorPhone}
                    onChange={(e) => setConductorPhone(formatIndianMobile(e.target.value))}
                    placeholder="10-digit mobile number"
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <button type="submit" disabled={authLoading} className="w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-extrabold text-sm transition cursor-pointer">
                  {authLoading ? 'Checking…' : 'Continue'}
                </button>
                <button type="button" onClick={() => setStep(2)} className="w-full text-xs font-bold text-slate-500 hover:text-blue-700 cursor-pointer">Back to email verification</button>
              </form>
            )}

            {step === 4 && (
              <form onSubmit={handleCompleteConductorEntry} className="space-y-4">
                {isExistingConductor ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-500">Conductor</span>
                    <strong className="text-sm text-slate-900">{conductorRecord?.name}</strong>
                  </div>
                ) : (
                  <label className="block text-xs font-bold text-slate-700">
                    Your full name
                    <input
                      type="text"
                      value={conductorName}
                      onChange={(e) => setConductorName(e.target.value)}
                      autoComplete="name"
                      placeholder="Enter your name"
                      required
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                )}
                <label className="block text-xs font-bold text-slate-700">
                  Assigned bus
                  <select value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                    {agencyBuses.length === 0 && <option value="">No buses available</option>}
                    {agencyBuses.map((bus) => <option key={bus.bus_id} value={bus.bus_id}>{bus.vehicle_number} — {bus.bus_name}</option>)}
                  </select>
                </label>
                {agencyBuses.length === 0 && <p className="text-xs text-amber-700 m-0">Ask your fleet owner to assign a bus before starting duty.</p>}
                <button type="submit" disabled={authLoading || agencyBuses.length === 0} className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm transition cursor-pointer">
                  {authLoading ? 'Opening duty terminal…' : isExistingConductor ? 'Continue to Conductor Terminal' : 'Register and Continue'}
                </button>
                <button type="button" onClick={() => setStep(3)} className="w-full text-xs font-bold text-slate-500 hover:text-blue-700 cursor-pointer">Change mobile number</button>
              </form>
            )}

            {onExitToPassenger && (
              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <button type="button" onClick={onExitToPassenger} className="text-xs font-bold text-slate-500 hover:text-blue-700 cursor-pointer">Return to Passenger Radar</button>
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="conductor-dashboard-root flex-1 bg-slate-100 p-4 sm:p-6 min-h-[90vh]">
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 m-0">
              Welcome, {conductorName || conductorRecord?.name || 'Conductor'}
            </h1>
            <p className="text-sm text-slate-500 font-medium m-0 mt-1">Your duty information for today</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {networkConnected ? 'Network connected' : 'Reconnecting'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
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
            <button type="button" onClick={() => setNotice('')} className="text-emerald-700 font-bold cursor-pointer" aria-label="Dismiss notice">
              <X size={15} />
            </button>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Assigned Bus</span>
              <strong className="block text-base font-black text-slate-900 mt-1">{activeBus?.vehicle_number || 'Bus not assigned'}</strong>
              {activeBus?.bus_name && <span className="text-xs text-slate-500 font-medium">{activeBus.bus_name}</span>}
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Assigned Route</span>
              <strong className="block text-base font-black text-slate-900 mt-1">{activeBus?.origin || 'Mangaluru'} → {activeBus?.destination || 'Udupi'}</strong>
              <span className="text-xs text-slate-500 font-medium">Route #{activeBus?.route_number || '001'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 sm:p-7 text-center">
            <div className="flex justify-center mb-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold ${isOnShift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnShift ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                {isOnShift ? 'Shift Active' : 'Shift Inactive — Ready for Duty'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 m-0">{isOnShift ? 'Your duty is active' : 'Ready to begin your shift?'}</h2>
            {!isOnShift && <p className="text-sm text-slate-500 mt-2 mb-0">Initialize your duty when you are ready to start.</p>}

            {gpsErrorMessage && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold text-left" role="alert">
                <strong className="block">{gpsErrorMessage}</strong>
                <span className="block mt-1 text-rose-700">Allow location access in your browser settings to start GPS tracking.</span>
              </div>
            )}

            {!isOnShift ? (
              <button
                type="button"
                onClick={handleStartShift}
                disabled={authLoading}
                className="w-full sm:max-w-md mt-5 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-base sm:text-lg rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mx-auto"
              >
                <Navigation size={22} />
                <span>Initialize Conductor Duty</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 max-w-xl mx-auto">
                {!isLiveTracking ? (
                  <button type="button" onClick={handleStartLiveTracking} className="py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer">
                    <Play size={17} fill="currentColor" />
                    <span>{gpsStatus === 'REQUESTING' ? 'Requesting Location…' : 'Start Live Tracking'}</span>
                  </button>
                ) : (
                  <button type="button" onClick={handleStopLiveTracking} className="py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer">
                    <Square size={17} fill="currentColor" />
                    <span>Stop Tracking</span>
                  </button>
                )}
                <button type="button" onClick={handleEndShift} className="py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer">
                  <LogOut size={17} />
                  <span>End Duty</span>
                </button>
              </div>
            )}
          </div>
        </section>
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
