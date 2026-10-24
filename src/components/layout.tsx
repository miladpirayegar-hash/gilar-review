import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Bell, Bot, ChevronDown, CircleHelp, Command, FileText, Gauge, Home, LayoutGrid, LineChart, Menu, PanelLeftClose, PanelLeftOpen, PlugZap, Search, Settings, Target, Users, Wrench } from 'lucide-react'
import { workspaceService } from '../services/demoService'
import { syntheticApi, type SyntheticSimulationSnapshot } from '../services/syntheticService'

export function Logo({ dark = false }: { dark?: boolean }) {
  return <div className={`logo ${dark ? 'logo-dark' : ''}`}><span className="logo-mark"><span /></span><span>gilar</span></div>
}

export function Button({ children, variant = 'primary', onClick, className = '', type = 'button', disabled = false }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger'; onClick?: () => void; className?: string; type?: 'button' | 'submit'; disabled?: boolean }) {
  return <button type={type} className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function IconButton({ label, children, onClick, className = '' }: { label: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return <button aria-label={label} title={label} className={`icon-button ${className}`} onClick={onClick}>{children}</button>
}

const primaryNav = [
  { label: 'Today', to: '/app/home', icon: Home },
  { label: 'Fixes', to: '/app/opportunities', icon: Wrench },
  { label: 'Results', to: '/app/insights', icon: LineChart },
]
const pilotMode = import.meta.env.VITE_GILAR_MODE === 'pilot'
const secondaryGroups = [
  { label: 'Intelligence', items: [
    { label: 'Business Health', to: '/app/executive', icon: Gauge },
    { label: 'Opportunity Map', to: '/app/opportunities/map', icon: Target },
    { label: 'Reports', to: '/app/reports', icon: FileText },
  ] },
  { label: 'Execution', items: [
    { label: 'Automations', to: '/app/agents', icon: Bot },
  ] },
  { label: 'Workspace', items: [
    { label: 'Connections', to: '/app/connections', icon: PlugZap },
    { label: 'Team', to: '/app/team', icon: Users },
    { label: 'Settings', to: '/app/settings', icon: Settings },
  ] },
]

const commandNav = [
  { label: 'Business', accessibleLabel: 'Today', to: '/app/home' },
  { label: 'Brief', accessibleLabel: 'Brief', to: '/app/brief' },
  { label: 'Actions', accessibleLabel: 'Fixes', to: '/app/opportunities' },
  { label: 'Results', accessibleLabel: 'Results', to: '/app/insights' },
]

const commandSecondaryNav = [
  { label: 'Business Health', to: '/app/executive' },
  { label: 'Automations', to: '/app/agents' },
  { label: 'Reports', to: '/app/reports' },
  { label: 'Connections', to: '/app/connections' },
  { label: 'Team', to: '/app/team' },
  { label: 'Settings', to: '/app/settings' },
]

export function SyntheticDemoBanner() {
  const [simulation, setSimulation] = useState<SyntheticSimulationSnapshot>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const refresh = () => { void syntheticApi.overview().then((overview) => setSimulation(overview.simulation)).catch(() => undefined) }
    refresh()
    window.addEventListener('gilar:synthetic-updated', refresh)
    return () => window.removeEventListener('gilar:synthetic-updated', refresh)
  }, [])
  if (!simulation || pilotMode) return null
  const act = async (operation: () => Promise<unknown>) => { setBusy(true); try { await operation(); window.location.reload() } finally { setBusy(false) } }
  return <div className="synthetic-demo-banner header-synthetic-banner"><span className="synthetic-demo-label">SYNTHETIC</span><span className="synthetic-demo-state">{simulation.status === 'baseline' ? 'Review mode' : `Simulation: ${simulation.status}`}</span><button onClick={() => void act(() => syntheticApi.advance(30))} disabled={busy || simulation.status === 'baseline' || simulation.status === 'completed'}>Advance 30 days</button><button onClick={() => void act(() => syntheticApi.reset())} disabled={busy}>Reset</button></div>
}

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const location = useLocation()
  const workspace = workspaceService.getCurrent()
  const workspaceName = ['synthetic', 'pilot', 'review'].includes(import.meta.env.VITE_GILAR_MODE) ? 'Northstar Distribution Co.' : workspace.name
  const isActive = (to: string, label: string) => location.pathname === to || (label === 'Fixes' && location.pathname.startsWith('/app/opportunities') && location.pathname !== '/app/opportunities/map') || (label === 'Results' && location.pathname.startsWith('/app/insights')) || (label === 'Business Health' && location.pathname.startsWith('/app/executive')) || (label === 'Opportunity Map' && location.pathname.startsWith('/app/opportunities/map')) || (label === 'Automations' && location.pathname.startsWith('/app/agents')) || (label === 'Reports' && location.pathname.startsWith('/app/reports')) || (label === 'Connections' && location.pathname.startsWith('/app/connections')) || (label === 'Team' && location.pathname.startsWith('/app/team')) || (label === 'Settings' && location.pathname === '/app/settings')
  const renderNav = (items: typeof primaryNav) => items.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end onClick={onNavigate} className={({ isActive: routeActive }) => `nav-item ${isActive(to, label) || routeActive ? 'active' : ''}`}><Icon size={19} /><span>{label}</span>{label === 'Fixes' && <span className="nav-count">5</span>}</NavLink>)
  return <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <div className="sidebar-top"><Logo dark /> <IconButton label="Collapse navigation" onClick={onToggle} className="sidebar-toggle">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</IconButton></div>
    <button className="workspace-switch"><span className="workspace-avatar">N</span><span className="workspace-copy"><strong>{workspaceName}</strong><small>Business workspace</small></span><ChevronDown size={15} /></button>
    <div className="nav-label">Your business</div>
    <nav className="main-nav">{renderNav(primaryNav)}</nav>
    {secondaryGroups.map((group) => <div className="sidebar-nav-group" key={group.label}><div className="nav-label">{group.label}</div><nav className="main-nav">{renderNav(group.items)}</nav></div>)}
    <div className="nav-spacer" />
    <div className="sidebar-bottom"><button className="help-card"><CircleHelp size={17} /><span><strong>Need help?</strong><small>Open the help center</small></span></button><button className="user-switch"><span className="avatar">{workspace.initials}</span><span className="workspace-copy"><strong>{workspace.owner} Pira</strong><small>Owner</small></span><ChevronDown size={15} /></button></div>
  </aside>
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate()
  return <header className="topbar"><div className="desktop-brand"><Logo /></div><div className="mobile-header"><IconButton label="Open navigation" onClick={onMenu}><Menu size={20} /></IconButton><Logo /></div><button className="topbar-workspace"><span>Northstar Distribution</span><ChevronDown size={13} /></button><label className="topbar-search"><Search size={15} /><input aria-label="Ask Gilar anything" placeholder="Ask Gilar anything..." /><span><Command size={13} /></span></label><div className="topbar-actions"><button className="sync-status"><span className="live-dot" /> Synthetic data synced</button><IconButton label="Open notifications" onClick={() => navigate('/app/notifications')}><Bell size={18} /><span className="notification-dot" /><span className="notification-count">1</span></IconButton><button className="top-avatar" onClick={() => navigate('/app/settings')}>MP</button></div></header>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const currentPath = location.pathname
  const isCommandActive = (to: string) => to === '/app/home' ? currentPath === to : currentPath === to || currentPath.startsWith(`${to}/`)
  return <div className="app-shell command-shell"><div className={`mobile-overlay ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} /><Header onMenu={() => setMobileOpen(true)} /><div className={`command-nav ${mobileOpen ? 'command-nav-open' : ''}`}><div className="command-nav-inner"><nav aria-label="Gilar command navigation" className="command-core-nav">{commandNav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/app/home'} onClick={() => setMobileOpen(false)} aria-label={item.accessibleLabel} className={isCommandActive(item.to) ? 'command-link active' : 'command-link'}>{item.label}{item.label === 'Actions' && <span className="command-count">5</span>}</NavLink>)}</nav><nav aria-label="Gilar workspace navigation" className="command-secondary-nav">{commandSecondaryNav.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={isCommandActive(item.to) ? 'command-secondary-link active' : 'command-secondary-link'}>{item.label}</NavLink>)}</nav></div></div><div className="main-shell"><main className="main-content">{children}</main></div></div>
}

export function PageHeader({ eyebrow, title, description, actions, children }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}{children}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  const accessibleAction = isValidElement(action) ? (() => { const props = action.props as { className?: string; 'aria-label'?: string; title?: string }; const elementType = typeof action.type === 'string' ? action.type : ''; const needsLabel = props.className?.includes('icon-link') || elementType === 'select'; const element = action as React.ReactElement<{ 'aria-label'?: string; title?: string }>; return needsLabel ? cloneElement(element, { 'aria-label': props['aria-label'] ?? `${title} options`, title: props.title ?? `${title} options` }) : action })() : action
  return <div className="section-title"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{accessibleAction}</div>
}

export function MetricCard({ label, value, change, trend, detail, icon: Icon }: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'flat'; detail?: string; icon?: React.ElementType }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span>{Icon && <span className="metric-icon"><Icon size={15} /></span>}</div><div className="metric-value">{value}</div>{change && <div className={`metric-change ${trend || 'flat'}`}><span>{trend === 'up' ? '↗' : trend === 'down' ? '↘' : '•'}</span>{change}<small>{detail}</small></div>}</div>
}

export function StatusPill({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }) { return <span className={`status-pill ${tone}`}><span className="pill-dot" />{children}</span> }

export function ProgressBar({ value, color = 'blue' }: { value: number; color?: string }) { return <div className="progress-track"><span className={`progress-fill ${color}`} style={{ width: `${value}%` }} /></div> }

export function EmptyState({ icon: Icon = LayoutGrid, title, description, action }: { icon?: React.ElementType; title: string; description: string; action?: React.ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Icon size={23} /></span><h3>{title}</h3><p>{description}</p>{action}</div> }
