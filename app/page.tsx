'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { FiMic, FiMicOff, FiPhone, FiPhoneOff, FiMessageSquare, FiSettings, FiUsers, FiTrendingUp, FiDollarSign, FiTarget, FiDownload, FiSearch, FiRefreshCw, FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown, FiMail, FiUser, FiBriefcase, FiCalendar, FiList, FiInfo, FiCheckCircle, FiAlertCircle, FiExternalLink } from 'react-icons/fi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { format } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────────────────────
const AGENT_ID = '699943f2a3f97c34732baeba'
const VOICE_SESSION_URL = 'https://voice-sip.studio.lyzr.ai/session/start'
const BOOKING_URL = 'https://calendly.com' // Replace with your actual booking/consultation URL

// Keywords that signal the agent wants to redirect to booking
const REDIRECT_KEYWORDS = [
  'redirecting you now',
  'redirect you now',
  'redirecting you to',
  'schedule a consultation',
  'schedule a quick strategy',
  'booking page',
  'book a consultation',
  'next step is to schedule',
]

function containsRedirectIntent(text: string): boolean {
  const lower = text.toLowerCase()
  return REDIRECT_KEYWORDS.some((kw) => lower.includes(kw))
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface VoiceSession {
  wsUrl: string
  sessionId: string
  audioConfig: {
    sampleRate: number
    channels: number
    encoding: string
  }
}

interface TranscriptMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
  isFinal: boolean
}

interface Lead {
  id: string
  fullName: string
  email: string
  phone: string
  businessType: string
  projectType: string
  budgetRange: string
  timeline: string
  features: string[]
  notes: string
  timestamp: string
  isReturning: boolean
  sourceTag: string
  conversationTranscript: TranscriptMessage[]
  status: 'new' | 'contacted' | 'qualified' | 'converted'
}

type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing' | 'error'

type WSMessage =
  | { type: 'audio'; audio: string; sampleRate: number }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string; final?: boolean }
  | { type: 'thinking' }
  | { type: 'clear' }
  | { type: 'error'; message: string }

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_LEADS: Lead[] = [
  {
    id: 'lead-001',
    fullName: 'Sarah Mitchell',
    email: 'sarah.mitchell@greenleafdesigns.com',
    phone: '+1 (415) 555-0142',
    businessType: 'Interior Design Studio',
    projectType: 'Full Website Redesign',
    budgetRange: '$15,000 - $25,000',
    timeline: '3-4 months',
    features: ['Portfolio Gallery', 'Client Testimonials', 'Booking System', 'Blog'],
    notes: 'Currently on Squarespace, wants to migrate to custom solution. Prefers minimalist aesthetic.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isReturning: false,
    sourceTag: 'Website',
    conversationTranscript: [
      { role: 'assistant', text: 'Welcome to Elevra AI. I\'m here to help you plan your next digital project. Could you start by telling me about your business?', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isFinal: true },
      { role: 'user', text: 'Hi, I run an interior design studio called GreenLeaf Designs. We need a completely new website.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 15000).toISOString(), isFinal: true },
      { role: 'assistant', text: 'That sounds wonderful! A strong digital presence is crucial for showcasing design work. What features are most important to you?', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000).toISOString(), isFinal: true },
      { role: 'user', text: 'I need a stunning portfolio gallery, client testimonials, a booking system for consultations, and a blog for design tips.', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 50000).toISOString(), isFinal: true },
    ],
    status: 'new',
  },
  {
    id: 'lead-002',
    fullName: 'James Donovan',
    email: 'james@donovanlegal.com',
    phone: '+1 (312) 555-0198',
    businessType: 'Law Firm',
    projectType: 'Custom Web Application',
    budgetRange: '$30,000 - $50,000',
    timeline: '5-6 months',
    features: ['Client Portal', 'Document Management', 'Appointment Scheduling', 'Secure Messaging'],
    notes: 'Needs HIPAA-adjacent security compliance. Wants integration with existing case management system.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isReturning: true,
    sourceTag: 'Referral',
    conversationTranscript: [
      { role: 'assistant', text: 'Welcome back, James! Last time we discussed a client portal for Donovan Legal. Would you like to continue from where we left off?', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), isFinal: true },
      { role: 'user', text: 'Yes, we\'ve finalized our budget range. We\'re looking at $30,000 to $50,000 for the full application.', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 20000).toISOString(), isFinal: true },
    ],
    status: 'qualified',
  },
  {
    id: 'lead-003',
    fullName: 'Priya Patel',
    email: 'priya@artisanbakes.co',
    phone: '+1 (510) 555-0267',
    businessType: 'Bakery & Cafe',
    projectType: 'E-Commerce Store',
    budgetRange: '$8,000 - $12,000',
    timeline: '2-3 months',
    features: ['Online Ordering', 'Menu Display', 'Delivery Tracking', 'Customer Reviews'],
    notes: 'Wants integration with DoorDash and UberEats APIs. Mobile-first design priority.',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isReturning: false,
    sourceTag: 'Instagram',
    conversationTranscript: [
      { role: 'assistant', text: 'Hello! I\'m your Elevra AI consultant. Tell me about the project you have in mind.', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), isFinal: true },
      { role: 'user', text: 'I own Artisan Bakes, a bakery and cafe. I want to set up online ordering for our pastries and cakes.', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 12000).toISOString(), isFinal: true },
    ],
    status: 'contacted',
  },
  {
    id: 'lead-004',
    fullName: 'Marcus Chen',
    email: 'marcus@fitpulse.io',
    phone: '+1 (206) 555-0334',
    businessType: 'Fitness Tech Startup',
    projectType: 'Mobile App + Landing Page',
    budgetRange: '$50,000 - $80,000',
    timeline: '6-8 months',
    features: ['Workout Tracking', 'Social Features', 'AI Coach', 'Subscription Management', 'Analytics Dashboard'],
    notes: 'Series A funded. Needs iOS and Android. Wants to launch beta in 4 months.',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    isReturning: false,
    sourceTag: 'LinkedIn',
    conversationTranscript: [
      { role: 'assistant', text: 'Welcome to Elevra AI. How can I help with your project today?', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), isFinal: true },
      { role: 'user', text: 'We\'re building a fitness app called FitPulse and need a landing page too. We\'ve raised our Series A and are ready to build.', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 18000).toISOString(), isFinal: true },
    ],
    status: 'converted',
  },
  {
    id: 'lead-005',
    fullName: 'Elena Rodriguez',
    email: 'elena@verdeorganic.com',
    phone: '+1 (305) 555-0411',
    businessType: 'Organic Food Distributor',
    projectType: 'B2B Portal',
    budgetRange: '$20,000 - $35,000',
    timeline: '4-5 months',
    features: ['Wholesale Ordering', 'Inventory Dashboard', 'Route Optimization', 'Invoice Generation'],
    notes: 'Serves 200+ restaurants in the Miami area. Current ordering system is phone/email based.',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    isReturning: false,
    sourceTag: 'Google Ads',
    conversationTranscript: [
      { role: 'assistant', text: 'Hello! I\'m Elevra AI, your digital project consultant. What brings you here today?', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), isFinal: true },
      { role: 'user', text: 'We need a B2B ordering portal for our restaurant clients. Right now everything is done over the phone and it\'s getting unmanageable.', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 14000).toISOString(), isFinal: true },
    ],
    status: 'new',
  },
]

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Voice Orb Component ──────────────────────────────────────────────────────
function VoiceOrb({
  state,
  isMuted,
  onTap,
  onMuteToggle,
  onEnd,
}: {
  state: VoiceState
  isMuted: boolean
  onTap: () => void
  onMuteToggle: () => void
  onEnd: () => void
}) {
  const isActive = state === 'listening' || state === 'speaking' || state === 'processing'

  const orbBaseClasses = "relative w-48 h-48 md:w-56 md:h-56 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 select-none"

  const getOrbStyle = (): React.CSSProperties => {
    switch (state) {
      case 'idle':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(220, 60%, 55%), hsl(220, 70%, 40%))',
          boxShadow: '0 0 40px hsla(220, 70%, 50%, 0.2), 0 0 80px hsla(220, 70%, 50%, 0.08)',
        }
      case 'connecting':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(220, 65%, 58%), hsl(220, 70%, 42%))',
          boxShadow: '0 0 50px hsla(220, 70%, 50%, 0.3), 0 0 100px hsla(220, 70%, 50%, 0.12)',
        }
      case 'listening':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(220, 70%, 60%), hsl(220, 75%, 45%))',
          boxShadow: '0 0 60px hsla(220, 70%, 50%, 0.35), 0 0 120px hsla(220, 70%, 50%, 0.15)',
        }
      case 'speaking':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(220, 75%, 62%), hsl(220, 80%, 48%))',
          boxShadow: '0 0 70px hsla(220, 70%, 50%, 0.4), 0 0 140px hsla(220, 70%, 50%, 0.2)',
        }
      case 'processing':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(220, 65%, 57%), hsl(220, 72%, 43%))',
          boxShadow: '0 0 55px hsla(220, 70%, 50%, 0.3), 0 0 110px hsla(220, 70%, 50%, 0.12)',
        }
      case 'error':
        return {
          background: 'radial-gradient(circle at 40% 40%, hsl(0, 65%, 55%), hsl(0, 55%, 40%))',
          boxShadow: '0 0 40px hsla(0, 72%, 51%, 0.3), 0 0 80px hsla(0, 72%, 51%, 0.1)',
        }
      default:
        return {}
    }
  }

  const getPulseClass = () => {
    if (state === 'idle') return 'animate-pulse'
    if (state === 'connecting') return 'animate-spin'
    return ''
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Outer Rings */}
      <div className="relative flex items-center justify-center">
        {/* Ring 1 - outermost */}
        {(state === 'listening' || state === 'speaking') && (
          <div
            className="absolute w-72 h-72 md:w-80 md:h-80 rounded-full border border-accent/20 animate-ping"
            style={{ animationDuration: '3s' }}
          />
        )}
        {/* Ring 2 */}
        {(state === 'listening' || state === 'speaking') && (
          <div
            className="absolute w-64 h-64 md:w-72 md:h-72 rounded-full border border-accent/30 animate-ping"
            style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
          />
        )}
        {/* Ring 3 - for speaking waveform effect */}
        {state === 'speaking' && (
          <div
            className="absolute w-56 h-56 md:w-64 md:h-64 rounded-full border-2 border-accent/40 animate-ping"
            style={{ animationDuration: '2s', animationDelay: '0.2s' }}
          />
        )}

        {/* Main Orb */}
        <div
          className={orbBaseClasses}
          style={getOrbStyle()}
          onClick={state === 'idle' || state === 'error' ? onTap : undefined}
          role="button"
          tabIndex={0}
          aria-label={state === 'idle' ? 'Start voice session' : 'Voice session active'}
        >
          {/* Inner glow */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

          {/* Waveform bars inside orb for speaking state */}
          {state === 'speaking' && (
            <div className="absolute inset-0 flex items-center justify-center gap-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-white/70 rounded-full animate-bounce"
                  style={{
                    height: `${20 + Math.random() * 30}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.5 + Math.random() * 0.5}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Icon */}
          <div className={`relative z-10 ${getPulseClass()}`}>
            {state === 'idle' && <FiPhone className="w-10 h-10 text-white" />}
            {state === 'connecting' && (
              <FiRefreshCw className="w-10 h-10 text-white animate-spin" />
            )}
            {state === 'listening' && !isMuted && (
              <FiMic className="w-10 h-10 text-white" />
            )}
            {state === 'listening' && isMuted && (
              <FiMicOff className="w-10 h-10 text-white/50" />
            )}
            {state === 'speaking' && (
              <div className="w-10 h-10" />
            )}
            {state === 'processing' && (
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {state === 'error' && <FiAlertCircle className="w-10 h-10 text-destructive" />}
          </div>
        </div>
      </div>

      {/* Controls */}
      {isActive && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-12 h-12 border-border/50 bg-secondary/50 hover:bg-secondary"
            onClick={onMuteToggle}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <FiMicOff className="w-5 h-5 text-muted-foreground" />
            ) : (
              <FiMic className="w-5 h-5 text-accent" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full w-12 h-12"
            onClick={onEnd}
            aria-label="End call"
          >
            <FiPhoneOff className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ state }: { state: VoiceState }) {
  const labels: Record<VoiceState, string> = {
    idle: 'Tap to Start',
    connecting: 'Connecting...',
    listening: 'Listening...',
    speaking: 'Speaking...',
    processing: 'Processing...',
    error: 'Connection Error',
  }

  const badgeStyle = state === 'error'
    ? 'bg-destructive/20 text-destructive border-destructive/30'
    : state === 'idle'
    ? 'bg-secondary text-muted-foreground border-border'
    : 'bg-accent/15 text-accent border-accent/30'

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium tracking-tight ${badgeStyle}`}>
      {(state === 'listening' || state === 'speaking' || state === 'connecting') && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      )}
      {labels[state]}
    </div>
  )
}

// ─── Transcript Panel ─────────────────────────────────────────────────────────
function TranscriptPanel({
  messages,
  isOpen,
  onToggle,
}: {
  messages: TranscriptMessage[]
  isOpen: boolean
  onToggle: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  return (
    <div className="w-full max-w-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="mb-2 text-muted-foreground hover:text-foreground gap-2"
      >
        <FiMessageSquare className="w-4 h-4" />
        {isOpen ? 'Hide Transcript' : 'Show Transcript'}
        {messages.length > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">{messages.length}</Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-0">
            <div
              ref={scrollRef}
              className="max-h-64 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Conversation will appear here...
                </p>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-xs text-muted-foreground px-1">
                      {msg.role === 'user' ? 'You' : 'Elevra AI'}
                      {' '}
                      {formatTime(msg.timestamp)}
                    </span>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-accent/20 text-foreground rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Notification Banner ──────────────────────────────────────────────────────
function InlineNotification({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-accent/15 border border-accent/25 rounded-xl text-accent text-sm font-medium tracking-tight backdrop-blur-sm transition-opacity duration-500">
      <div className="flex items-center gap-2">
        <FiCheckCircle className="w-4 h-4" />
        {message}
      </div>
    </div>
  )
}

// ─── Silence Timer Cue ────────────────────────────────────────────────────────
function SilenceCue({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse mt-2">
      <FiMic className="w-3.5 h-3.5" />
      <span>Still listening... go ahead and speak</span>
    </div>
  )
}

// ─── Booking Redirect Overlay ─────────────────────────────────────────────────
function BookingRedirectOverlay({
  show,
  countdown,
  onCancel,
  onGoNow,
}: {
  show: boolean
  countdown: number
  onCancel: () => void
  onGoNow: () => void
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-xl border-border">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-accent/15 flex items-center justify-center">
            <FiCalendar className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Ready to Book Your Consultation
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Based on your requirements, the next step is a quick strategy consultation.
              Redirecting in <span className="font-bold text-accent">{countdown}</span> seconds...
            </p>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Stay Here
            </Button>
            <Button
              className="flex-1 gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={onGoNow}
            >
              <FiExternalLink className="w-4 h-4" />
              Book Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Admin Stats Card ─────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  accentColor,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accentColor: string
}) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentColor + '20', color: accentColor }}
        >
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
          <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts: string): string {
  try {
    return format(new Date(ts), 'h:mm a')
  } catch {
    return ''
  }
}

function formatDate(ts: string): string {
  try {
    return format(new Date(ts), 'MMM d, yyyy')
  } catch {
    return ''
  }
}

function formatDateFull(ts: string): string {
  try {
    return format(new Date(ts), 'MMM d, yyyy h:mm a')
  } catch {
    return ''
  }
}

function generateId(): string {
  return 'lead-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

function extractBudget(text: string): number {
  const match = text.match(/\$[\d,]+/)
  if (match) {
    return parseInt(match[0].replace(/[$,]/g, ''), 10)
  }
  return 0
}

function downloadCSV(leads: Lead[]) {
  if (!Array.isArray(leads) || leads.length === 0) return
  const headers = ['Name', 'Email', 'Phone', 'Business Type', 'Project Type', 'Budget Range', 'Timeline', 'Features', 'Notes', 'Date', 'Status', 'Returning', 'Source']
  const rows = leads.map((l) => [
    l.fullName,
    l.email,
    l.phone,
    l.businessType,
    l.projectType,
    l.budgetRange,
    l.timeline,
    Array.isArray(l.features) ? l.features.join('; ') : '',
    l.notes,
    formatDateFull(l.timestamp),
    l.status,
    l.isReturning ? 'Yes' : 'No',
    l.sourceTag,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `elevra-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Leads Table Component ────────────────────────────────────────────────────
function LeadsTable({
  leads,
  onSelectLead,
}: {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: 'Name',
        cell: ({ row }) => (
          <div className="font-medium text-foreground">{row.original.fullName}</div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.phone}</span>
        ),
      },
      {
        accessorKey: 'businessType',
        header: 'Business',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.businessType}</span>
        ),
      },
      {
        accessorKey: 'projectType',
        header: 'Project',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-normal">{row.original.projectType}</Badge>
        ),
      },
      {
        accessorKey: 'budgetRange',
        header: 'Budget',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-accent">{row.original.budgetRange}</span>
        ),
        sortingFn: (rowA, rowB) => {
          const a = extractBudget(rowA.original.budgetRange)
          const b = extractBudget(rowB.original.budgetRange)
          return a - b
        },
      },
      {
        accessorKey: 'timeline',
        header: 'Timeline',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.timeline}</span>
        ),
      },
      {
        accessorKey: 'timestamp',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.original.timestamp)}</span>
        ),
        sortingFn: (rowA, rowB) => {
          return new Date(rowA.original.timestamp).getTime() - new Date(rowB.original.timestamp).getTime()
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status
          const colors: Record<string, string> = {
            new: 'bg-accent/10 text-accent border-accent/25',
            contacted: 'bg-blue-500/10 text-blue-600 border-blue-500/25',
            qualified: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
            converted: 'bg-green-500/10 text-green-600 border-green-500/25',
          }
          return (
            <Badge variant="outline" className={`text-xs capitalize ${colors[status] ?? ''}`}>
              {status}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'isReturning',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.isReturning ? 'secondary' : 'outline'} className="text-xs">
            {row.original.isReturning ? 'Returning' : 'New'}
          </Badge>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 8 },
    },
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-10 bg-secondary/50"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/50 bg-secondary/30">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <FiArrowUp className="w-3 h-3" />}
                        {header.column.getIsSorted() === 'desc' && <FiArrowDown className="w-3 h-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <FiUsers className="w-10 h-10 text-muted-foreground/40" />
                      <p className="font-medium">No leads yet</p>
                      <p className="text-xs max-w-xs">Start a voice consultation session to begin capturing leads automatically.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/30 hover:bg-secondary/20 cursor-pointer transition-colors"
                    onClick={() => onSelectLead(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            {' '} ({table.getFilteredRowModel().rows.length} leads)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <FiChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <FiChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Lead Detail Sheet ────────────────────────────────────────────────────────
function LeadDetailSheet({
  lead,
  open,
  onClose,
}: {
  lead: Lead | null
  open: boolean
  onClose: () => void
}) {
  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background border-border">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <FiUser className="w-5 h-5 text-accent" />
            {lead.fullName}
          </SheetTitle>
          <SheetDescription>Lead details and conversation history</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Contact Info */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FiMail className="w-4 h-4 text-muted-foreground" />
                <span>{lead.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FiPhone className="w-4 h-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FiBriefcase className="w-4 h-4 text-muted-foreground" />
                <span>{lead.businessType}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FiCalendar className="w-4 h-4 text-muted-foreground" />
                <span>{formatDateFull(lead.timestamp)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className="text-xs">{lead.projectType}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium text-accent">{lead.budgetRange}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Timeline</span>
                <span>{lead.timeline}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary" className="text-xs capitalize">{lead.status}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="outline" className="text-xs">{lead.sourceTag}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          {Array.isArray(lead.features) && lead.features.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FiList className="w-4 h-4 text-accent" />
                  Requested Features
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  {lead.features.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {f}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {lead.notes && (
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FiInfo className="w-4 h-4 text-accent" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">{lead.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Conversation Transcript */}
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiMessageSquare className="w-4 h-4 text-accent" />
                Conversation Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Array.isArray(lead.conversationTranscript) && lead.conversationTranscript.length > 0 ? (
                  lead.conversationTranscript.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-muted-foreground">
                        {msg.role === 'user' ? 'Visitor' : 'Elevra AI'} {formatTime(msg.timestamp)}
                      </span>
                      <div className={`max-w-[90%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-accent/15 rounded-br-sm' : 'bg-secondary rounded-bl-sm'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">No transcript available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({
  projectTypeFilter,
  setProjectTypeFilter,
  budgetFilter,
  setBudgetFilter,
  returningFilter,
  setReturningFilter,
  onReset,
}: {
  projectTypeFilter: string
  setProjectTypeFilter: (v: string) => void
  budgetFilter: string
  setBudgetFilter: (v: string) => void
  returningFilter: string
  setReturningFilter: (v: string) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={projectTypeFilter} onValueChange={setProjectTypeFilter}>
        <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
          <SelectValue placeholder="Project Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          <SelectItem value="Full Website Redesign">Website Redesign</SelectItem>
          <SelectItem value="Custom Web Application">Web Application</SelectItem>
          <SelectItem value="E-Commerce Store">E-Commerce</SelectItem>
          <SelectItem value="Mobile App + Landing Page">Mobile App</SelectItem>
          <SelectItem value="B2B Portal">B2B Portal</SelectItem>
        </SelectContent>
      </Select>

      <Select value={budgetFilter} onValueChange={setBudgetFilter}>
        <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
          <SelectValue placeholder="Budget Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Budgets</SelectItem>
          <SelectItem value="under10k">Under $10K</SelectItem>
          <SelectItem value="10k-25k">$10K - $25K</SelectItem>
          <SelectItem value="25k-50k">$25K - $50K</SelectItem>
          <SelectItem value="50k+">$50K+</SelectItem>
        </SelectContent>
      </Select>

      <Select value={returningFilter} onValueChange={setReturningFilter}>
        <SelectTrigger className="w-36 bg-secondary/50 border-border/50">
          <SelectValue placeholder="Lead Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Leads</SelectItem>
          <SelectItem value="new">New Only</SelectItem>
          <SelectItem value="returning">Returning Only</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground hover:text-foreground">
        <FiRefreshCw className="w-3.5 h-3.5 mr-1" />
        Reset
      </Button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Page() {
  // ── View State ──
  const [activeView, setActiveView] = useState<'voice' | 'admin'>('voice')
  const [showSampleData, setShowSampleData] = useState(false)

  // ── Voice State ──
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [showTranscript, setShowTranscript] = useState(false)
  const [notification, setNotification] = useState({ message: '', visible: false })
  const [showSilenceCue, setShowSilenceCue] = useState(false)
  const [bookingRedirect, setBookingRedirect] = useState<{ show: boolean; countdown: number }>({ show: false, countdown: 5 })
  const bookingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── WebSocket & Audio Refs ──
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const nextPlayTimeRef = useRef(0)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sampleRateRef = useRef(24000)

  // ── Admin State ──
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [projectTypeFilter, setProjectTypeFilter] = useState('all')
  const [budgetFilter, setBudgetFilter] = useState('all')
  const [returningFilter, setReturningFilter] = useState('all')

  // ── Load leads from localStorage on mount ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('elevra-leads')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setLeads(parsed)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // ── Save leads to localStorage ──
  useEffect(() => {
    if (leads.length > 0) {
      try {
        localStorage.setItem('elevra-leads', JSON.stringify(leads))
      } catch {
        // ignore
      }
    }
  }, [leads])

  // ── Sync isMuted ref ──
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  // ── Auto-start notification ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setNotification({ message: 'Elevra AI Consultant is ready to help', visible: true })
      setTimeout(() => {
        setNotification((prev) => ({ ...prev, visible: false }))
      }, 4000)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // ── Silence Timer ──
  const resetSilenceTimer = useCallback(() => {
    setShowSilenceCue(false)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      setShowSilenceCue(true)
    }, 8000)
  }, [])

  const clearSilenceTimer = useCallback(() => {
    setShowSilenceCue(false)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
  }, [])

  // ── Booking Redirect ──
  const triggerBookingRedirect = useCallback(() => {
    if (bookingRedirect.show) return // already triggered
    setBookingRedirect({ show: true, countdown: 5 })

    // Save lead data before redirect
    if (transcript.length > 2) {
      const newLead: Lead = {
        id: generateId(),
        fullName: 'Voice Visitor',
        email: '',
        phone: '',
        businessType: '',
        projectType: '',
        budgetRange: '',
        timeline: '',
        features: [],
        notes: 'Qualified lead - redirected to booking page.',
        timestamp: new Date().toISOString(),
        isReturning: false,
        sourceTag: 'Voice Session',
        conversationTranscript: transcript,
        status: 'qualified',
      }
      setLeads((prev) => [newLead, ...prev])
    }

    let count = 5
    bookingTimerRef.current = setInterval(() => {
      count -= 1
      setBookingRedirect((prev) => ({ ...prev, countdown: count }))
      if (count <= 0) {
        if (bookingTimerRef.current) clearInterval(bookingTimerRef.current)
        window.open(BOOKING_URL, '_blank')
        setBookingRedirect({ show: false, countdown: 5 })
        // Store returning user info
        try {
          localStorage.setItem('elevra-returning-user', JSON.stringify({ lastVisit: new Date().toISOString() }))
        } catch { /* ignore */ }
      }
    }, 1000)
  }, [bookingRedirect.show, transcript])

  const cancelBookingRedirect = useCallback(() => {
    if (bookingTimerRef.current) clearInterval(bookingTimerRef.current)
    setBookingRedirect({ show: false, countdown: 5 })
  }, [])

  // ── Audio Playback ──
  const initPlaybackAudio = useCallback((sampleRate: number) => {
    if (!audioContextRef.current) {
      const ctx = new AudioContext({ sampleRate })
      audioContextRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.value = 1
      gain.connect(ctx.destination)
      gainNodeRef.current = gain
      nextPlayTimeRef.current = ctx.currentTime
    }
  }, [])

  const playAudioChunk = useCallback((base64Audio: string) => {
    if (!audioContextRef.current || !gainNodeRef.current) return
    const ctx = audioContextRef.current
    try {
      const raw = atob(base64Audio)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768

      const buffer = ctx.createBuffer(1, float32.length, sampleRateRef.current)
      buffer.getChannelData(0).set(float32)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(gainNodeRef.current!)

      const now = ctx.currentTime
      const startTime = Math.max(nextPlayTimeRef.current, now)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + buffer.duration
    } catch {
      // ignore decode errors
    }
  }, [])

  const clearPlayback = useCallback(() => {
    nextPlayTimeRef.current = audioContextRef.current?.currentTime ?? 0
  }, [])

  // ── Microphone ──
  const startMicrophone = useCallback((sampleRate: number, sendAudio: (base64: string) => void) => {
    navigator.mediaDevices
      .getUserMedia({
        audio: { sampleRate, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      .then((stream) => {
        micStreamRef.current = stream
        const ctx = new AudioContext({ sampleRate })
        micContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return
          const float32 = e.inputBuffer.getChannelData(0)
          const pcm16 = new Int16Array(float32.length)
          for (let i = 0; i < float32.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, float32[i])) * 32767
          }
          const bytes = new Uint8Array(pcm16.buffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          sendAudio(btoa(binary))
        }

        source.connect(processor)
        const silentGain = ctx.createGain()
        silentGain.gain.value = 0
        silentGain.connect(ctx.destination)
        processor.connect(silentGain)
      })
      .catch(() => {
        setVoiceState('error')
      })
  }, [])

  const stopMicrophone = useCallback(() => {
    processorRef.current?.disconnect()
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micContextRef.current?.close()
    micStreamRef.current = null
    processorRef.current = null
    micContextRef.current = null
  }, [])

  // ── Start Voice Session ──
  const startSession = useCallback(async () => {
    setVoiceState('connecting')
    setTranscript([])
    clearSilenceTimer()

    try {
      const res = await fetch(VOICE_SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: AGENT_ID }),
      })

      if (!res.ok) throw new Error('Failed to start voice session')

      const data: VoiceSession = await res.json()
      const sampleRate = data?.audioConfig?.sampleRate ?? 24000
      sampleRateRef.current = sampleRate

      initPlaybackAudio(sampleRate)

      const ws = new WebSocket(data.wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setVoiceState('listening')
        resetSilenceTimer()

        startMicrophone(sampleRate, (base64: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'audio',
                audio: base64,
                sampleRate,
              })
            )
          }
        })
      }

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)

          switch (msg.type) {
            case 'audio':
              setVoiceState('speaking')
              clearSilenceTimer()
              playAudioChunk(msg.audio)
              break

            case 'transcript':
              resetSilenceTimer()
              if (msg.role === 'user') {
                setVoiceState('listening')
              }
              // Detect booking redirect intent from assistant
              if (msg.role === 'assistant' && msg.final !== false && containsRedirectIntent(msg.text)) {
                // Delay slightly so the user hears the full message
                setTimeout(() => {
                  triggerBookingRedirect()
                }, 2000)
              }
              setTranscript((prev) => {
                const now = new Date().toISOString()
                if (msg.final === false) {
                  const lastIndex = prev.findIndex(
                    (m) => m.role === msg.role && !m.isFinal
                  )
                  if (lastIndex >= 0) {
                    const updated = [...prev]
                    updated[lastIndex] = { role: msg.role, text: msg.text, timestamp: now, isFinal: false }
                    return updated
                  }
                  return [...prev, { role: msg.role, text: msg.text, timestamp: now, isFinal: false }]
                }
                // Final transcript - replace interim or add new
                const interimIndex = prev.findIndex(
                  (m) => m.role === msg.role && !m.isFinal
                )
                if (interimIndex >= 0) {
                  const updated = [...prev]
                  updated[interimIndex] = { role: msg.role, text: msg.text, timestamp: now, isFinal: true }
                  return updated
                }
                return [...prev, { role: msg.role, text: msg.text, timestamp: now, isFinal: true }]
              })
              break

            case 'thinking':
              setVoiceState('processing')
              clearSilenceTimer()
              break

            case 'clear':
              clearPlayback()
              setVoiceState('listening')
              resetSilenceTimer()
              break

            case 'error':
              setVoiceState('error')
              clearSilenceTimer()
              break
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setVoiceState('idle')
        stopMicrophone()
        clearSilenceTimer()
      }

      ws.onerror = () => {
        setVoiceState('error')
        stopMicrophone()
        clearSilenceTimer()
      }
    } catch {
      setVoiceState('error')
    }
  }, [initPlaybackAudio, playAudioChunk, clearPlayback, startMicrophone, stopMicrophone, resetSilenceTimer, clearSilenceTimer, triggerBookingRedirect])

  // ── End Voice Session ──
  const endSession = useCallback(() => {
    // Save transcript as a lead if we have messages
    if (transcript.length > 2) {
      const newLead: Lead = {
        id: generateId(),
        fullName: 'Voice Visitor',
        email: '',
        phone: '',
        businessType: '',
        projectType: '',
        budgetRange: '',
        timeline: '',
        features: [],
        notes: 'Automatically captured from voice consultation.',
        timestamp: new Date().toISOString(),
        isReturning: false,
        sourceTag: 'Voice Session',
        conversationTranscript: transcript,
        status: 'new',
      }
      setLeads((prev) => [newLead, ...prev])
    }

    wsRef.current?.close()
    wsRef.current = null
    stopMicrophone()
    audioContextRef.current?.close()
    audioContextRef.current = null
    gainNodeRef.current = null
    nextPlayTimeRef.current = 0
    setVoiceState('idle')
    clearSilenceTimer()
  }, [transcript, stopMicrophone, clearSilenceTimer])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      wsRef.current?.close()
      stopMicrophone()
      audioContextRef.current?.close()
      clearSilenceTimer()
      if (bookingTimerRef.current) clearInterval(bookingTimerRef.current)
    }
  }, [stopMicrophone, clearSilenceTimer])

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  // ── Filtered leads for admin ──
  const filteredLeads = useMemo(() => {
    const source = showSampleData ? SAMPLE_LEADS : leads
    return source.filter((lead) => {
      if (projectTypeFilter !== 'all' && lead.projectType !== projectTypeFilter) return false
      if (returningFilter === 'new' && lead.isReturning) return false
      if (returningFilter === 'returning' && !lead.isReturning) return false
      if (budgetFilter !== 'all') {
        const budget = extractBudget(lead.budgetRange)
        if (budgetFilter === 'under10k' && budget >= 10000) return false
        if (budgetFilter === '10k-25k' && (budget < 10000 || budget > 25000)) return false
        if (budgetFilter === '25k-50k' && (budget < 25000 || budget > 50000)) return false
        if (budgetFilter === '50k+' && budget < 50000) return false
      }
      return true
    })
  }, [leads, showSampleData, projectTypeFilter, budgetFilter, returningFilter])

  // ── Admin stats ──
  const stats = useMemo(() => {
    const source = showSampleData ? SAMPLE_LEADS : leads
    const total = source.length
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const thisWeek = source.filter((l) => new Date(l.timestamp).getTime() > weekAgo).length
    const budgets = source.map((l) => extractBudget(l.budgetRange)).filter((b) => b > 0)
    const avgBudget = budgets.length > 0 ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : 0
    const converted = source.filter((l) => l.status === 'converted').length
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0
    return { total, thisWeek, avgBudget, conversionRate }
  }, [leads, showSampleData])

  const resetFilters = useCallback(() => {
    setProjectTypeFilter('all')
    setBudgetFilter('all')
    setReturningFilter('all')
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
        {/* Booking Redirect Overlay */}
        <BookingRedirectOverlay
          show={bookingRedirect.show}
          countdown={bookingRedirect.countdown}
          onCancel={cancelBookingRedirect}
          onGoNow={() => {
            cancelBookingRedirect()
            window.open(BOOKING_URL, '_blank')
          }}
        />

        {/* Background gradient effect */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl" />
        </div>

        {/* Top bar */}
        <header className="relative z-20 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <FiPhone className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight" style={{ letterSpacing: '-0.01em' }}>Elevra AI</h1>
              <p className="text-xs text-muted-foreground">Voice Consultant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sample Data Toggle */}
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Sample Data
              </Label>
              <Switch
                id="sample-toggle"
                checked={showSampleData}
                onCheckedChange={setShowSampleData}
              />
            </div>

            {/* View Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setActiveView(activeView === 'voice' ? 'admin' : 'voice')}
              aria-label={activeView === 'voice' ? 'Open admin dashboard' : 'Back to voice assistant'}
            >
              {activeView === 'voice' ? (
                <FiSettings className="w-4.5 h-4.5 text-muted-foreground hover:text-foreground" />
              ) : (
                <FiMic className="w-4.5 h-4.5 text-muted-foreground hover:text-foreground" />
              )}
            </Button>
          </div>
        </header>

        {/* ───────── Voice Assistant View ───────── */}
        {activeView === 'voice' && (
          <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-4 py-8 gap-6">
            <InlineNotification
              message={notification.message}
              visible={notification.visible}
            />

            {/* Brand heading */}
            <div className="text-center mb-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ letterSpacing: '-0.01em' }}>
                Voice Consultant
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Have a natural conversation about your project needs. Our AI consultant will guide you through the process.
              </p>
            </div>

            {/* Voice Orb */}
            <VoiceOrb
              state={voiceState}
              isMuted={isMuted}
              onTap={startSession}
              onMuteToggle={toggleMute}
              onEnd={endSession}
            />

            {/* Status Badge */}
            <StatusBadge state={voiceState} />

            {/* Silence Cue */}
            <SilenceCue visible={showSilenceCue && voiceState === 'listening'} />

            {/* Transcript */}
            <TranscriptPanel
              messages={showSampleData ? SAMPLE_LEADS[0].conversationTranscript : transcript}
              isOpen={showTranscript}
              onToggle={() => setShowTranscript((p) => !p)}
            />

            {/* Agent Info */}
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72">
              <Card className="border-border/30 bg-card/60 backdrop-blur-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <FiMic className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${voiceState === 'idle' || voiceState === 'error' ? 'bg-muted-foreground' : 'bg-accent'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">Elevra AI Voice Consultant</p>
                    <p className="text-xs text-muted-foreground truncate">Lead qualification voice agent</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {voiceState === 'idle' ? 'Ready' : voiceState === 'error' ? 'Error' : 'Active'}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </main>
        )}

        {/* ───────── Admin Dashboard View ───────── */}
        {activeView === 'admin' && (
          <main className="relative z-10 min-h-[calc(100vh-57px)] px-4 md:px-6 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight" style={{ letterSpacing: '-0.01em' }}>Lead Dashboard</h2>
                <p className="text-sm text-muted-foreground">Track and manage consultation leads</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => downloadCSV(showSampleData ? SAMPLE_LEADS : leads)}
                disabled={showSampleData ? SAMPLE_LEADS.length === 0 : leads.length === 0}
              >
                <FiDownload className="w-3.5 h-3.5" />
                Export CSV
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total Leads"
                value={stats.total}
                icon={<FiUsers className="w-5 h-5" />}
                accentColor="hsl(220, 70%, 50%)"
              />
              <StatCard
                label="This Week"
                value={stats.thisWeek}
                icon={<FiTrendingUp className="w-5 h-5" />}
                accentColor="hsl(160, 60%, 45%)"
              />
              <StatCard
                label="Avg Budget"
                value={stats.avgBudget > 0 ? `$${stats.avgBudget.toLocaleString()}` : '$0'}
                icon={<FiDollarSign className="w-5 h-5" />}
                accentColor="hsl(30, 80%, 55%)"
              />
              <StatCard
                label="Conversion"
                value={`${stats.conversionRate}%`}
                icon={<FiTarget className="w-5 h-5" />}
                accentColor="hsl(280, 60%, 55%)"
              />
            </div>

            {/* Filters */}
            <FilterBar
              projectTypeFilter={projectTypeFilter}
              setProjectTypeFilter={setProjectTypeFilter}
              budgetFilter={budgetFilter}
              setBudgetFilter={setBudgetFilter}
              returningFilter={returningFilter}
              setReturningFilter={setReturningFilter}
              onReset={resetFilters}
            />

            {/* Leads Table */}
            <LeadsTable
              leads={filteredLeads}
              onSelectLead={(lead) => {
                setSelectedLead(lead)
                setSheetOpen(true)
              }}
            />

            {/* Lead Detail Sheet */}
            <LeadDetailSheet
              lead={selectedLead}
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
            />

            {/* Agent Info Panel */}
            <Card className="border-border/30 bg-card/60 backdrop-blur-sm mt-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
                    <FiMic className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Elevra AI Voice Consultant</p>
                    <p className="text-xs text-muted-foreground">Conducts structured voice-based lead qualification conversations</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Voice Agent
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </main>
        )}
      </div>
    </ErrorBoundary>
  )
}
