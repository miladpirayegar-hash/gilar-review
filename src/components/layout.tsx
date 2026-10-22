import { cloneElement, isValidElement, useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Bell, BookOpen, Bot, BriefcaseBusiness, ChevronDown, CircleHelp, Command, Database, FileText, Home, LayoutGrid, Menu, PanelLeftClose, PanelLeftOpen, Settings, Sparkles, Users, X, Zap } from 'lucide-react'
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
  { label: 'Home', to: '/app/home', icon: Home },
  { label: 'Opportunities', to: '/app/opportunities', icon: Zap },
  { label: 'Agents', to: '/app/agents', icon: Bot },
  { label: 'Insights', to: '/app/insights', icon: BarChart3 },
  { label: 'Documents', to: '/app/brief', icon: FileText },
  { label: 'Team', to: '/app/team', icon: Users },
]
const pilotMode = import.meta.env.VITE_GILAR_MODE === 'pilot'
const dataExplorerEnabled = import.meta.env.VITE_GILAR_ENABLE_DATA_EXPLORER !== 'false'
const secondaryNav = [{ label: 'Data Explorer', to: '/app/data-explorer', icon: Database }, { label: 'Settings', to: '/app/settings', icon: Settings }].filter((item) => (dataExplorerEnabled || item.label !== 'Data Explorer') && (!pilotMode || item.label !== 'Data Explorer'))

function SyntheticDemoBanner() {
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
  return <div className="synthetic-demo-banner"><span className="synthetic-demo-label">SYNTHETIC / DEMO</span><span><strong>Northstar Distribution Co.</strong> · deterministic 12-month workspace</span><span className="synthetic-demo-state">Simulation: {simulation.status}{simulation.status !== 'baseline' && ` · ${simulation.elapsedDays}/${simulation.targetDays} days`}</span><button onClick={() => void act(() => syntheticApi.advance(30))} disabled={busy || simulation.status === 'baseline' || simulation.status === 'completed'}>Advance 30 days</button><button onClick={() => void act(() => syntheticApi.reset())} disabled={busy}>Reset demo company</button></div>
}

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const location = useLocation()
  const workspace = workspaceService.getCurrent()
  return <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <div className="sidebar-top"><Logo dark /> <IconButton label="Collapse navigation" onClick={onToggle} className="sidebar-toggle">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</IconButton></div>
    <button className="workspace-switch"><span className="workspace-avatar">N</span><span className="workspace-copy"><strong>{workspace.name}</strong><small>Workspace</small></span><ChevronDown size={15} /></button>
    <div className="nav-label">Command center</div>
    <nav className="main-nav">{primaryNav.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive || (label === 'Opportunities' && location.pathname.includes('opportunities')) ? 'active' : ''}`}><Icon size={17} /><span>{label}</span>{label === 'Opportunities' && <span className="nav-count">5</span>}</NavLink>)}</nav>
    <div className="nav-spacer" />
    <div className="nav-label">Workspace</div>
    <nav className="main-nav">{secondaryNav.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} className="nav-item"><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><button className="help-card"><CircleHelp size={17} /><span><strong>Need a hand?</strong><small>Visit the help center</small></span></button><button className="user-switch"><span className="avatar">{workspace.initials}</span><span className="workspace-copy"><strong>{workspace.owner} Pira</strong><small>Owner</small></span><ChevronDown size={15} /></button></div>
  </aside>
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate()
  return <header className="topbar"><div className="mobile-header"><IconButton label="Open navigation" onClick={onMenu}><Menu size={20} /></IconButton><Logo /></div><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Northstar Studio</strong></div><div className="topbar-actions"><button className="sync-status"><span className="live-dot" /> All systems synced</button><IconButton label="Open notifications" onClick={() => navigate('/app/notifications')}><Bell size={18} /><span className="notification-dot" /></IconButton><button className="top-avatar" onClick={() => navigate('/app/settings')}>MP</button></div></header>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className="app-shell"><div className={`mobile-overlay ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} /><div className={mobileOpen ? 'sidebar-mobile-open' : ''}><Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onNavigate={() => setMobileOpen(false)} /></div><div className={`main-shell ${collapsed ? 'main-shell-expanded' : ''}`}><Header onMenu={() => setMobileOpen(true)} /><main className="main-content"><SyntheticDemoBanner />{children}</main></div></div>
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
