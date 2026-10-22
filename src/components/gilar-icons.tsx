import type { ReactNode, SVGProps } from 'react'

export type GilarIconKind = 'mri' | 'root-cause' | 'opportunity' | 'recommendation' | 'agent' | 'health' | 'evidence' | 'roi' | 'automation' | 'risk'

type GilarIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { kind: GilarIconKind; size?: number }

const iconBody: Record<GilarIconKind, ReactNode> = {
  mri: <><circle cx="12" cy="12" r="7.2" /><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2" /><path d="m7 7 1.6 1.6M15.4 15.4 17 17M17 7l-1.6 1.6M8.6 15.4 7 17" /></>,
  'root-cause': <><circle cx="5" cy="6" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="18" r="2" /><path d="M6.7 7.4 10.3 10.6M13.7 13.4l3.6 3.2" /></>,
  opportunity: <><path d="M4 17.5V20h16v-2.5" /><path d="m5.5 15 4-4 3 2.5 5-6" /><path d="M14.7 7.5H17.5V10.3" /></>,
  recommendation: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /><path d="M16.7 3.2v3.2M15.1 4.8h3.2" /></>,
  agent: <><rect x="5" y="7" width="14" height="11" rx="3" /><path d="M9 7V5.5a3 3 0 0 1 6 0V7M8.5 18v2M15.5 18v2M9 12h.01M15 12h.01M9.5 15h5" /></>,
  health: <><path d="M12 20.5s-7-4.4-7-10.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 5.8-7 10.2-7 10.2Z" /><path d="M8.5 12h2l1.1-2.4 1.8 5 1.1-2.6h1.9" /></>,
  evidence: <><path d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5V7h3M9 11h6M9 14h6M9 17h3" /></>,
  roi: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.7v8.6M14.7 9.5c-.6-.8-1.5-1.2-2.7-1.2-1.5 0-2.5.7-2.5 1.8 0 2.8 5.2 1.1 5.2 3.7 0 1.1-1 1.9-2.7 1.9-1.3 0-2.3-.4-2.9-1.3" /></>,
  automation: <><path d="M5 8.5h14M7.5 5v3.5M16.5 5v3.5M6 8.5h12a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01" /></>,
  risk: <><path d="m12 3 8 15H4L12 3Z" /><path d="M12 8.5v4M12 15.5v.01" /></>,
}

export function GilarIcon({ kind, size = 22, ...props }: GilarIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconBody[kind]}</svg>
}

export const MriIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="mri" {...props} />
export const RootCauseIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="root-cause" {...props} />
export const OpportunityIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="opportunity" {...props} />
export const RecommendationIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="recommendation" {...props} />
export const AgentIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="agent" {...props} />
export const HealthIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="health" {...props} />
export const EvidenceIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="evidence" {...props} />
export const RoiIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="roi" {...props} />
export const AutomationIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="automation" {...props} />
export const RiskIcon = (props: Omit<GilarIconProps, 'kind'>) => <GilarIcon kind="risk" {...props} />
