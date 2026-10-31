import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Home,
  LogOut,
  Mail,
  MapPin,
  Plus,
  Radio,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { apiUrl, ownerHeaders } from './api.js'

export default function OwnerPortal({
  ownerEmail,
  setOwnerEmail,
  ownerAgencyName,
  setOwnerAgencyName,
  isOwnerAuthenticated,
  setIsOwnerAuthenticated,
  ownerToken,
  setOwnerToken,
  onSwitchToConductor,
}) {
  // Auth state
  const [authMode, setAuthMode] = useState('signup') // 'signup' | 'login'
  const [otpStep, setOtpStep] = useState('email') // 'email' | 'otp'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resendCountdown, setResendCountdown] = useState(25)
  const [otpPreview, setOtpPreview] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Dashboard & Navigation state
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'buses' | 'conductors' | 'routes' | 'reports' | 'settings'
  const [viewMode, setViewMode] = useState('dashboard') // 'dashboard' | 'add-bus' | 'save-confirmation'
  const [dashboardData, setDashboardData] = useState({
    stats: { total_buses: 0, total_conductors: 0, total_routes: 0, live_buses: 0 },
    recent_activity: [],
    buses: [],
    conductors: [],
  })
  const [buses, setBuses] = useState([])
  const [busesLoading, setBusesLoading] = useState(false)
  const [busesError, setBusesError] = useState('')
  const [selectedBusForTimetable, setSelectedBusForTimetable] = useState(null)
  const [conductors, setConductors] = useState([])
  const [visiblePins, setVisiblePins] = useState({})
  const [copiedPinBusId, setCopiedPinBusId] = useState(null)
  const [notice, setNotice] = useState('')
  const [busSearchQuery, setBusSearchQuery] = useState('')

  // Bus Management & Selection State (Screens 8 & 9)
  const [isEditingBus, setIsEditingBus] = useState(false)
  const [editingBusId, setEditingBusId] = useState(null)
  const [savedConfirmationBus, setSavedConfirmationBus] = useState(null)
  const [selectedBusForView, setSelectedBusForView] = useState(null)
  const [deleteConfirmBus, setDeleteConfirmBus] = useState(null)
  const [isDeletingBus, setIsDeletingBus] = useState(false)

  // Conductor Modal state
  const [showConductorModal, setShowConductorModal] = useState(false)
  const [conductorForm, setConductorForm] = useState({ name: '', phone: '', assigned_bus_id: '' })
  const [conductorSaving, setConductorSaving] = useState(false)

  // 4-Step Add New Bus Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [isSavingBus, setIsSavingBus] = useState(false)
  const [wizardError, setWizardError] = useState('')
  const [wizardForm, setWizardForm] = useState({
    vehicle_number: 'KA 19 AB 1234',
    bus_name: 'Shri Durga Prasad',
    service_type: 'Non AC',
    total_seats: 45,
    photo_url: '/images/coastal-private-bus.jpg',
    photo_preview: null,
    route_number: '001',
    origin: 'Mangaluru',
    destination: 'Udupi',
    stops: [
      { id: 1, stop_name: 'Mangaluru', planned_arrival: '06:30 AM' },
      { id: 2, stop_name: 'Surathkal', planned_arrival: '07:05 AM' },
      { id: 3, stop_name: 'Kundapura', planned_arrival: '09:00 AM' },
      { id: 4, stop_name: 'Udupi', planned_arrival: '10:00 AM' },
    ],
    departure_time: '06:30 AM',
    frequency: 'Daily',
    journey_duration: '3 hours 30 minutes',
  })

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)]

  // Resend Countdown Timer
  useEffect(() => {
    let timer = null
    if (otpStep === 'otp' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [otpStep, resendCountdown])

  // Fetch Dashboard data when authenticated
  const fetchDashboard = async (token = ownerToken) => {
    if (!token) return
    setBusesLoading(true)
    setBusesError('')
    try {
      const res = await fetch(apiUrl('/api/owner/dashboard'), {
        headers: ownerHeaders(token),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDashboardData(data)
        const busList = data.buses || []
        setBuses(busList)
        setConductors(data.conductors || [])
        setSelectedBusForView((prev) => {
          if (!prev && busList.length > 0) return busList[0]
          if (prev) {
            const found = busList.find((b) => b.bus_id === prev.bus_id)
            return found || (busList.length > 0 ? busList[0] : null)
          }
          return null
        })
      } else {
        setBusesError(data.error || 'Failed to load fleet buses from database.')
      }
    } catch (err) {
      console.error('Failed to load owner dashboard:', err)
      setBusesError(`Could not reach transit server: ${err.message}`)
    } finally {
      setBusesLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    if (isOwnerAuthenticated && ownerToken) {
      const load = async () => {
        try {
          const res = await fetch(apiUrl('/api/owner/dashboard'), {
            headers: ownerHeaders(ownerToken),
          })
          const data = await res.json()
          if (!ignore) {
            if (res.ok && data.success) {
              setDashboardData(data)
              const busList = data.buses || []
              setBuses(busList)
              setConductors(data.conductors || [])
              setSelectedBusForView((prev) => {
                if (!prev && busList.length > 0) return busList[0]
                if (prev) {
                  const found = busList.find((b) => b.bus_id === prev.bus_id)
                  return found || (busList.length > 0 ? busList[0] : null)
                }
                return null
              })
            } else {
              setBusesError(data.error || 'Failed to load fleet buses from database.')
            }
          }
        } catch (err) {
          if (!ignore) setBusesError(`Could not reach transit server: ${err.message}`)
        }
      }
      load()
    }
    return () => {
      ignore = true
    }
  }, [isOwnerAuthenticated, ownerToken])

  // 1. Send OTP Handler
  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setAuthError('')
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) {
      setAuthError('Please enter a valid Gmail / email address.')
      return
    }

    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/owner/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail.trim(),
          agency_name: ownerAgencyName.trim() || 'Coastal Fleet Travels',
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setOtpPreview(data.preview_otp || '')
        setOtpDigits(['', '', '', '', '', ''])
        setResendCountdown(25)
        setOtpStep('otp')
      } else {
        setAuthError(data.error || 'Failed to send OTP code.')
      }
    } catch (err) {
      setAuthError(`Could not reach transit server: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // 2. OTP Input Navigation & Paste Handling
  const handleOtpChange = (index, val) => {
    const clean = val.replace(/\D/g, '')
    const nextDigits = [...otpDigits]
    if (clean.length > 0) {
      nextDigits[index] = clean.slice(-1)
      setOtpDigits(nextDigits)
      if (index < 5) {
        otpRefs[index + 1].current?.focus()
      }
    } else {
      nextDigits[index] = ''
      setOtpDigits(nextDigits)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs[index - 1].current?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const nextDigits = [...otpDigits]
      for (let i = 0; i < pasted.length && i < 6; i++) {
        nextDigits[i] = pasted[i]
      }
      setOtpDigits(nextDigits)
      const targetFocus = Math.min(pasted.length, 5)
      otpRefs[targetFocus].current?.focus()
    }
  }

  // 3. Verify OTP Handler
  const handleVerifyOtp = async (e) => {
    e?.preventDefault()
    setAuthError('')
    const code = otpDigits.join('')
    if (code.length !== 6) {
      setAuthError('Please enter all 6 digits of the OTP code.')
      return
    }

    setAuthLoading(true)
    try {
      const res = await fetch(apiUrl('/api/owner/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail.trim(), otp: code }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.owner?.token) {
        setOwnerToken(data.owner.token)
        if (data.owner.agency_name) setOwnerAgencyName(data.owner.agency_name)
        setIsOwnerAuthenticated(true)
        setViewMode('dashboard')
        setActiveTab('dashboard')
        fetchDashboard(data.owner.token)
      } else {
        setAuthError(data.error || 'Invalid or expired OTP code.')
      }
    } catch (err) {
      setAuthError(`Could not reach transit server: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  // 4. Logout Handler
  const handleLogout = () => {
    setIsOwnerAuthenticated(false)
    setOwnerToken('')
    setOtpStep('email')
    setOtpDigits(['', '', '', '', '', ''])
    setViewMode('dashboard')
    setActiveTab('dashboard')
  }

  // 5. Add Stop to Route in Wizard Step 2
  const handleAddStop = () => {
    setWizardError('')
    const newId = Date.now()
    setWizardForm((prev) => ({
      ...prev,
      stops: [
        ...prev.stops,
        { id: newId, stop_name: '', planned_arrival: '10:30 AM' },
      ],
    }))
  }

  // 6. Remove Stop in Wizard Step 2
  const handleRemoveStop = (id) => {
    setWizardError('')
    if (wizardForm.stops.length <= 2) {
      setWizardError('Route must retain at least 2 stops (origin and destination).')
      return
    }
    setWizardForm((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== id),
    }))
  }

  // 7. Edit Stop Field in Wizard Step 2
  const handleStopFieldChange = (id, field, value) => {
    setWizardForm((prev) => ({
      ...prev,
      stops: prev.stops.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }))
  }

  // 8. Photo Upload Handler
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setWizardError('File size exceeds the 5MB limit.')
        return
      }
      const reader = new FileReader()
      reader.onload = (event) => {
        setWizardForm((prev) => ({
          ...prev,
          photo_url: event.target?.result,
          photo_preview: event.target?.result,
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  // 9. Wizard Step Validation & Navigation
  const handleNextStep = () => {
    setWizardError('')
    if (wizardStep === 1) {
      if (!wizardForm.vehicle_number.trim()) {
        setWizardError('Please enter the bus registration number.')
        return
      }
      if (!wizardForm.bus_name.trim()) {
        setWizardError('Please enter the bus operator / service name.')
        return
      }
      if (!wizardForm.total_seats || Number(wizardForm.total_seats) <= 0) {
        setWizardError('Total seats must be a positive number.')
        return
      }
      setWizardStep(2)
    } else if (wizardStep === 2) {
      if (!wizardForm.route_number.trim()) {
        setWizardError('Please enter the route number (e.g. 001, 15).')
        return
      }
      if (!wizardForm.origin.trim() || !wizardForm.destination.trim()) {
        setWizardError('Start location and destination are required.')
        return
      }
      if (wizardForm.stops.some((s) => !s.stop_name.trim() || !s.planned_arrival.trim())) {
        setWizardError('All intermediate stops must have a valid stop name and planned arrival time.')
        return
      }
      // Sync departure time from first stop
      if (wizardForm.stops[0]?.planned_arrival) {
        setWizardForm((prev) => ({
          ...prev,
          departure_time: prev.stops[0].planned_arrival,
        }))
      }
      setWizardStep(3)
    } else if (wizardStep === 3) {
      if (!wizardForm.departure_time.trim()) {
        setWizardError('Departure time is required.')
        return
      }
      if (!wizardForm.journey_duration.trim()) {
        setWizardError('Estimated journey duration is required.')
        return
      }
      setWizardStep(4)
    }
  }

  // 10. Persist Bus to PostgreSQL/SQLite via transactional backend API
  const handleSaveBus = async () => {
    setWizardError('')
    setIsSavingBus(true)
    try {
      const payload = {
        bus_name: wizardForm.bus_name.trim(),
        vehicle_number: wizardForm.vehicle_number.trim(),
        route_number: wizardForm.route_number.trim(),
        service_type: wizardForm.service_type,
        origin: wizardForm.origin.trim(),
        destination: wizardForm.destination.trim(),
        total_seats: Number(wizardForm.total_seats) || 45,
        photo_url: wizardForm.photo_preview || wizardForm.photo_url || '/images/coastal-private-bus.jpg',
        departure_time: wizardForm.departure_time,
        frequency: wizardForm.frequency,
        journey_duration: wizardForm.journey_duration,
        stops: wizardForm.stops.map((s, idx) => ({
          stop_order: idx + 1,
          stop_name: s.stop_name.trim(),
          planned_arrival: s.planned_arrival.trim(),
        })),
      }

      const url = isEditingBus && editingBusId
        ? apiUrl(`/api/owner/buses/${editingBusId}`)
        : apiUrl('/api/owner/buses')
      const method = isEditingBus && editingBusId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: ownerHeaders(ownerToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success && data.bus) {
        setSavedConfirmationBus(data.bus)
        setSelectedBusForView(data.bus)
        setViewMode('save-confirmation')
        setNotice(
          isEditingBus
            ? `Bus ${data.bus.vehicle_number} (${data.bus.bus_name}) updated successfully!`
            : `Bus ${data.bus.vehicle_number} (${data.bus.bus_name}) registered successfully!`
        )
        fetchDashboard(ownerToken)
      } else {
        setWizardError(data.error || 'Failed to save bus in database.')
      }
    } catch (err) {
      setWizardError(`Could not reach transit server: ${err.message}`)
    } finally {
      setIsSavingBus(false)
    }
  }

  // 11. Add New Bus Action Handler
  const handleAddNewBus = () => {
    setIsEditingBus(false)
    setEditingBusId(null)
    setWizardError('')
    setWizardStep(1)
    setWizardForm({
      vehicle_number: '',
      bus_name: '',
      service_type: 'Non AC',
      total_seats: 45,
      photo_url: '/images/coastal-private-bus.jpg',
      photo_preview: null,
      route_number: '',
      origin: 'Mangaluru',
      destination: 'Udupi',
      stops: [
        { id: 1, stop_name: 'Mangaluru', planned_arrival: '06:30 AM' },
        { id: 2, stop_name: 'Surathkal', planned_arrival: '07:05 AM' },
        { id: 3, stop_name: 'Kundapura', planned_arrival: '09:00 AM' },
        { id: 4, stop_name: 'Udupi', planned_arrival: '10:00 AM' },
      ],
      departure_time: '06:30 AM',
      frequency: 'Daily',
      journey_duration: '3 hours 30 minutes',
    })
    setViewMode('add-bus')
  }

  // 12. Edit Bus Action Handler
  const handleEditBus = (bus) => {
    if (!bus) return
    setIsEditingBus(true)
    setEditingBusId(bus.bus_id)
    setWizardError('')
    setWizardStep(1)
    setWizardForm({
      vehicle_number: bus.vehicle_number || '',
      bus_name: bus.bus_name || '',
      service_type: bus.service_type || 'Non AC',
      total_seats: bus.total_seats || 45,
      photo_url: bus.photo_url || '/images/coastal-private-bus.jpg',
      photo_preview: null,
      route_number: bus.route_number || '001',
      origin: bus.origin || 'Mangaluru',
      destination: bus.destination || 'Udupi',
      departure_time: bus.departure_time || '06:30 AM',
      frequency: bus.frequency || 'Daily',
      journey_duration: bus.journey_duration || '3 hours 30 minutes',
      stops: Array.isArray(bus.stops) && bus.stops.length > 0
        ? bus.stops.map((s, idx) => ({ id: idx + 1, stop_name: s.stop_name, planned_arrival: s.planned_arrival }))
        : [
            { id: 1, stop_name: bus.origin || 'Mangaluru', planned_arrival: bus.departure_time || '06:30 AM' },
            { id: 2, stop_name: bus.destination || 'Udupi', planned_arrival: '10:00 AM' },
          ],
    })
    setViewMode('add-bus')
  }

  // 13. Delete Bus Handlers with Confirmation Modal
  const handlePromptDelete = (bus) => {
    if (!bus) return
    setDeleteConfirmBus(bus)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmBus) return
    setIsDeletingBus(true)
    try {
      const res = await fetch(apiUrl(`/api/owner/buses/${deleteConfirmBus.bus_id}`), {
        method: 'DELETE',
        headers: ownerHeaders(ownerToken),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setNotice(`Bus ${deleteConfirmBus.vehicle_number} removed from fleet.`)
        if (selectedBusForView?.bus_id === deleteConfirmBus.bus_id) {
          const remaining = buses.filter((b) => b.bus_id !== deleteConfirmBus.bus_id)
          setSelectedBusForView(remaining.length > 0 ? remaining[0] : null)
        }
        setDeleteConfirmBus(null)
        fetchDashboard(ownerToken)
      } else {
        setNotice(data.error || 'Failed to remove bus.')
      }
    } catch (err) {
      setNotice(`Server error: ${err.message}`)
    } finally {
      setIsDeletingBus(false)
    }
  }

  const handleGoToDashboard = () => {
    setViewMode('dashboard')
    setActiveTab('dashboard')
    if (savedConfirmationBus) {
      setSelectedBusForView(savedConfirmationBus)
    }
  }

  const handleViewAddedBus = () => {
    setViewMode('dashboard')
    setActiveTab('dashboard')
    if (savedConfirmationBus) {
      setSelectedBusForView(savedConfirmationBus)
    }
    setTimeout(() => {
      const el = document.getElementById('view-bus-panel-anchor')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // 12. Update Conductor PIN
  const handleUpdatePin = async (busId, currentPin) => {
    const newPin = window.prompt('Enter new 4-digit Secret Conductor PIN:', currentPin || '4509')
    if (!newPin) return
    if (!/^\d{4}$/.test(newPin.trim())) {
      alert('PIN must contain exactly 4 digits.')
      return
    }
    try {
      const res = await fetch(apiUrl(`/api/owner/buses/${busId}/pin`), {
        method: 'PATCH',
        headers: ownerHeaders(ownerToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conductor_pin: newPin.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setNotice(`Conductor PIN updated to ${newPin.trim()}`)
        fetchDashboard(ownerToken)
      } else {
        setNotice(data.error || 'Failed to update PIN.')
      }
    } catch (err) {
      setNotice(`Server error: ${err.message}`)
    }
  }

  // 13. Authorize Conductor Handler
  const handleSaveConductor = async (e) => {
    e?.preventDefault()
    if (!conductorForm.name.trim() || !conductorForm.phone.trim()) {
      alert('Conductor name and phone are required.')
      return
    }
    setConductorSaving(true)
    try {
      const res = await fetch(apiUrl('/api/owner/conductors'), {
        method: 'POST',
        headers: ownerHeaders(ownerToken, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(conductorForm),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setShowConductorModal(false)
        setConductorForm({ name: '', phone: '', assigned_bus_id: '' })
        setNotice(`Conductor ${data.conductor.name} authorized!`)
        fetchDashboard(ownerToken)
      } else {
        alert(data.error || 'Failed to authorize conductor.')
      }
    } catch (err) {
      alert(`Server error: ${err.message}`)
    } finally {
      setConductorSaving(false)
    }
  }

  // 14. Revoke Conductor Handler
  const handleDeleteConductor = async (id, name) => {
    if (!window.confirm(`Revoke duty authorization for conductor ${name}?`)) return
    try {
      const res = await fetch(apiUrl(`/api/owner/conductors/${id}`), {
        method: 'DELETE',
        headers: ownerHeaders(ownerToken),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setNotice(`Authorization revoked for conductor ${name}.`)
        fetchDashboard(ownerToken)
      }
    } catch (err) {
      setNotice(`Server error: ${err.message}`)
    }
  }

  // =========================================================================
  // VIEW RENDER: AUTHENTICATION (SCREENS 1 & 2)
  // =========================================================================
  if (!isOwnerAuthenticated) {
    return (
      <div className="owner-auth-wrapper">
        {/* Brand Header */}
        <div className="owner-auth-brand">
          <div className="owner-brand-icon">
            <Bus size={24} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              Karavali-<span className="text-amber-500">Transit</span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Private Bus Tracking System
            </div>
          </div>
        </div>

        {/* SCREEN 1: Owner Registration / Sign Up */}
        {otpStep === 'email' ? (
          <div className="owner-auth-card">
            <h1 className="owner-auth-title">
              {authMode === 'signup' ? 'Create Owner Account' : 'Owner Login'}
            </h1>
            <p className="owner-auth-desc">
              {authMode === 'signup'
                ? 'Register to manage your buses and conductors'
                : 'Access your fleet management command console'}
            </p>

            <form onSubmit={handleSendOtp}>
              <div className="owner-gmail-input-group">
                <span className="text-base text-rose-500 font-bold select-none mr-2">M</span>
                <input
                  type="email"
                  placeholder="Enter your Gmail address"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                  className="owner-gmail-input"
                  autoFocus
                />
              </div>

              {authError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 text-left">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" disabled={authLoading} className="owner-submit-btn">
                <span>{authLoading ? 'Sending OTP...' : 'Send OTP'}</span>
                {!authLoading && <ArrowRight size={16} />}
              </button>

              <div className="owner-auth-switch">
                {authMode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('login')}>
                      Login
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('signup')}>
                      Create one
                    </button>
                  </span>
                )}
              </div>
            </form>
          </div>
        ) : (
          /* SCREEN 2: Email OTP Verification */
          <div className="owner-auth-card">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
              <Mail size={26} />
            </div>

            <h1 className="owner-auth-title">Verify Your Email</h1>
            <p className="owner-auth-desc">
              We have sent a 6-digit OTP to <strong>{ownerEmail}</strong>
            </p>

            {/* Development OTP quick-fill helper */}
            {otpPreview && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
                <span>Development OTP: <strong>{otpPreview}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    const digits = otpPreview.split('')
                    setOtpDigits(digits)
                  }}
                  className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[11px] cursor-pointer"
                >
                  Fill Code
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              {/* 6 OTP Input Boxes */}
              <div className="otp-digit-grid">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="otp-digit-box"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              {/* Resend Countdown */}
              <div className="otp-resend-row">
                {resendCountdown > 0 ? (
                  <span>Didn't receive the OTP? Resend in {resendCountdown}s</span>
                ) : (
                  <span>
                    Didn't receive the OTP?{' '}
                    <button type="button" onClick={handleSendOtp} className="otp-resend-btn">
                      Resend Code
                    </button>
                  </span>
                )}
              </div>

              {authError && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 text-left">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}

              <button type="submit" disabled={authLoading} className="owner-submit-btn">
                <span>{authLoading ? 'Verifying...' : 'Verify OTP'}</span>
                {!authLoading && <ShieldCheck size={18} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpStep('email')
                  setAuthError('')
                }}
                className="owner-secondary-btn"
              >
                Back
              </button>
            </form>
          </div>
        )}

        {/* Feature Strip matching Screen 1 */}
        <div className="owner-feature-strip">
          <div className="owner-feature-badge">
            <Bus size={15} className="text-blue-600" />
            <span>Manage Buses</span>
          </div>
          <div className="owner-feature-badge">
            <Users size={15} className="text-emerald-600" />
            <span>Assign Conductors</span>
          </div>
          <div className="owner-feature-badge">
            <Activity size={15} className="text-purple-600" />
            <span>Track Operations</span>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: SAVE CONFIRMATION (SCREEN 8)
  // =========================================================================
  if (viewMode === 'save-confirmation') {
    const displayBus = savedConfirmationBus || wizardForm
    return (
      <div className="owner-portal-root p-6 overflow-y-auto">
        <div className="save-confirmation-container">
          <div className="save-confirmation-badge">
            <Check size={14} />
            <span>8 Save Confirmation</span>
          </div>

          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-sm">
            <CheckCircle2 size={44} className="text-emerald-500" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 m-0">
            {isEditingBus ? 'Bus Updated Successfully!' : 'Bus Added Successfully!'}
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-2 mb-6">
            Your bus has been {isEditingBus ? 'updated' : 'registered and saved'} successfully in Karavali-Transit system.
          </p>

          {/* Bus Details Summary Box */}
          <div className="save-confirmation-card">
            <div className="flex items-center gap-2 text-blue-600 font-extrabold text-sm mb-3">
              <Bus size={18} />
              <span>Bus Details</span>
            </div>

            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Bus Number</span>
              <span className="save-bus-detail-value font-mono">: {displayBus.vehicle_number}</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Bus Name</span>
              <span className="save-bus-detail-value">: {displayBus.bus_name}</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Bus Type</span>
              <span className="save-bus-detail-value">: {displayBus.service_type || 'Non AC'}</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Total Seats</span>
              <span className="save-bus-detail-value">: {displayBus.total_seats || 45}</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Route</span>
              <span className="save-bus-detail-value">: {displayBus.origin || 'Mangaluru'} ➔ {displayBus.destination || 'Udupi'}</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Departure Time</span>
              <span className="save-bus-detail-value">: {displayBus.departure_time || '06:30 AM'} ({displayBus.frequency || 'Daily'})</span>
            </div>
            <div className="save-bus-detail-row">
              <span className="save-bus-detail-label">Stops</span>
              <span className="save-bus-detail-value">: {displayBus.stops?.length || 4} Stops</span>
            </div>
          </div>

          <h3 className="text-sm font-black text-slate-800 mt-5 mb-4">
            What would you like to do next?
          </h3>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoToDashboard}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Bus size={16} />
              <span>Go to Owner Dashboard</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              onClick={handleAddNewBus}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
            >
              <Plus size={16} className="text-blue-600" />
              <span>Add Another Bus</span>
              <ArrowRight size={14} className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={handleViewAddedBus}
              className="w-full py-3 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-xl border border-blue-200 flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Eye size={16} />
              <span>View Added Bus Details</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <img
            src="/images/coastal-private-bus.jpg"
            alt="Karavali-Transit Bus"
            className="save-confirmation-bus-img"
          />
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: ADD / EDIT BUS WIZARD (SCREENS 4, 5, 6, 7)
  // =========================================================================
  if (viewMode === 'add-bus') {
    return (
      <div className="owner-portal-root p-6 overflow-y-auto">
        <div className="wizard-container">
          {/* Header */}
          <div className="wizard-header">
            <h1 className="wizard-title">{isEditingBus ? 'Edit Bus' : 'Add New Bus'}</h1>
            <p className="wizard-subtitle">
              {wizardStep === 1 && (isEditingBus ? 'Update the basic information about your bus' : 'Enter the basic information about your bus')}
              {wizardStep === 2 && 'Enter route details and stop by stop arrival times'}
              {wizardStep === 3 && 'Enter schedule and service information'}
              {wizardStep === 4 && (isEditingBus ? 'Review all changes before saving' : 'Review all the details before saving')}
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="wizard-stepper">
            <div className="wizard-stepper-line" />

            <div className={`wizard-step-node ${wizardStep === 1 ? 'active' : wizardStep > 1 ? 'completed' : ''}`}>
              <div className="wizard-step-circle">{wizardStep > 1 ? '✓' : '1'}</div>
              <span className="wizard-step-label">Basic Details</span>
            </div>

            <div className={`wizard-step-node ${wizardStep === 2 ? 'active' : wizardStep > 2 ? 'completed' : ''}`}>
              <div className="wizard-step-circle">{wizardStep > 2 ? '✓' : '2'}</div>
              <span className="wizard-step-label">Route &amp; Stops</span>
            </div>

            <div className={`wizard-step-node ${wizardStep === 3 ? 'active' : wizardStep > 3 ? 'completed' : ''}`}>
              <div className="wizard-step-circle">{wizardStep > 3 ? '✓' : '3'}</div>
              <span className="wizard-step-label">Schedule</span>
            </div>

            <div className={`wizard-step-node ${wizardStep === 4 ? 'active' : ''}`}>
              <div className="wizard-step-circle">4</div>
              <span className="wizard-step-label">Review</span>
            </div>
          </div>

          {wizardError && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{wizardError}</span>
            </div>
          )}

          {/* STEP 1: Basic Details (Screen 4) */}
          {wizardStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Bus Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="KA 19 AB 1234"
                    value={wizardForm.vehicle_number}
                    onChange={(e) => setWizardForm({ ...wizardForm, vehicle_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-extrabold text-slate-900 uppercase focus:border-blue-600 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">Example: KA 19 AB 1234</span>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Bus Name / Service Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Shri Durga Prasad"
                    value={wizardForm.bus_name}
                    onChange={(e) => setWizardForm({ ...wizardForm, bus_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Bus Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={wizardForm.service_type}
                    onChange={(e) => setWizardForm({ ...wizardForm, service_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="Non AC">Non AC</option>
                    <option value="AC">AC</option>
                    <option value="Express">Express</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Total Seats <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={wizardForm.total_seats}
                    onChange={(e) => setWizardForm({ ...wizardForm, total_seats: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              {/* Photo Upload Box */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Bus Photo (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden group">
                  {wizardForm.photo_preview || wizardForm.photo_url ? (
                    <img
                      src={wizardForm.photo_preview || wizardForm.photo_url}
                      alt="Bus preview"
                      className="w-full h-40 object-cover rounded-xl mb-3 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                      <Upload size={22} />
                    </div>
                  )}

                  <label className="cursor-pointer text-xs font-extrabold text-blue-600 hover:text-blue-800">
                    <span>Click to upload or drag and drop</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    (JPG, PNG - Max 5MB)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Route & Stops (Screen 5) */}
          {wizardStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Route Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="001"
                  value={wizardForm.route_number}
                  onChange={(e) => setWizardForm({ ...wizardForm, route_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">Example: 001, 12A, etc.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Start Location <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Mangaluru"
                      value={wizardForm.origin}
                      onChange={(e) => setWizardForm({ ...wizardForm, origin: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Destination <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Udupi"
                      value={wizardForm.destination}
                      onChange={(e) => setWizardForm({ ...wizardForm, destination: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Stops Table with Planned Arrival Times */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-extrabold text-slate-800 m-0">
                    Route Stops and Planned Arrival Times
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus size={14} />
                    <span>Add Stop</span>
                  </button>
                </div>

                <table className="wizard-stops-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>#</th>
                      <th>Stop Name</th>
                      <th>Planned Arrival Time</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizardForm.stops.map((stop, index) => (
                      <tr key={stop.id || index}>
                        <td className="font-bold text-slate-400">{index + 1}</td>
                        <td>
                          <input
                            type="text"
                            placeholder="Stop Name"
                            value={stop.stop_name}
                            onChange={(e) => handleStopFieldChange(stop.id, 'stop_name', e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600"
                          />
                        </td>
                        <td>
                          <div className="relative">
                            <Clock size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="06:30 AM"
                              value={stop.planned_arrival}
                              onChange={(e) => handleStopFieldChange(stop.id, 'planned_arrival', e.target.value)}
                              className="w-full p-2 pr-8 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-600"
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(stop.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Remove Stop"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: Schedule (Screen 6) — NO FARE FIELDS */}
          {wizardStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Departure Time from Start ({wizardForm.origin}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="06:30 AM"
                      value={wizardForm.departure_time}
                      onChange={(e) => setWizardForm({ ...wizardForm, departure_time: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Frequency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={wizardForm.frequency}
                    onChange={(e) => setWizardForm({ ...wizardForm, frequency: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekdays Only">Weekdays Only</option>
                    <option value="Weekends Only">Weekends Only</option>
                    <option value="Alternate Days">Alternate Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Estimated Total Journey Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="3 hours 30 minutes"
                  value={wizardForm.journey_duration}
                  onChange={(e) => setWizardForm({ ...wizardForm, journey_duration: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:border-blue-600 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Calculated from stop arrival times ({wizardForm.origin} ➔ {wizardForm.destination})
                </span>
              </div>

              {/* Read-Only Preview of Stops and Planned Arrival Times */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2 text-xs text-blue-700 font-bold">
                  <ShieldCheck size={16} />
                  <span>Stop-wise Arrival Times (Preview)</span>
                </div>
                <p className="text-[11px] text-slate-500 m-0">
                  Passengers will see these arrival times along with live tracking on the app.
                </p>

                <table className="wizard-stops-table bg-white">
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>#</th>
                      <th>Stop Name</th>
                      <th>Planned Arrival Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizardForm.stops.map((stop, index) => (
                      <tr key={index}>
                        <td className="font-bold text-slate-400">{index + 1}</td>
                        <td className="font-extrabold text-slate-900">{stop.stop_name}</td>
                        <td className="font-mono font-bold text-blue-700">{stop.planned_arrival}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: Review and Save (Screen 7) */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              {/* Bus Details Summary Box */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 flex flex-col sm:flex-row gap-5 items-center">
                <img
                  src={wizardForm.photo_preview || wizardForm.photo_url || '/images/coastal-private-bus.jpg'}
                  alt="Bus preview"
                  className="w-48 h-32 object-cover rounded-xl shadow-xs border border-slate-200 shrink-0"
                />
                <div className="grid grid-cols-2 gap-3 text-xs flex-1 w-full">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">Bus Number</span>
                    <strong className="text-slate-900 text-sm font-black font-mono">{wizardForm.vehicle_number}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">Bus Name</span>
                    <strong className="text-slate-900 text-sm font-black">{wizardForm.bus_name}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">Bus Type</span>
                    <strong className="text-slate-800 font-bold">{wizardForm.service_type}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <span className="text-slate-400 block font-bold text-[10px] uppercase tracking-wider mb-1">Total Seats</span>
                    <strong className="text-slate-800 font-bold">{wizardForm.total_seats}</strong>
                  </div>
                </div>
              </div>

              {/* Route Information */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider m-0">
                  Route Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold">Route Number</span>
                    <strong className="text-slate-900 font-extrabold">{wizardForm.route_number}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Route</span>
                    <strong className="text-slate-900 font-extrabold">
                      {wizardForm.origin} ➔ {wizardForm.destination}
                    </strong>
                  </div>
                </div>

                <h4 className="text-xs font-extrabold text-slate-700 m-0 pt-2">
                  Stop-wise Arrival Times
                </h4>
                <table className="wizard-stops-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>#</th>
                      <th>Stop Name</th>
                      <th>Planned Arrival Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizardForm.stops.map((stop, index) => (
                      <tr key={index}>
                        <td className="font-bold text-slate-400">{index + 1}</td>
                        <td className="font-extrabold text-slate-900">{stop.stop_name}</td>
                        <td className="font-mono font-bold text-blue-700">{stop.planned_arrival}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Schedule Summary */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider m-0">
                  Schedule
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold">Departure Time</span>
                    <strong className="text-slate-900 font-extrabold">
                      {wizardForm.departure_time} (from {wizardForm.origin})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Frequency</span>
                    <strong className="text-slate-900 font-extrabold">{wizardForm.frequency}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold">Estimated Journey Time</span>
                    <strong className="text-slate-900 font-extrabold">{wizardForm.journey_duration}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {wizardError && (
            <div className="mt-4 mb-2 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{wizardError}</span>
            </div>
          )}

          {/* Wizard Action Buttons */}
          <div className="wizard-actions-bar">
            {wizardStep === 1 ? (
              <button
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-extrabold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setWizardError('')
                  setWizardStep((prev) => prev - 1)
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-extrabold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}

            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveBus}
                disabled={isSavingBus}
                className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition"
              >
                <Check size={16} />
                <span>{isSavingBus ? (isEditingBus ? 'Saving Changes...' : 'Saving Bus...') : (isEditingBus ? 'Save Changes' : 'Save Bus')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW RENDER: OWNER DASHBOARD (SCREEN 3)
  // =========================================================================
  const stats = dashboardData.stats || {
    total_buses: buses.length,
    total_conductors: conductors.length,
    total_routes: 8,
    live_buses: 3,
  }

  return (
    <div className="owner-dashboard-container">
      {/* Dark Navy Sidebar */}
      <aside className="owner-sidebar">
        <div className="owner-sidebar-brand">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
            <Bus size={20} />
          </div>
          <div>
            <h2>Karavali-Transit</h2>
            <span>Owner Panel</span>
          </div>
        </div>

        <nav className="owner-sidebar-nav">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`owner-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <Home size={17} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('buses')}
            className={`owner-nav-item ${activeTab === 'buses' ? 'active' : ''}`}
          >
            <Bus size={17} />
            <span>My Buses</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conductors')}
            className={`owner-nav-item ${activeTab === 'conductors' ? 'active' : ''}`}
          >
            <Users size={17} />
            <span>Conductors</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routes')}
            className={`owner-nav-item ${activeTab === 'routes' ? 'active' : ''}`}
          >
            <Share2 size={17} />
            <span>Routes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`owner-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          >
            <FileText size={17} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`owner-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>
        </nav>

        <button type="button" onClick={handleLogout} className="owner-sidebar-logout">
          <LogOut size={17} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="owner-main-content">
        {/* Topbar */}
        <header className="owner-topbar">
          <div className="owner-profile-block">
            <div className="owner-avatar">
              {ownerAgencyName?.charAt(0) || 'R'}
            </div>
            <div>
              <h1 className="owner-welcome-title">
                Welcome, {ownerAgencyName || 'Rakesh Shetty'}
              </h1>
              <p className="owner-welcome-sub">
                Owner - {ownerEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" className="owner-notif-btn" title="3 unread fleet alerts">
              <Bell size={18} />
              <span className="owner-notif-badge">3</span>
            </button>
          </div>
        </header>

        {notice && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice('')} className="text-emerald-700 hover:text-emerald-900 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* 4 Stat KPI Cards */}
        <div className="owner-stats-grid">
          <div className="owner-kpi-card">
            <div className="owner-kpi-icon bg-blue-50 text-blue-600">
              <Bus size={22} />
            </div>
            <div>
              <h3 className="owner-kpi-val">{stats.total_buses || buses.length || 12}</h3>
              <p className="owner-kpi-label">Total Buses</p>
            </div>
          </div>

          <div className="owner-kpi-card">
            <div className="owner-kpi-icon bg-emerald-50 text-emerald-600">
              <Users size={22} />
            </div>
            <div>
              <h3 className="owner-kpi-val">{stats.total_conductors || conductors.length || 5}</h3>
              <p className="owner-kpi-label">Conductors</p>
            </div>
          </div>

          <div className="owner-kpi-card">
            <div className="owner-kpi-icon bg-amber-50 text-amber-600">
              <Share2 size={22} />
            </div>
            <div>
              <h3 className="owner-kpi-val">{stats.total_routes || 8}</h3>
              <p className="owner-kpi-label">Routes</p>
            </div>
          </div>

          <div className="owner-kpi-card">
            <div className="owner-kpi-icon bg-purple-50 text-purple-600">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center">
                <h3 className="owner-kpi-val">{stats.live_buses || 3}</h3>
                <span className="owner-kpi-tag bg-emerald-100 text-emerald-800">Today</span>
              </div>
              <p className="owner-kpi-label">Live Buses</p>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SCREEN 9: MY BUSES SECTION (DASHBOARD & MY BUSES TABS)          */}
        {/* ============================================================== */}
        {(activeTab === 'dashboard' || activeTab === 'buses') && (
          <div className="space-y-6">
            {/* Header Toolbar matching Screen 9 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 m-0">My Buses</h2>
                <p className="text-xs text-slate-500 m-0 mt-0.5 font-medium">
                  Manage your buses, view details, edit or delete buses.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative text-xs w-56 sm:w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by name, number, route..."
                    value={busSearchQuery}
                    onChange={(e) => setBusSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-blue-600 bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddNewBus}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Bus size={15} />
                  <span>Add New Bus</span>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {busesLoading && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-extrabold text-slate-600">Loading fleet buses from database...</p>
              </div>
            )}

            {/* Error State */}
            {!busesLoading && busesError && (
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={22} className="text-rose-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-extrabold text-rose-900 m-0">Failed to load buses</h4>
                    <p className="text-xs text-rose-700 m-0 mt-0.5">{busesError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetchDashboard(ownerToken)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty State */}
            {!busesLoading && !busesError && buses.length === 0 && (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                  <Bus size={32} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">No buses registered yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                    Add your first private bus to begin live GPS tracking, route scheduling, and conductor assignments across coastal Karnataka.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddNewBus}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>+ Add Your First Bus</span>
                </button>
              </div>
            )}

            {/* SCREEN 9 TABLE: Full Responsive Table */}
            {!busesLoading && !busesError && buses.length > 0 && (
              <div className="owner-buses-table-wrapper">
                <table className="owner-buses-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '90px' }}>Bus Photo</th>
                      <th>Bus Number</th>
                      <th>Bus Name</th>
                      <th>Type</th>
                      <th>Seats</th>
                      <th>Route</th>
                      <th>Schedule</th>
                      <th>Status</th>
                      <th style={{ width: '190px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buses
                      .filter((b) => {
                        if (!busSearchQuery.trim()) return true
                        const q = busSearchQuery.toLowerCase()
                        return (
                          b.bus_name?.toLowerCase().includes(q) ||
                          b.vehicle_number?.toLowerCase().includes(q) ||
                          b.route_number?.toLowerCase().includes(q) ||
                          b.origin?.toLowerCase().includes(q) ||
                          b.destination?.toLowerCase().includes(q)
                        )
                      })
                      .map((bus, idx) => {
                        const isSelected = selectedBusForView?.bus_id === bus.bus_id
                        return (
                          <tr
                            key={bus.bus_id}
                            className={isSelected ? 'selected-row' : ''}
                            onClick={() => setSelectedBusForView(bus)}
                          >
                            <td className="font-bold text-slate-400">{idx + 1}</td>
                            <td>
                              <img
                                src={bus.photo_url || '/images/coastal-private-bus.jpg'}
                                alt={bus.bus_name}
                                className="w-14 h-9 object-cover rounded-lg shadow-xs border border-slate-200"
                              />
                            </td>
                            <td className="font-mono font-black text-slate-900 text-xs">
                              {bus.vehicle_number}
                            </td>
                            <td className="font-extrabold text-slate-800 text-xs">
                              {bus.bus_name}
                            </td>
                            <td className="font-bold text-slate-600 text-xs">
                              {bus.service_type || 'Non AC'}
                            </td>
                            <td className="font-extrabold text-slate-800 text-xs">
                              {bus.total_seats || 45}
                            </td>
                            <td className="font-bold text-slate-700 text-xs">
                              {bus.origin || 'Mangaluru'} ➔ {bus.destination || 'Udupi'}
                            </td>
                            <td className="font-semibold text-slate-600 text-xs">
                              {bus.departure_time || '06:30 AM'} {bus.frequency || 'Daily'}
                            </td>
                            <td>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            </td>
                            <td>
                              <div
                                className="flex items-center justify-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBusForView(bus)
                                    const el = document.getElementById('view-bus-panel-anchor')
                                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                                  }}
                                  className="btn-action-view"
                                  title="View Details"
                                >
                                  <Eye size={12} />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditBus(bus)}
                                  className="btn-action-edit"
                                  title="Edit Bus"
                                >
                                  <Edit3 size={12} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePromptDelete(bus)}
                                  className="btn-action-delete"
                                  title="Delete Bus"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SCREEN 9 BOTTOM TWO-PANEL GRID: View Bus Details & Options */}
            {!busesLoading && buses.length > 0 && (
              <div id="view-bus-panel-anchor" className="dashboard-bottom-grid">
                {/* Left Panel: View Bus Details */}
                {selectedBusForView ? (
                  <div className="view-bus-panel">
                    <div className="view-bus-header">
                      <h3 className="text-base font-black text-slate-900 m-0">View Bus Details</h3>
                      <button
                        type="button"
                        onClick={() => setSelectedBusForView(null)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg"
                        title="Close details"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Left: Thumbnail & Specs */}
                      <div>
                        <img
                          src={selectedBusForView.photo_url || '/images/coastal-private-bus.jpg'}
                          alt={selectedBusForView.bus_name}
                          className="view-bus-panel-img mb-3"
                        />
                        <div className="mb-3">
                          <h4 className="text-base font-black text-slate-900 font-mono m-0">
                            {selectedBusForView.vehicle_number}
                          </h4>
                          <p className="text-xs font-extrabold text-slate-600 m-0 mt-0.5">
                            {selectedBusForView.bus_name}
                          </p>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-400 font-bold">Bus Type</span>
                            <span className="font-extrabold text-slate-800">
                              {selectedBusForView.service_type || 'Non AC'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-400 font-bold">Total Seats</span>
                            <span className="font-extrabold text-slate-800">
                              {selectedBusForView.total_seats || 45}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-400 font-bold">Route</span>
                            <span className="font-extrabold text-slate-800">
                              {selectedBusForView.origin || 'Mangaluru'} ➔ {selectedBusForView.destination || 'Udupi'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400 font-bold">Departure Time</span>
                            <span className="font-extrabold text-slate-800">
                              {selectedBusForView.departure_time || '06:30 AM'} ({selectedBusForView.frequency || 'Daily'})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Route Stops Vertical Timeline */}
                      <div>
                        <div className="flex items-center gap-1.5 text-blue-600 font-extrabold text-xs mb-3">
                          <Radio size={14} />
                          <span>Route Stops</span>
                        </div>

                        <div className="route-stops-timeline">
                          {(selectedBusForView.stops && selectedBusForView.stops.length > 0
                            ? selectedBusForView.stops
                            : [
                                { stop_name: selectedBusForView.origin || 'Mangaluru', planned_arrival: selectedBusForView.departure_time || '06:30 AM' },
                                { stop_name: selectedBusForView.destination || 'Udupi', planned_arrival: '10:00 AM' },
                              ]
                          ).map((stop, sIdx) => (
                            <div key={sIdx} className="route-stop-node">
                              <span className="font-extrabold text-slate-800 text-xs">
                                {stop.stop_name}
                              </span>
                              <span className="font-mono font-bold text-blue-600 text-xs">
                                - {stop.planned_arrival}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="view-bus-panel flex items-center justify-center p-8 text-center text-slate-400">
                    <div>
                      <Bus size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold">Select any bus from the table to view its details and planned route stops.</p>
                    </div>
                  </div>
                )}

                {/* Right Panel: Options (Screen 9) */}
                <div className="options-panel">
                  <h3 className="text-base font-black text-slate-900 mb-4 m-0">Options</h3>

                  <div className="space-y-3">
                    <div onClick={handleAddNewBus} className="option-action-item blue">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                          <Plus size={18} />
                        </div>
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">Add New Bus</strong>
                          <p className="text-[11px] text-slate-500 font-bold m-0 mt-0.5">Register another bus for your fleet</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-blue-600 shrink-0" />
                    </div>

                    <div onClick={() => handleEditBus(selectedBusForView || buses[0])} className="option-action-item green">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                          <Edit3 size={16} />
                        </div>
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">Edit Bus Details</strong>
                          <p className="text-[11px] text-slate-500 font-bold m-0 mt-0.5">Update bus information, route or schedule</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-emerald-600 shrink-0" />
                    </div>

                    <div onClick={() => handlePromptDelete(selectedBusForView || buses[0])} className="option-action-item red">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                          <Trash2 size={16} />
                        </div>
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">Delete Bus</strong>
                          <p className="text-[11px] text-slate-500 font-bold m-0 mt-0.5">Remove bus from your fleet (with confirmation)</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-rose-600 shrink-0" />
                    </div>

                    <div
                      onClick={() => {
                        if (!selectedBusForView && buses.length > 0) {
                          setSelectedBusForView(buses[0])
                        }
                        const el = document.getElementById('view-bus-panel-anchor')
                        if (el) el.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="option-action-item purple"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                          <Eye size={16} />
                        </div>
                        <div>
                          <strong className="text-xs font-black text-slate-900 block">View Bus Details</strong>
                          <p className="text-[11px] text-slate-500 font-bold m-0 mt-0.5">See complete bus information and route stops</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-purple-600 shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Extra Section: Recent Activity (if activeTab === 'dashboard') */}
            {activeTab === 'dashboard' && (
              <div className="owner-card-panel mt-6">
                <div className="owner-panel-header">
                  <h2 className="owner-panel-title">Recent Activity</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="owner-panel-link"
                  >
                    View All →
                  </button>
                </div>

                <div>
                  {(dashboardData.recent_activity?.length > 0
                    ? dashboardData.recent_activity
                    : [
                        {
                          action_type: 'bus_added',
                          title: 'Bus KA 19 AB 1234 added',
                          created_at: '2 hours ago',
                        },
                        {
                          action_type: 'conductor_assigned',
                          title: 'Conductor Manjunath assigned',
                          created_at: '4 hours ago',
                        },
                        {
                          action_type: 'route_updated',
                          title: 'Route Mangaluru - Udupi updated',
                          created_at: '6 hours ago',
                        },
                      ]
                  ).map((act, index) => (
                    <div key={index} className="owner-activity-row">
                      <div
                        className={`owner-activity-icon ${
                          act.action_type === 'bus_added'
                            ? 'bg-emerald-50 text-emerald-600'
                            : act.action_type === 'conductor_assigned'
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {act.action_type === 'bus_added' ? (
                          <Bus size={18} />
                        ) : act.action_type === 'conductor_assigned' ? (
                          <Users size={18} />
                        ) : (
                          <Share2 size={18} />
                        )}
                      </div>
                      <div>
                        <h4 className="owner-activity-text">{act.title}</h4>
                        <p className="owner-activity-time">{act.created_at || 'Just now'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extra Section: Conductor PIN & Tracking Cards (if activeTab === 'buses') */}
            {activeTab === 'buses' && buses.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-black text-slate-800 m-0">
                  Secret Conductor PINs &amp; Direct Portal Switch
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {buses.map((bus) => {
                    const pin = bus.conductor_pin || '4509'
                    const isVisible = Boolean(visiblePins[bus.bus_id])
                    const isCopied = copiedPinBusId === bus.bus_id
                    return (
                      <div
                        key={bus.bus_id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-sm font-extrabold text-slate-900 block">
                              {bus.bus_name}
                            </strong>
                            <span className="font-mono text-xs font-bold text-blue-700">
                              {bus.vehicle_number}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">
                            Route #{bus.route_number || '001'}
                          </span>
                        </div>

                        {/* Secret PIN Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-extrabold text-slate-400 block">
                              Secret Conductor PIN
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <strong className="font-mono text-base font-extrabold tracking-widest text-slate-900">
                                {isVisible ? pin : '••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() => setVisiblePins({ ...visiblePins, [bus.bus_id]: !isVisible })}
                                className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                                title={isVisible ? 'Hide PIN' : 'Reveal PIN'}
                              >
                                {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(pin)
                                  setCopiedPinBusId(bus.bus_id)
                                  setTimeout(() => setCopiedPinBusId(null), 2000)
                                }}
                                className="p-1 text-slate-500 hover:text-blue-700 rounded cursor-pointer"
                                title="Copy PIN"
                              >
                                {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUpdatePin(bus.bus_id, pin)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition cursor-pointer"
                          >
                            Change PIN
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSwitchToConductor?.(bus.vehicle_number, pin)}
                          className="w-full py-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Radio size={14} />
                          <span>Switch to Conductor Portal for this Bus ➔</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONDUCTORS */}
        {activeTab === 'conductors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 m-0">Authorized Conductors</h2>
                <p className="text-xs text-slate-500 m-0">Manage duty credentials and bus assignments</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConductorModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>+ Authorize Conductor</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {conductors.map((cond) => (
                <div key={cond.conductor_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Users size={18} />
                      </div>
                      <div>
                        <strong className="text-sm font-extrabold text-slate-900 block">{cond.name}</strong>
                        <span className="text-xs text-slate-500 font-semibold">{cond.phone}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {cond.status || 'Active'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    Assigned Bus:{' '}
                    <strong>
                      {cond.bus_name ? `${cond.bus_name} (${cond.vehicle_number})` : 'Unassigned (Standby)'}
                    </strong>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteConductor(cond.conductor_id, cond.name)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                    >
                      Revoke Authorization
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ROUTES */}
        {activeTab === 'routes' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 m-0">Fleet Corridors &amp; Routes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {buses.map((bus) => (
                <div key={bus.bus_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                      Route #{bus.route_number || '001'}
                    </span>
                    <strong className="text-sm font-extrabold text-slate-900">{bus.bus_name}</strong>
                  </div>

                  <div className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                    <MapPin size={15} className="text-emerald-600" />
                    <span>{bus.origin || 'Mangaluru'}</span>
                    <span className="text-slate-400">➔</span>
                    <MapPin size={15} className="text-rose-600" />
                    <span>{bus.destination || 'Udupi'}</span>
                  </div>

                  {bus.stops?.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">
                        Planned Intermediate Stops
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {bus.stops.map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                          >
                            {s.stop_name} ({s.planned_arrival})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 m-0">Fleet Operational Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <span className="text-slate-400 text-xs font-bold block">Total Fleet Passenger Capacity</span>
                <strong className="text-2xl font-black text-slate-900 block mt-1">
                  {buses.reduce((sum, b) => sum + (Number(b.total_seats) || 45), 0)} Seats
                </strong>
                <span className="text-[11px] text-blue-600 mt-1 block">Active across NH-66 corridor</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <span className="text-slate-400 text-xs font-bold block">Conductor PIN Protection</span>
                <strong className="text-2xl font-black text-emerald-600 block mt-1">100% Secured</strong>
                <span className="text-[11px] text-emerald-700 mt-1 block">Encrypted 4-digit check-in</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <span className="text-slate-400 text-xs font-bold block">Service Punctuality Status</span>
                <strong className="text-2xl font-black text-indigo-700 block mt-1">98.4% On Schedule</strong>
                <span className="text-[11px] text-slate-500 mt-1 block">Based on GPS corridor telemetry</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl space-y-4">
            <h2 className="text-base font-extrabold text-slate-900 m-0">Fleet Owner Profile</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold">Verified Gmail</label>
                <strong className="text-slate-900 text-sm font-black">{ownerEmail}</strong>
              </div>
              <div>
                <label className="text-slate-400 block font-bold">Agency Name</label>
                <strong className="text-slate-900 text-sm font-black">{ownerAgencyName}</strong>
              </div>
              <div>
                <label className="text-slate-400 block font-bold">Session Status</label>
                <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                  Active (Bearer Token Valid for 12 Hours)
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Authorize Conductor Modal */}
      {showConductorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 m-0">Authorize New Conductor</h3>
              <button
                type="button"
                onClick={() => setShowConductorModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConductor} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Manjunath Shetty"
                  value={conductorForm.name}
                  onChange={(e) => setConductorForm({ ...conductorForm, name: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Mobile Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 98451 12345"
                  value={conductorForm.phone}
                  onChange={(e) => setConductorForm({ ...conductorForm, phone: e.target.value })}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assign to Bus (Optional)</label>
                <select
                  value={conductorForm.assigned_bus_id}
                  onChange={(e) => setConductorForm({ ...conductorForm, assigned_bus_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-white focus:border-blue-600 outline-none"
                >
                  <option value="">Unassigned (Standby Pool)</option>
                  {buses.map((b) => (
                    <option key={b.bus_id} value={b.bus_id}>
                      {b.bus_name} ({b.vehicle_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConductorModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={conductorSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow"
                >
                  {conductorSaving ? 'Saving...' : 'Authorize Conductor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Planned Stop Timetable Modal */}
      {selectedBusForTimetable && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBusForTimetable(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 m-0">
                  {selectedBusForTimetable.bus_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-blue-700 font-extrabold">
                  <span className="font-mono">{selectedBusForTimetable.vehicle_number}</span>
                  <span>•</span>
                  <span>Route #{selectedBusForTimetable.route_number}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBusForTimetable(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Origin ➔ Destination</span>
                <strong className="text-slate-800">
                  {selectedBusForTimetable.origin} ➔ {selectedBusForTimetable.destination}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Frequency</span>
                <strong className="text-slate-800">{selectedBusForTimetable.frequency || 'Daily'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Departure Time</span>
                <strong className="text-slate-800">{selectedBusForTimetable.departure_time || '06:30 AM'}</strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Duration</span>
                <strong className="text-slate-800">{selectedBusForTimetable.journey_duration || '3h 30m'}</strong>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Planned Stop-Wise Arrival Times
              </h4>
              <table className="wizard-stops-table">
                <thead>
                  <tr>
                    <th style={{ width: '48px' }}>#</th>
                    <th>Stop Name</th>
                    <th>Planned Arrival</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBusForTimetable.stops || []).map((stop, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-slate-400">{stop.stop_order || idx + 1}</td>
                      <td className="font-extrabold text-slate-900">{stop.stop_name}</td>
                      <td className="font-mono font-bold text-blue-700">{stop.planned_arrival}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBusForTimetable(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold rounded-xl transition cursor-pointer"
              >
                Close Timetable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Bus Confirmation Modal */}
      {deleteConfirmBus && (
        <div className="delete-modal-backdrop" onClick={() => setDeleteConfirmBus(null)}>
          <div className="delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-icon">
              <Trash2 size={26} />
            </div>
            <h3 className="delete-modal-title">Delete Bus</h3>
            <p className="delete-modal-desc">
              Are you sure you want to delete this bus? Its associated route and schedule information may also be removed.
            </p>
            <div className="delete-modal-bus-badge">
              {deleteConfirmBus.vehicle_number} — {deleteConfirmBus.bus_name}
            </div>
            <div className="delete-modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirmBus(null)}
                className="btn-modal-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingBus}
                className="btn-modal-delete"
              >
                {isDeletingBus ? 'Deleting...' : 'Delete Bus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
