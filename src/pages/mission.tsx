import { useEffect, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleAlert,
  Crosshair,
  Database,
  GitBranch,
  Link2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, StatusPill } from "../components/layout";
import {
  syntheticApi,
  type SyntheticOverview,
} from "../services/syntheticService";
import { formatMetric, metricByKey } from "../services/metricPresentation";

function useMissionOverview() {
  const [overview, setOverview] = useState<SyntheticOverview>();
  useEffect(() => {
    const refresh = () => {
      void syntheticApi
        .overview()
        .then(setOverview)
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("gilar:synthetic-updated", refresh);
    return () => window.removeEventListener("gilar:synthetic-updated", refresh);
  }, []);
  return overview;
}

type CanvasNodeDefinition = {
  id: string;
  label: string;
  metricKey?: string;
  dashboardKey?: string;
  description: string;
  source: string;
  position: [number, number];
  tone: "risk" | "watch" | "opportunity" | "healthy";
};

const nodeDefinitions: CanvasNodeDefinition[] = [
  {
    id: "marketing",
    label: "Marketing",
    metricKey: "inactive_high_value_accounts",
    description: "High-value accounts gone quiet",
    source: "HubSpot",
    position: [10, 17],
    tone: "watch",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    dashboardKey: "pipeline",
    description: "Open opportunity value",
    source: "CRM + commerce",
    position: [31, 17],
    tone: "opportunity",
  },
  {
    id: "sales",
    label: "Sales",
    metricKey: "sales_conversion_rate",
    description: "Proposal conversion rate",
    source: "HubSpot",
    position: [53, 17],
    tone: "risk",
  },
  {
    id: "revenue",
    label: "Revenue",
    dashboardKey: "revenue",
    description: "Trailing three-month revenue",
    source: "Shopify",
    position: [76, 17],
    tone: "risk",
  },
  {
    id: "customers",
    label: "Customers",
    metricKey: "inactive_high_value_accounts",
    description: "High-value accounts at risk",
    source: "HubSpot",
    position: [58, 45],
    tone: "watch",
  },
  {
    id: "cash",
    label: "Cash",
    dashboardKey: "cash_position",
    description: "Current cash position",
    source: "QuickBooks",
    position: [88, 50],
    tone: "watch",
  },
  {
    id: "receivables",
    label: "Receivables",
    metricKey: "overdue_receivables",
    description: "Overdue balance",
    source: "QuickBooks",
    position: [71, 72],
    tone: "risk",
  },
  {
    id: "operations",
    label: "Operations",
    metricKey: "inventory_days_remaining",
    description: "Projected stock cover",
    source: "Shopify",
    position: [38, 70],
    tone: "watch",
  },
  {
    id: "team",
    label: "Team",
    metricKey: "administrative_workload",
    description: "Administrative workload",
    source: "CSV / Excel",
    position: [13, 70],
    tone: "watch",
  },
];

const canvasEdges = [
  { from: "marketing", to: "pipeline", label: "structural" },
  { from: "pipeline", to: "sales", label: "structural" },
  { from: "sales", to: "revenue", label: "observed association" },
  { from: "revenue", to: "cash", label: "structural" },
  { from: "receivables", to: "cash", label: "observed association" },
  { from: "team", to: "operations", label: "structural" },
  { from: "operations", to: "customers", label: "structural" },
  { from: "customers", to: "pipeline", label: "observed association" },
];

function dashboardMetric(
  overview: SyntheticOverview | undefined,
  key: string | undefined,
) {
  return overview?.dashboard.metrics.find((metric) => metric.key === key);
}

function nodeReadout(
  overview: SyntheticOverview | undefined,
  node: CanvasNodeDefinition,
) {
  const registryMetric = node.metricKey
    ? metricByKey(overview?.metricRegistry, node.metricKey)
    : undefined;
  const dashboard = dashboardMetric(overview, node.dashboardKey);
  if (registryMetric) {
    return {
      value: formatMetric(registryMetric),
      change:
        registryMetric.percentageChange === undefined
          ? "—"
          : `${registryMetric.direction === "down" ? "↓" : "↑"} ${Math.abs(registryMetric.percentageChange).toFixed(1)}%`,
      direction: registryMetric.direction,
    };
  }
  return {
    value: dashboard?.value ?? "—",
    change: dashboard?.change ?? "—",
    direction: dashboard?.trend ?? "flat",
  };
}

function statusLabel(node: CanvasNodeDefinition) {
  return node.tone === "risk"
    ? "Risk"
    : node.tone === "opportunity"
      ? "Opportunity"
      : node.tone === "watch"
        ? "Watch"
        : "Healthy";
}

function nodeIcon(node: CanvasNodeDefinition) {
  if (node.id === "cash" || node.id === "revenue") return <Wallet size={14} />;
  if (node.id === "operations" || node.id === "team")
    return <Workflow size={14} />;
  if (node.id === "pipeline" || node.id === "sales")
    return <TrendingDown size={14} />;
  return <Crosshair size={14} />;
}

function CanvasNode({
  node,
  overview,
  selected,
  onSelect,
}: {
  node: CanvasNodeDefinition;
  overview?: SyntheticOverview;
  selected: boolean;
  onSelect: () => void;
}) {
  const readout = nodeReadout(overview, node);
  return (
    <button
      className={`business-node node-${node.tone} ${selected ? "selected" : ""}`}
      style={
        {
          "--node-x": `${node.position[0]}%`,
          "--node-y": `${node.position[1]}%`,
        } as CSSProperties
      }
      onClick={onSelect}
      aria-label={`${node.label}, ${readout.value}, ${statusLabel(node)}`}
    >
      <span className="business-node-top">
        <span>
          {nodeIcon(node)} {node.label}
        </span>
        <i className={`node-status status-${node.tone}`} />
      </span>
      <strong>{readout.value}</strong>
      <span className="business-node-change">{readout.change}</span>
      <span className="node-trend">
        <i
          style={{
            transform: `scaleX(${readout.direction === "down" ? ".72" : "1.1"})`,
          }}
        />
        <i />
        <i
          style={{
            transform: `scaleX(${readout.direction === "down" ? ".54" : "1.25"})`,
          }}
        />
      </span>
      <small>{statusLabel(node)}</small>
    </button>
  );
}

function CanvasInspector({
  node,
  overview,
  onClose,
}: {
  node: CanvasNodeDefinition;
  overview?: SyntheticOverview;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const sales = metricByKey(overview?.metricRegistry, "sales_conversion_rate");
  const response = metricByKey(overview?.metricRegistry, "lead_response_time");
  const opportunity = overview?.opportunities[0];
  const isPipeline = node.id === "pipeline" || node.id === "sales";
  const relatedIssue = overview?.issues.find((issue) =>
    node.id === "receivables"
      ? issue.category === "Financial Health"
      : issue.category === "Sales & Customers",
  );
  return (
    <aside className="canvas-inspector">
      <div className="inspector-heading">
        <div>
          <span className="canvas-kicker">Focused system</span>
          <h2>{node.label}</h2>
        </div>
        <button
          className="inspector-close"
          onClick={onClose}
          aria-label="Return to business canvas"
        >
          ×
        </button>
      </div>
      <div className="inspector-readout">
        <strong>{nodeReadout(overview, node).value}</strong>
        <span>{node.description}</span>
        <StatusPill
          tone={
            node.tone === "risk"
              ? "red"
              : node.tone === "opportunity"
                ? "blue"
                : "yellow"
          }
        >
          {statusLabel(node)}
        </StatusPill>
      </div>
      {isPipeline ? (
        <>
          <div className="cause-sequence">
            <div>
              <span>Observed</span>
              <strong>{formatMetric(response)}</strong>
              <small>lead response time</small>
            </div>
            <ArrowDown size={16} />
            <div>
              <span>Observed</span>
              <strong>{formatMetric(sales)}</strong>
              <small>sales conversion</small>
            </div>
            <ArrowDown size={16} />
            <div>
              <span>Estimated</span>
              <strong>
                {opportunity
                  ? `$${Math.round(opportunity.estimatedAnnualValue).toLocaleString()}`
                  : "—"}
              </strong>
              <small>potential annual value</small>
            </div>
          </div>
          <div className="inspector-explanation">
            <span className="canvas-kicker">What changed</span>
            <p>
              Response time expanded while proposal preparation became harder to
              search and reuse. Gilar treats this as an observed chain, not a
              guaranteed causal claim.
            </p>
            <div className="inspector-sources">
              <span>
                <Database size={13} /> {response?.sourceSystems.join(" · ")}
              </span>
              <span>
                <Link2 size={13} /> Structural + observed association
              </span>
            </div>
          </div>
          <Button onClick={() => navigate("/app/opportunities/root-cause")}>
            Investigate the cause <ArrowRight size={15} />
          </Button>
        </>
      ) : (
        <>
          <div className="inspector-explanation">
            <span className="canvas-kicker">What Gilar sees</span>
            <p>
              {relatedIssue?.description ??
                `This area is being monitored from ${node.source}. Select the related action to inspect its evidence and permissions.`}
            </p>
            <div className="inspector-sources">
              <span>
                <Database size={13} /> {node.source}
              </span>
              <span>
                <ShieldCheck size={13} /> Evidence linked
              </span>
            </div>
          </div>
          <Button onClick={() => navigate("/app/opportunities")}>
            Open related actions <ArrowRight size={15} />
          </Button>
        </>
      )}
    </aside>
  );
}

function MissionControl({ overview }: { overview?: SyntheticOverview }) {
  const navigate = useNavigate();
  const attention = overview?.dashboard.attention?.slice(0, 3) ?? [];
  const issueMap = new Map(
    (overview?.issues ?? []).map((issue) => [issue.id, issue]),
  );
  const working = overview?.agents.slice(0, 2) ?? [];
  return (
    <section className="mission-control">
      <div className="mission-control-heading">
        <div>
          <span className="canvas-kicker">Mission Control / Today</span>
          <h2>Here’s what needs your attention.</h2>
          <p>
            Gilar is watching the connected business and routing only the
            decisions that deserve your time.
          </p>
        </div>
        <span className="mission-live">
          <i /> Live synthetic workspace
        </span>
      </div>
      <div className="mission-control-grid">
        <div className="mission-column">
          <div className="mission-column-label">
            Needs you <span>{attention.length}</span>
          </div>
          <h3 className="mission-attention-heading">
            What needs your attention
          </h3>
          {attention.map((item, index) => {
            const issue = issueMap.get(item.issueId);
            return (
              <button
                className="mission-row"
                key={item.issueId}
                onClick={() => navigate(item.deepLink)}
              >
                <span className={`mission-index ${item.severity}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mission-row-copy">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="mission-row-value">
                  {issue
                    ? `$${Math.round(issue.impact.estimatedAnnualValue).toLocaleString()}`
                    : "Review"}
                  <em>
                    {index === 0
                      ? "Investigate"
                      : index === 1
                        ? "Review action"
                        : "Monitor"}{" "}
                    <ArrowRight size={13} />
                  </em>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mission-column">
          <div className="mission-column-label">
            Gilar is working <span>{working.length}</span>
          </div>
          {working.map((agent) => (
            <button
              className="mission-row mission-row-working"
              key={agent.agent.id}
              onClick={() => navigate("/app/agents/proposal")}
            >
              <span className="mission-work-icon">
                <Sparkles size={15} />
              </span>
              <span className="mission-row-copy">
                <strong>{agent.agent.name}</strong>
                <small>{agent.businessImpact}</small>
              </span>
              <span className="mission-row-value">
                <b>{agent.stats.hoursSaved}h</b>
                <em>
                  {agent.agent.status === "active" ? "Running" : "Ready"}{" "}
                  <ArrowRight size={13} />
                </em>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BusinessCanvasPage() {
  const overview = useMissionOverview();
  const [selectedId, setSelectedId] = useState<string>();
  const selected = nodeDefinitions.find((node) => node.id === selectedId);
  return (
    <div className="mission-page business-canvas-page">
      <section className="canvas-intro">
        <div>
          <span className="canvas-kicker">
            Business / Northstar Distribution
          </span>
          <h1>
            What’s happening
            <br />
            <em>inside your company?</em>
          </h1>
          <p>
            Gilar maps the systems, signals, and decisions moving through the
            business right now.
          </p>
        </div>
        <div className="canvas-intro-actions">
          <span>
            <i className="live-dot" />{" "}
            {overview
              ? `${overview.sources.length} systems connected`
              : "Building business map"}
          </span>
          <button
            className="canvas-control"
            onClick={() => setSelectedId(undefined)}
          >
            <Crosshair size={14} /> Overview
          </button>
        </div>
      </section>
      <section className={`business-canvas ${selected ? "has-selection" : ""}`}>
        <div className="canvas-toolbar">
          <div>
            <span className="canvas-kicker">Live business model</span>
            <strong>
              {selected ? `Focused on ${selected.label}` : "Entire company"}
            </strong>
          </div>
          <div className="canvas-legend">
            <span>
              <i className="legend-line structural" /> Structural
            </span>
            <span>
              <i className="legend-line observed" /> Observed association
            </span>
            <span>
              <i className="legend-dot risk" /> Risk
            </span>
          </div>
        </div>
        <div className="canvas-stage">
          <svg
            className="canvas-connections"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label="Relationships between business systems"
          >
            {canvasEdges.map((edge) => {
              const from = nodeDefinitions.find(
                (node) => node.id === edge.from,
              )!;
              const to = nodeDefinitions.find((node) => node.id === edge.to)!;
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  className={`connection-line ${edge.label === "observed association" ? "observed" : ""}`}
                  x1={from.position[0] + 7}
                  y1={from.position[1] + 4}
                  x2={to.position[0] + 7}
                  y2={to.position[1] + 4}
                />
              );
            })}
          </svg>
          <div className="canvas-axis-label canvas-axis-top">
            Growth → conversion → value
          </div>
          <div className="canvas-axis-label canvas-axis-bottom">
            Delivery → retention → cash
          </div>
          {nodeDefinitions.map((node) => (
            <CanvasNode
              key={node.id}
              node={node}
              overview={overview}
              selected={selectedId === node.id}
              onSelect={() => setSelectedId(node.id)}
            />
          ))}
          {selected && (
            <CanvasInspector
              node={selected}
              overview={overview}
              onClose={() => setSelectedId(undefined)}
            />
          )}
        </div>
      </section>
      <MissionControl overview={overview} />
      <section className="canvas-footnote">
        <span>
          <GitBranch size={14} /> Relationships are labeled by evidence state.
          Gilar never turns a visual connection into a certainty.
        </span>
        <button onClick={() => setSelectedId("pipeline")}>
          Explore the pipeline <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}

export function MissionBriefPage() {
  const overview = useMissionOverview();
  const navigate = useNavigate();
  const conversion = metricByKey(
    overview?.metricRegistry,
    "sales_conversion_rate",
  );
  const response = metricByKey(overview?.metricRegistry, "lead_response_time");
  const topOpportunity = overview?.opportunities[0];
  return (
    <div className="mission-page brief-page">
      <section className="brief-masthead">
        <span className="canvas-kicker">Brief / Wednesday, October 21</span>
        <h1>
          Your pipeline weakened
          <br />
          <em>this week.</em>
        </h1>
        <p>
          The decline is concentrated in opportunities that still require manual
          proposal preparation. Here is the short version of what Gilar found
          and what it recommends next.
        </p>
      </section>
      <section className="brief-signal-story">
        <div className="brief-story-head">
          <span className="canvas-kicker">The signal</span>
          <span className="brief-source">
            Observed across HubSpot · Outlook · Google Drive
          </span>
        </div>
        <div className="brief-story-visual">
          <div className="brief-big-number">
            <strong>{formatMetric(conversion)}</strong>
            <span>sales conversion</span>
            <small>
              from{" "}
              {conversion?.previousValue === undefined
                ? "—"
                : `${Math.round(conversion.previousValue * 100)}%`}{" "}
              ·{" "}
              {conversion?.percentageChange === undefined
                ? "—"
                : `${conversion.percentageChange.toFixed(1)}%`}
            </small>
          </div>
          <div className="brief-annotated-flow">
            <span>
              Response time <b>{formatMetric(response)}</b>
            </span>
            <ArrowRight size={17} />
            <span>
              Proposal preparation{" "}
              <b>{overview?.simulation.before.proposalMinutes ?? "—"}m</b>
            </span>
            <ArrowRight size={17} />
            <span>
              Potential value{" "}
              <b>
                {topOpportunity
                  ? `$${Math.round(topOpportunity.estimatedAnnualValue).toLocaleString()}`
                  : "—"}
              </b>
            </span>
          </div>
        </div>
      </section>
      {overview?.scenario === "partial_coverage" && (
        <section className="brief-coverage-banner">
          <strong>Partial coverage</strong>
          <p>
            Some source systems are unavailable, so this brief remains
            directional until more evidence is connected.
          </p>
        </section>
      )}
      <section className="brief-two-column">
        <article>
          <span className="canvas-kicker">Why this matters</span>
          <h2>Small workflow friction is showing up as a sales problem.</h2>
          <p>
            Gilar found the same pattern across connected systems: slower
            response, more proposal effort, and a lower conversion rate. The
            evidence is strong enough to recommend a controlled fix, but every
            financial implication remains clearly labeled.
          </p>
          <div className="brief-causal-lines">
            <span>
              <i>01</i>Lead response slowed <b>{formatMetric(response)}</b>
            </span>
            <span>
              <i>02</i>Preparation became manual{" "}
              <b>{overview?.simulation.before.proposalMinutes ?? "—"}m</b>
            </span>
            <span>
              <i>03</i>Conversion moved down <b>{formatMetric(conversion)}</b>
            </span>
          </div>
        </article>
        <article className="brief-recommendation">
          <span className="canvas-kicker">What Gilar recommends</span>
          <Sparkles size={22} />
          <h2>Automate proposal preparation.</h2>
          <p>
            Search approved context, draft the first version, and keep the owner
            in control before anything leaves the business.
          </p>
          <div className="brief-recommendation-meta">
            <span>
              Potential value{" "}
              <b>
                {topOpportunity
                  ? `$${Math.round(topOpportunity.estimatedAnnualValue).toLocaleString()}`
                  : "—"}
              </b>
            </span>
            <span>
              Confidence{" "}
              <b>
                {topOpportunity
                  ? `${Math.round(topOpportunity.confidence * 100)}%`
                  : "—"}
              </b>
            </span>
          </div>
          <Button onClick={() => navigate("/app/opportunities/recommendation")}>
            Review the fix <ArrowRight size={15} />
          </Button>
        </article>
      </section>
      <section className="brief-next-line">
        <span>
          <Check size={15} /> Synthetic evidence stays local to this review
          workspace.
        </span>
        <button onClick={() => navigate("/app/home")}>
          Return to Business Canvas <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}

export function MissionActionsPage() {
  const overview = useMissionOverview();
  const navigate = useNavigate();
  const issueMap = new Map(
    (overview?.issues ?? []).map((issue) => [issue.id, issue]),
  );
  const attention = overview?.dashboard.attention?.slice(0, 3) ?? [];
  const completed = overview?.brief.completedActions.slice(0, 3) ?? [];
  return (
    <div className="mission-page actions-page">
      <section className="actions-masthead">
        <div>
          <span className="canvas-kicker">Actions / Mission Control</span>
          <h1>
            One place for every
            <br />
            <em>business decision.</em>
          </h1>
          <p>
            Review what needs you, what Gilar is already handling, and what the
            system is watching.
          </p>
        </div>
        <div className="actions-state">
          <span>
            <i className="live-dot" />{" "}
            {overview?.simulation.status === "running"
              ? "One fix running"
              : "3 active signals"}
          </span>
          <button onClick={() => navigate("/app/home")}>
            View business canvas <ArrowRight size={14} />
          </button>
        </div>
      </section>
      <section className="actions-legacy-bridge">
        <span className="canvas-kicker">
          A practical starting point · evidence-weighted ranking
        </span>
        <h2>What I would fix first.</h2>
        <p>Open the evidence before you approve an action.</p>
      </section>
      <div className="actions-workspace">
        <section className="action-lane needs-you">
          <div className="lane-heading">
            <span className="canvas-kicker">Needs you</span>
            <strong>{attention.length} decisions</strong>
          </div>
          <h3>What needs your attention</h3>
          <p className="lane-description">
            Evidence is ready. Gilar is waiting for your direction.
          </p>
          {attention.map((item, index) => {
            const issue = issueMap.get(item.issueId);
            return (
              <article className="action-row" key={item.issueId}>
                <span className={`action-row-index ${item.severity}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="action-row-body">
                  <div>
                    <span className="action-category">
                      {issue?.category ?? "Business signal"}
                    </span>
                    <StatusPill
                      tone={item.severity === "high" ? "red" : "yellow"}
                    >
                      {item.severity === "high" ? "Needs review" : "Watch"}
                    </StatusPill>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.detail}</p>
                  <div className="action-row-footer">
                    <strong>
                      {issue
                        ? `$${Math.round(issue.impact.estimatedAnnualValue).toLocaleString()} potential impact`
                        : "Impact pending"}
                    </strong>
                    <button
                      className="action-link"
                      onClick={() =>
                        navigate(
                          index === 0
                            ? "/app/opportunities/root-cause"
                            : item.deepLink,
                        )
                      }
                    >
                      {index === 0 ? "Investigate" : "Review action"}{" "}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        <section className="action-lane working-lane">
          <div className="lane-heading">
            <span className="canvas-kicker">Gilar is working</span>
            <strong>
              {overview?.simulation.status === "running"
                ? "Running now"
                : "Ready when approved"}
            </strong>
          </div>
          <p className="lane-description">
            Controlled workflows with approval boundaries and audit trails.
          </p>
          <article className="working-process">
            <div className="working-process-head">
              <div>
                <span className="working-icon">
                  <Sparkles size={17} />
                </span>
                <h2>Proposal preparation</h2>
              </div>
              <StatusPill
                tone={
                  overview?.simulation.status === "running" ? "green" : "blue"
                }
              >
                {overview?.simulation.status === "running"
                  ? "Running"
                  : "Needs approval"}
              </StatusPill>
            </div>
            <div className="process-track">
              <span>
                <i>01</i>Find
              </span>
              <b>→</b>
              <span>
                <i>02</i>Draft
              </span>
              <b>→</b>
              <span>
                <i>03</i>Review
              </span>
              <b>→</b>
              <span>
                <i>04</i>Measure
              </span>
            </div>
            <div className="working-proof">
              <span>
                <strong>{overview?.agents[0]?.stats.assisted ?? 12}</strong>
                <small>proposals assisted</small>
              </span>
              <span>
                <strong>{overview?.agents[0]?.stats.hoursSaved ?? 116}h</strong>
                <small>hours saved</small>
              </span>
              <span>
                <strong>
                  {overview?.agents[0]?.stats.directionalROI?.toFixed(1) ??
                    "5.2"}
                  ×
                </strong>
                <small>directional ROI</small>
              </span>
            </div>
            <button
              className="action-link"
              onClick={() => navigate("/app/opportunities/deploy")}
            >
              Open workflow <ArrowRight size={14} />
            </button>
          </article>
          <div className="watching-inline">
            <span className="canvas-kicker">Watching</span>
            <p>
              <Crosshair size={14} /> Inventory cover is approaching the
              replenishment threshold.
            </p>
            <button onClick={() => navigate("/app/executive")}>
              Open health <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <section className="completed-strip">
        <span className="canvas-kicker">Completed by Gilar</span>
        {completed.map((item, index) => (
          <span key={`${item}-${index}`}>
            <Check size={14} /> {item}
          </span>
        ))}
        {!completed.length && <span>No completed work in this period.</span>}
      </section>
      <section className="actions-footer">
        <span>
          <ShieldCheck size={15} /> Every action remains approval-gated.
        </span>
        <button onClick={() => navigate("/app/opportunities/map")}>
          Open impact × effort map <ArrowRight size={14} />
        </button>
      </section>
    </div>
  );
}

export function ImpactLedgerPage() {
  const overview = useMissionOverview();
  const navigate = useNavigate();
  const simulation = overview?.simulation;
  const outcome = simulation?.outcome;
  const roi = simulation?.roiRecord;
  const impact = outcome?.annualizedImpact;
  const events = [
    {
      label: "Proposal automation",
      before: simulation?.before.proposalMinutes,
      after: simulation?.after?.proposalMinutes,
      unit: "min",
      impact: outcome?.costSaved,
      note: "measured preparation time",
    },
    {
      label: "Lead response",
      before: simulation?.before.leadResponseHours,
      after: simulation?.after?.leadResponseHours,
      unit: "h",
      impact: outcome?.timeSavedHours,
      note: "measured response speed",
    },
    {
      label: "Sales conversion",
      before: simulation?.before.conversionRate,
      after: simulation?.after?.conversionRate,
      unit: "%",
      impact: outcome?.revenueGained,
      note: "estimated revenue implication",
    },
  ];
  return (
    <div className="mission-page results-ledger-page">
      <section className="ledger-masthead">
        <div>
          <span className="canvas-kicker">Results / Impact ledger</span>
          <h1>What changed.</h1>
          <p>
            Because Gilar acted. Measured business impact first; estimates and
            projections remain visibly separate.
          </p>
        </div>
        <button className="ledger-range">
          Last 30 days <ArrowRight size={14} />
        </button>
      </section>
      {outcome && (
        <section className="ledger-outcome-callout">
          <span className="canvas-kicker">Measured outcome</span>
          <h2>Proposal preparation got faster.</h2>
          <p>
            The approval-gated workflow moved from{" "}
            {simulation?.before.proposalMinutes ?? "—"}m to{" "}
            {simulation?.after?.proposalMinutes ?? "—"}m, with revenue
            implications still labeled as estimated.
          </p>
          <div>
            <span>Measured</span>
            <span>Estimated</span>
            <span>{simulation?.after?.proposalMinutes ?? "—"}m</span>
            <span>
              {roi?.implementationCost
                ? `${(roi.annualizedImpact / roi.implementationCost).toFixed(1)}x`
                : "Impact recorded"}
            </span>
            {roi?.implementationCost && <strong>ROI</strong>}
          </div>
        </section>
      )}
      {!outcome && overview?.scenario === "no_roi" && (
        <section className="ledger-outcome-callout ledger-no-outcome">
          <span className="canvas-kicker">Attribution boundary</span>
          <h2>No measurable ROI is available</h2>
          <p>
            The measurement window completed, but current data could not
            attribute a reliable business result.
          </p>
          <strong>
            ROI methodology will appear once a measurable outcome exists.
          </strong>
        </section>
      )}
      <section className="ledger-summary">
        <div>
          <span className="canvas-kicker">Measured value</span>
          <strong>
            {impact === undefined
              ? "—"
              : `$${Math.round(impact).toLocaleString()}`}
          </strong>
          <p>
            {impact === undefined
              ? "Complete an approved measurement window to record value."
              : "annualized impact from the controlled synthetic intervention"}
          </p>
        </div>
        <div>
          <span className="canvas-kicker">Time saved</span>
          <strong>
            {outcome?.timeSavedHours === undefined
              ? "—"
              : `${outcome.timeSavedHours}h`}
          </strong>
          <p>observed after approval</p>
        </div>
        <div>
          <span className="canvas-kicker">Active fixes</span>
          <strong>
            {overview?.opportunities.filter(
              (item) => item.status !== "completed",
            ).length ?? "—"}
          </strong>
          <p>opportunities still in motion</p>
        </div>
        <div>
          <span className="canvas-kicker">Directional ROI</span>
          <strong>
            {roi?.implementationCost
              ? `${(roi.annualizedImpact / roi.implementationCost).toFixed(1)}x`
              : "—"}
          </strong>
          <p>measured + estimated components</p>
        </div>
      </section>
      <section className="impact-ledger">
        <div className="ledger-heading">
          <div>
            <span className="canvas-kicker">Impact timeline</span>
            <h2>From intervention to evidence.</h2>
          </div>
          <StatusPill
            tone={simulation?.status === "completed" ? "green" : "yellow"}
          >
            {simulation?.status === "completed"
              ? "Measured"
              : "Measurement pending"}
          </StatusPill>
        </div>
        {events.map((event) => (
          <article className="ledger-event" key={event.label}>
            <div className="ledger-event-title">
              <span className="ledger-event-dot" />
              <strong>{event.label}</strong>
              <small>{event.note}</small>
            </div>
            <div className="ledger-event-change">
              <strong>
                {event.before === undefined
                  ? "—"
                  : `${event.before}${event.unit}`}{" "}
                <ArrowRight size={15} />{" "}
                {event.after === undefined
                  ? "—"
                  : `${event.after}${event.unit}`}
              </strong>
              <span>
                {event.impact === undefined
                  ? "Pending measurement"
                  : event.unit === "h"
                    ? `${event.impact} hours saved`
                    : `$${Math.round(event.impact).toLocaleString()} ${event.label === "Sales conversion" ? "estimated impact" : "measured impact"}`}
              </span>
            </div>
            <div className="ledger-event-bar">
              <i
                style={{
                  width:
                    event.before && event.after
                      ? `${Math.min(96, Math.max(18, Math.round((1 - Number(event.after) / Number(event.before)) * 100)))}%`
                      : "18%",
                }}
              />
            </div>
          </article>
        ))}
      </section>
      <section className="ledger-bottom">
        <article>
          <span className="canvas-kicker">What is measured</span>
          <h2>Observed outcomes stay auditable.</h2>
          <p>
            Proposal preparation and response time are measured after the
            approval-gated action. Revenue remains estimated until attributable
            evidence supports it.
          </p>
          <button onClick={() => navigate("/app/opportunities/deploy")}>
            View action lifecycle <ArrowRight size={14} />
          </button>
        </article>
        <article className="ledger-proof">
          <span>
            <Check size={15} /> Synthetic data only
          </span>
          <span>
            <Check size={15} /> Approval recorded
          </span>
          <span>
            <Check size={15} /> Measurement window{" "}
            {simulation?.targetDays ?? 30} days
          </span>
        </article>
      </section>
    </div>
  );
}

export function MissionLandingPage() {
  const navigate = useNavigate();
  return (
    <div className="mission-landing">
      <header className="mission-landing-nav">
        <div className="landing-wordmark">gilar</div>
        <nav>
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <Button onClick={() => navigate("/signup")}>
          Get started <ArrowRight size={15} />
        </Button>
      </header>
      <main>
        <section className="landing-signal-hero">
          <div className="landing-signal-copy">
            <span className="canvas-kicker">
              The business intelligence system
            </span>
            <h1>
              Your business is connected.
              <br />
              <em>Gilar shows you where to act.</em>
            </h1>
            <p>
              See the relationships between pipeline, sales, revenue, and cash.
              Understand what changed. Approve the right fix. Measure what
              happened next.
            </p>
            <div className="landing-actions">
              <Button onClick={() => navigate("/signup")}>
                Build your business map <ArrowRight size={15} />
              </Button>
              <button
                className="landing-text-link"
                onClick={() => navigate("/onboarding/mri")}
              >
                See how it works <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="landing-canvas-preview">
            <svg viewBox="0 0 600 310" preserveAspectRatio="none">
              <path d="M70 105 C170 40 210 140 305 98 S440 55 530 125" />
              <path d="M305 98 C280 175 390 170 420 242" />
              <path d="M70 105 C130 205 250 210 420 242" />
            </svg>
            <span className="preview-node preview-marketing">
              Marketing <b>31 quiet</b>
            </span>
            <span className="preview-node preview-pipeline active">
              Pipeline <b>$354.6K · ↑80.7%</b>
            </span>
            <span className="preview-node preview-sales risk">
              Sales <b>23% · ↓25.8%</b>
            </span>
            <span className="preview-node preview-revenue">
              Revenue <b>$151K</b>
            </span>
            <span className="preview-node preview-cash">
              Cash <b>$129.9K</b>
            </span>
            <div className="preview-alert">
              <CircleAlert size={14} /> Gilar found an $82K opportunity{" "}
              <ArrowRight size={14} />
            </div>
          </div>
        </section>
        <section className="landing-explain">
          <span>Marketing</span>
          <ArrowRight size={15} />
          <span>Pipeline</span>
          <ArrowRight size={15} />
          <span>Sales</span>
          <ArrowRight size={15} />
          <span>Revenue</span>
          <ArrowRight size={15} />
          <span>Cash</span>
        </section>
        <section className="landing-proof">
          <div>
            <span className="canvas-kicker">A different way to work</span>
            <h2>
              See why.
              <br />
              Fix what matters.
              <br />
              <em>Measure the change.</em>
            </h2>
          </div>
          <div className="landing-proof-steps">
            <span>
              <i>01</i>
              <strong>Business Canvas</strong>
              <small>Explore the company as one connected system.</small>
            </span>
            <span>
              <i>02</i>
              <strong>Mission Control</strong>
              <small>
                Move from signal to decision without dashboard hunting.
              </small>
            </span>
            <span>
              <i>03</i>
              <strong>Impact Ledger</strong>
              <small>Keep measured results separate from estimates.</small>
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

export function BusinessModelBuildPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(3);
  const stages = [
    "Connections",
    "Metrics",
    "Relationships",
    "Signals",
    "Opportunities",
  ];
  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((current) => Math.min(stages.length - 1, current + 1)),
      650,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="model-build-page">
      <div className="model-build-top">
        <span className="landing-wordmark">gilar</span>
        <span>
          Building your business model <b>Step 4 of 4</b>
        </span>
        <span className="model-avatar">MP</span>
      </div>
      <main className="model-build-main">
        <div>
          <span className="canvas-kicker">
            Business model / diagnostic scan
          </span>
          <h1>
            Gilar is building
            <br />
            <em>the shape of your business.</em>
          </h1>
          <p>
            Connections become metrics. Metrics become relationships.
            Relationships reveal the decisions that matter.
          </p>
          <div className="model-progress">
            {stages.map((stage, index) => (
              <button
                key={stage}
                className={index <= active ? "complete" : ""}
                onClick={() => setActive(index)}
              >
                <i>
                  {index < active ? (
                    <Check size={13} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </i>
                <span>{stage}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="model-build-visual">
          <div className="model-core">
            <Crosshair size={28} />
            <span>
              BUSINESS
              <br />
              CANVAS
            </span>
          </div>
          {stages.map((stage, index) => (
            <span
              key={stage}
              className={`model-orbit model-orbit-${index} ${index <= active ? "active" : ""}`}
            >
              <i />
              {stage}
            </span>
          ))}
        </div>
      </main>
      <footer>
        <span>
          <ShieldCheck size={14} /> Synthetic records stay local to this review.
        </span>
        <Button onClick={() => navigate("/app/home")}>
          See what needs attention <ArrowRight size={15} />
        </Button>
      </footer>
    </div>
  );
}
