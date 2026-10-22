import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { LandingPage, SignUpPage, ConnectPage, SyncPage, MriPage } from './pages/onboarding'
import { HomePage, ExecutiveSummaryPage, OpportunityMapPage, RootCausePage, RecommendationPage, DeployPage, BriefPage, AgentsPage, AgentWorkspacePage, InsightsPage, TeamPage, SettingsPage, NotificationsPage, DataExplorerPage } from './pages/product'
import { PilotAgentsPage, PilotAgentWorkspacePage, PilotBriefPage, PilotExecutivePage, PilotInsightsPage, PilotRecommendationPage, PilotRootCausePage } from './pages/pilot'

const pilotMode = import.meta.env.VITE_GILAR_MODE === 'pilot'
const dataExplorerEnabled = import.meta.env.VITE_GILAR_ENABLE_DATA_EXPLORER !== 'false'

function Protected({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/onboarding/connect" element={<ConnectPage />} />
      <Route path="/onboarding/sync" element={<SyncPage />} />
      <Route path="/onboarding/mri" element={<MriPage />} />
      <Route path="/app/home" element={<Protected><HomePage /></Protected>} />
      <Route path="/app/executive" element={<Protected><PilotExecutivePage /></Protected>} />
      <Route path="/app/opportunities" element={<Protected><OpportunityMapPage /></Protected>} />
      <Route path="/app/opportunities/root-cause" element={<Protected><PilotRootCausePage /></Protected>} />
      <Route path="/app/opportunities/recommendation" element={<Protected><PilotRecommendationPage /></Protected>} />
      <Route path="/app/opportunities/deploy" element={<Protected><DeployPage /></Protected>} />
      <Route path="/app/brief" element={<Protected><PilotBriefPage /></Protected>} />
      <Route path="/app/agents" element={<Protected><PilotAgentsPage /></Protected>} />
      <Route path="/app/agents/proposal" element={<Protected><PilotAgentWorkspacePage /></Protected>} />
      <Route path="/app/insights" element={<Protected><PilotInsightsPage /></Protected>} />
      <Route path="/app/team" element={<Protected><TeamPage /></Protected>} />
      <Route path="/app/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/app/notifications" element={<Protected><NotificationsPage /></Protected>} />
      <Route path="/app/data-explorer" element={!dataExplorerEnabled ? <Navigate to="/app/home" replace /> : <Protected><DataExplorerPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
