import { Component, type ErrorInfo, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout";
import { SignUpPage, ConnectPage, SyncPage } from "./pages/onboarding";
import {
  OpportunityMapPage,
  DeployPage,
  TeamPage,
  SettingsPage,
  NotificationsPage,
  DataExplorerPage,
} from "./pages/product";
import {
  PilotAgentsPage,
  PilotAgentWorkspacePage,
  PilotExecutivePage,
  PilotInsightsPage,
  PilotRecommendationPage,
  PilotRootCausePage,
} from "./pages/pilot";
import { ReportsPage } from "./pages/reports";
import {
  BusinessCanvasPage,
  BusinessModelBuildPage,
  ImpactLedgerPage,
  MissionActionsPage,
  MissionBriefPage,
  MissionLandingPage,
} from "./pages/mission";

const mode = import.meta.env.VITE_GILAR_MODE ?? "demo";
const dataExplorerEnabled =
  import.meta.env.VITE_GILAR_ENABLE_DATA_EXPLORER !== "false" &&
  ["demo", "synthetic"].includes(mode);

function Protected({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Gilar route failed to render", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="route-error-state">
        <div>
          <span className="eyebrow">Gilar workspace</span>
          <h1>We couldn’t load this view.</h1>
          <p>
            Your local synthetic data is safe. Return to Today to continue
            reviewing the workspace.
          </p>
          <a className="button button-primary" href="#/app/home">
            Return to Today
          </a>
        </div>
      </main>
    );
  }
}

export default function App() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<MissionLandingPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/onboarding/connect" element={<ConnectPage />} />
        <Route path="/onboarding/sync" element={<SyncPage />} />
        <Route path="/onboarding/mri" element={<BusinessModelBuildPage />} />
        <Route
          path="/app/home"
          element={
            <Protected>
              <BusinessCanvasPage />
            </Protected>
          }
        />
        <Route
          path="/app/executive"
          element={
            <Protected>
              <PilotExecutivePage />
            </Protected>
          }
        />
        <Route
          path="/app/opportunities"
          element={
            <Protected>
              <MissionActionsPage />
            </Protected>
          }
        />
        <Route
          path="/app/opportunities/map"
          element={
            <Protected>
              <OpportunityMapPage />
            </Protected>
          }
        />
        <Route
          path="/app/opportunities/root-cause"
          element={
            <Protected>
              <PilotRootCausePage />
            </Protected>
          }
        />
        <Route
          path="/app/opportunities/recommendation"
          element={
            <Protected>
              <PilotRecommendationPage />
            </Protected>
          }
        />
        <Route
          path="/app/opportunities/deploy"
          element={
            <Protected>
              <DeployPage />
            </Protected>
          }
        />
        <Route
          path="/app/brief"
          element={
            <Protected>
              <MissionBriefPage />
            </Protected>
          }
        />
        <Route
          path="/app/agents"
          element={
            <Protected>
              <PilotAgentsPage />
            </Protected>
          }
        />
        <Route
          path="/app/agents/proposal"
          element={
            <Protected>
              <PilotAgentWorkspacePage />
            </Protected>
          }
        />
        <Route
          path="/app/insights"
          element={
            <Protected>
              <ImpactLedgerPage />
            </Protected>
          }
        />
        <Route
          path="/app/insights/detail"
          element={
            <Protected>
              <PilotInsightsPage />
            </Protected>
          }
        />
        <Route
          path="/app/team"
          element={
            <Protected>
              <TeamPage />
            </Protected>
          }
        />
        <Route
          path="/app/reports"
          element={
            <Protected>
              <ReportsPage />
            </Protected>
          }
        />
        <Route
          path="/app/connections"
          element={
            <Protected>
              <SettingsPage />
            </Protected>
          }
        />
        <Route
          path="/app/settings"
          element={
            <Protected>
              <SettingsPage />
            </Protected>
          }
        />
        <Route
          path="/app/notifications"
          element={
            <Protected>
              <NotificationsPage />
            </Protected>
          }
        />
        <Route
          path="/app/data-explorer"
          element={
            !dataExplorerEnabled ? (
              <Navigate to="/app/home" replace />
            ) : (
              <Protected>
                <DataExplorerPage />
              </Protected>
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
