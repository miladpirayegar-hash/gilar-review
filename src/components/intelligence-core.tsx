import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Gauge, ShieldAlert, Users, Workflow } from 'lucide-react'

type CoreVariant = 'landing' | 'today' | 'health'

type CoreNode = {
  key: string
  label: string
  value: string
  state: 'up' | 'down' | 'stable' | 'watch'
  icon: React.ElementType
}

const nodes: Record<CoreVariant, CoreNode[]> = {
  landing: [
    { key: 'sales', label: 'Sales', value: '31 → 23%', state: 'down', icon: Workflow },
    { key: 'cash', label: 'Cash', value: '$48K risk', state: 'watch', icon: CircleDollarSign },
    { key: 'operations', label: 'Operations', value: '+42% work', state: 'down', icon: Gauge },
    { key: 'customers', label: 'Customers', value: 'Stable', state: 'stable', icon: Users },
  ],
  today: [
    { key: 'sales', label: 'Sales', value: '23%', state: 'down', icon: Workflow },
    { key: 'cash', label: 'Cash', value: '$386K', state: 'stable', icon: CircleDollarSign },
    { key: 'operations', label: 'Operations', value: '12 days', state: 'watch', icon: Gauge },
    { key: 'risk', label: 'Risk', value: '3 signals', state: 'watch', icon: ShieldAlert },
  ],
  health: [
    { key: 'sales', label: 'Sales', value: '61', state: 'down', icon: Workflow },
    { key: 'cash', label: 'Cash', value: '78', state: 'stable', icon: CircleDollarSign },
    { key: 'operations', label: 'Operations', value: '64', state: 'watch', icon: Gauge },
    { key: 'customers', label: 'Customers', value: '72', state: 'up', icon: Users },
    { key: 'team', label: 'Team', value: '81', state: 'up', icon: Users },
    { key: 'risk', label: 'Risk', value: '69', state: 'watch', icon: ShieldAlert },
  ],
}

const statusIcon = { up: ArrowUpRight, down: ArrowDownRight, stable: () => <span>•</span>, watch: ShieldAlert }

export function IntelligenceCore({ variant = 'today', score = 74, compact = false }: { variant?: CoreVariant; score?: number; compact?: boolean }) {
  const coreNodes = nodes[variant]
  return <div className={`intelligence-core core-${variant} ${compact ? 'core-compact' : ''}`} aria-label="Gilar Intelligence Core business signal map">
    <div className="core-network">
      <svg className="core-connections" viewBox="0 0 600 360" aria-hidden="true"><path d="M120 85 L300 180 L480 85 M95 280 L300 180 L505 280 M300 45 L300 180 M300 180 L300 315" /><circle cx="300" cy="180" r="8" /></svg>
      <div className="core-center"><span className="core-center-kicker">GILAR</span><strong>{variant === 'health' ? score : 'LIVE'}</strong><small>{variant === 'health' ? 'BUSINESS HEALTH' : 'BUSINESS CORE'}</small><i /></div>
      {coreNodes.map((node, index) => { const Icon = node.icon; const StateIcon = statusIcon[node.state]; return <div className={`core-node core-node-${index + 1} ${node.state}`} key={node.key}><span className="core-node-icon"><Icon size={16} /></span><span className="core-node-copy"><small>{node.label}</small><strong>{node.value}</strong></span><StateIcon size={14} /></div> })}
    </div>
    <div className="core-legend"><span><i className="up" /> improving</span><span><i className="stable" /> stable</span><span><i className="watch" /> needs attention</span></div>
  </div>
}
