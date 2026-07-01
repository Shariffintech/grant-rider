"use client";

import {
  Activity,
  Antenna,
  Bot,
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  FileSearch,
  Gauge,
  GitBranch,
  HardDrive,
  ListChecks,
  Loader2,
  LockKeyhole,
  Network,
  Radar,
  Save,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TerminalSquare,
  UserCog,
  Wifi
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type FounderProfile = {
  name: string;
  founder_name: string;
  industry: string;
  entity_type: string;
  focus_areas: string[];
  business_stage: string;
  eligible_locations: string[];
  target_customers: string[];
  funding_needs: string[];
  excluded_grants: string[];
  minimum_score_to_draft: number;
};

type WorkflowResult = {
  grant: {
    title: string;
    url: string;
    funder?: string | null;
    deadline?: string | null;
    funding_amount?: number | null;
    eligibility_summary?: string | null;
    focus_areas: string[];
    required_documents: string[];
    application_questions: string[];
    estimated_effort: string;
    extraction_notes: string[];
    status: string;
  };
  score: {
    total: number;
    breakdown: Record<string, number>;
    reasons: string[];
    disqualifiers: string[];
    next_step: string;
  };
  draft_path?: string | null;
  report_path: string;
};

type DiscoveredOpportunity = {
  title: string;
  url: string;
  source: string;
  eligibility_summary?: string | null;
  status: string;
  search_keyword?: string | null;
};

const emptyProfile: FounderProfile = {
  name: "",
  founder_name: "",
  industry: "",
  entity_type: "for-profit",
  focus_areas: [],
  business_stage: "",
  eligible_locations: [],
  target_customers: [],
  funding_needs: [],
  excluded_grants: [],
  minimum_score_to_draft: 80
};

const pipeline = [
  { label: "Ingress", icon: Antenna },
  { label: "Extract", icon: FileSearch },
  { label: "Score", icon: CircleGauge },
  { label: "Route", icon: GitBranch },
  { label: "Draft", icon: ClipboardCheck },
  { label: "Review", icon: ShieldCheck }
];

export default function Dashboard() {
  const [profile, setProfile] = useState<FounderProfile>(emptyProfile);
  const [reports, setReports] = useState<WorkflowResult[]>([]);
  const [discoveries, setDiscoveries] = useState<DiscoveredOpportunity[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveredOpportunity | null>(null);
  const [activeReport, setActiveReport] = useState<WorkflowResult | null>(null);
  const [grantUrl, setGrantUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryLimit, setDiscoveryLimit] = useState(5);
  const [notice, setNotice] = useState("Standing by for grant target acquisition.");

  const readiness = useMemo(() => {
    const checks = [
      profile.name,
      profile.founder_name,
      profile.industry,
      profile.focus_areas.length,
      profile.eligible_locations.length,
      profile.funding_needs.length,
      profile.minimum_score_to_draft
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  const filteredDiscoveries = useMemo(() => {
    const query = discoveryQuery.trim().toLowerCase();
    if (!query) {
      return discoveries;
    }

    return discoveries.filter((opportunity) =>
      [opportunity.title, opportunity.eligibility_summary, opportunity.search_keyword, opportunity.url]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [discoveries, discoveryQuery]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [profileResponse, reportsResponse, discoveriesResponse] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/reports"),
      fetch("/api/discover")
    ]);
    const nextProfile = await profileResponse.json();
    const nextReports = await reportsResponse.json();
    const nextDiscoveries = await discoveriesResponse.json();
    setProfile(nextProfile);
    setReports(nextReports);
    setDiscoveries(nextDiscoveries);
    setSelectedDiscovery((current) => current ?? nextDiscoveries[0] ?? null);
    setActiveReport(nextReports[0] ?? null);
  }

  async function saveProfile() {
    setIsSaving(true);
    setNotice("Syncing founder profile to the backend control file.");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile)
    });
    setProfile(await response.json());
    setIsSaving(false);
    setNotice("Founder profile saved. Agents will use the updated context on the next run.");
  }

  async function runDiscovery() {
    setIsDiscovering(true);
    setNotice("Running grant-rider discover across configured search keywords.");
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: discoveryLimit })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error ?? "Discovery failed.");
      setIsDiscovering(false);
      return;
    }

    setDiscoveries(payload);
    setSelectedDiscovery(payload[0] ?? null);
    setIsDiscovering(false);
    setNotice(`Discovery complete: ${payload.length} opportunities loaded into the queue.`);
  }

  async function runGrant(targetUrl = grantUrl.trim()) {
    if (!targetUrl) {
      setNotice("Paste a grant URL before launching the agent run.");
      return;
    }

    setIsRunning(true);
    setDraft("");
    setGrantUrl(targetUrl);
    setNotice("Grant agents are extracting, scoring, and routing the target.");
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: targetUrl })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error ?? "Agent run failed.");
      setIsRunning(false);
      return;
    }

    setActiveReport(payload);
    await refresh();
    setIsRunning(false);
    setNotice(`Run complete: ${formatStep(payload.score.next_step)} at ${payload.score.total}/100.`);
  }

  async function applySelectedGrant() {
    if (!selectedDiscovery) {
      setNotice("Select a discovered grant before applying.");
      return;
    }

    await runGrant(selectedDiscovery.url);
  }

  async function loadDraft(report = activeReport) {
    if (!report?.draft_path) {
      setDraft("No draft was created for this opportunity. Review the score route and founder notes.");
      return;
    }

    const response = await fetch("/api/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftPath: report.draft_path })
    });
    const payload = await response.json();
    setDraft(payload.content ?? payload.error ?? "Draft unavailable.");
  }

  return (
    <main className="ops-shell">
      <section className="hero-band">
        <div>
          <p className="eyebrow"><Network size={16} /> Grant Rider Command Deck</p>
          <h1>Abena DMS grant battle station</h1>
          <p className="mission-copy">
            A network-ops dashboard for founder profile control, grant target intake, ADK agent
            routing, draft generation, and human review.
          </p>
        </div>
        <div className="status-stack">
          <StatusTile icon={Wifi} label="Backend link" value="ADK ready" />
          <StatusTile icon={Gauge} label="Profile readiness" value={`${readiness}%`} />
          <StatusTile icon={LockKeyhole} label="Submission gate" value="Founder review" />
        </div>
      </section>

      <section className="discovery-command station-panel">
        <div className="discovery-header">
          <div>
            <PanelTitle
              icon={Search}
              title="Grant Discovery Sweep"
              action={isDiscovering ? "Searching" : `${discoveries.length} found`}
            />
            <p>
              Run <strong>grant-rider discover</strong>, filter the discovered targets, select the
              best opportunity, then send it into the ADK apply pipeline.
            </p>
          </div>
          <div className="discovery-actions">
            <label className="field compact-field">
              <span>Results per keyword</span>
              <input
                type="number"
                min="1"
                max="10"
                value={discoveryLimit}
                onChange={(event) => setDiscoveryLimit(Number(event.target.value))}
              />
            </label>
            <button className="discover-button" onClick={runDiscovery} disabled={isDiscovering}>
              {isDiscovering ? <Loader2 className="spin" size={19} /> : <Radar size={19} />}
              Discover Grants
            </button>
            <button className="apply-button" onClick={applySelectedGrant} disabled={!selectedDiscovery || isRunning}>
              {isRunning ? <Loader2 className="spin" size={19} /> : <Target size={19} />}
              Apply Selected
            </button>
          </div>
        </div>
        <div className="discovery-search">
          <Search size={18} />
          <input
            value={discoveryQuery}
            onChange={(event) => setDiscoveryQuery(event.target.value)}
            placeholder="Filter discovered grants by keyword, title, summary, or URL"
            aria-label="Filter discovered grants"
          />
        </div>
        <div className="discovery-grid">
          <div className="discovery-list">
            {filteredDiscoveries.map((opportunity) => (
              <button
                className={
                  selectedDiscovery?.url === opportunity.url
                    ? "discovery-row active"
                    : "discovery-row"
                }
                key={opportunity.url}
                onClick={() => {
                  setSelectedDiscovery(opportunity);
                  setGrantUrl(opportunity.url);
                  setNotice(`Selected ${opportunity.title}. Ready to apply.`);
                }}
              >
                <span>{opportunity.title}</span>
                <small>{opportunity.search_keyword ?? "discovered"}</small>
              </button>
            ))}
            {filteredDiscoveries.length === 0 && (
              <p className="empty-state">
                No discovered grants match the current filter. Run discovery or clear the search.
              </p>
            )}
          </div>
          <div className="selected-discovery">
            <span className="selected-label">Selected target</span>
            {selectedDiscovery ? (
              <>
                <h2>{selectedDiscovery.title}</h2>
                <a href={selectedDiscovery.url} target="_blank" rel="noreferrer">
                  {selectedDiscovery.url}
                </a>
                <p>{selectedDiscovery.eligibility_summary ?? "No search summary available."}</p>
                <div className="selected-actions">
                  <button className="secondary-button" onClick={() => setGrantUrl(selectedDiscovery.url)}>
                    <Send size={17} />
                    Load URL
                  </button>
                  <button className="apply-button inline-apply" onClick={applySelectedGrant} disabled={isRunning}>
                    {isRunning ? <Loader2 className="spin" size={17} /> : <Target size={17} />}
                    Apply Now
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-state">Select a discovered grant to inspect it and apply.</p>
            )}
          </div>
        </div>
      </section>

      <section className="command-grid">
        <div className="station-panel mission-control">
          <PanelTitle icon={Radar} title="Manual Target Acquisition" action={isRunning ? "Running" : "Ready"} />
          <div className="target-row">
            <input
              value={grantUrl}
              onChange={(event) => setGrantUrl(event.target.value)}
              placeholder="https://grantmaker.org/opportunity"
              aria-label="Grant URL"
            />
            <button className="primary-button" onClick={() => runGrant()} disabled={isRunning}>
              {isRunning ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              Launch
            </button>
          </div>
          <div className="pipeline">
            {pipeline.map((node, index) => {
              const Icon = node.icon;
              return (
                <div className="pipe-node" key={node.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={19} />
                  <strong>{node.label}</strong>
                </div>
              );
            })}
          </div>
          <div className="terminal-line">
            <TerminalSquare size={18} />
            <span>{notice}</span>
          </div>
        </div>

        <div className="station-panel score-panel">
          <PanelTitle icon={Activity} title="Agent Telemetry" action={activeReport ? activeReport.grant.status : "Idle"} />
          <div className="score-orbit">
            <div>
              <span>Match Score</span>
              <strong>{activeReport?.score.total ?? "--"}</strong>
              <small>/100</small>
            </div>
          </div>
          <div className="breakdown-list">
            {Object.entries(activeReport?.score.breakdown ?? {}).map(([key, value]) => (
              <div className="meter-row" key={key}>
                <span>{formatStep(key)}</span>
                <div><i style={{ width: `${Math.min(100, value * 4)}%` }} /></div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="work-grid">
        <div className="station-panel profile-panel">
          <PanelTitle icon={UserCog} title="Founder Profile" action="Editable" />
          <div className="form-grid">
            <TextField label="Company" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} />
            <TextField label="Founder" value={profile.founder_name} onChange={(value) => setProfile({ ...profile, founder_name: value })} />
            <TextField label="Industry" value={profile.industry} onChange={(value) => setProfile({ ...profile, industry: value })} />
            <TextField label="Entity" value={profile.entity_type} onChange={(value) => setProfile({ ...profile, entity_type: value })} />
            <TextField label="Stage" value={profile.business_stage} onChange={(value) => setProfile({ ...profile, business_stage: value })} />
            <label className="field">
              <span>Draft threshold</span>
              <input
                type="number"
                min="0"
                max="100"
                value={profile.minimum_score_to_draft}
                onChange={(event) =>
                  setProfile({ ...profile, minimum_score_to_draft: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <ListEditor label="Focus areas" values={profile.focus_areas} onChange={(values) => setProfile({ ...profile, focus_areas: values })} />
          <ListEditor label="Eligible locations" values={profile.eligible_locations} onChange={(values) => setProfile({ ...profile, eligible_locations: values })} />
          <ListEditor label="Funding needs" values={profile.funding_needs} onChange={(values) => setProfile({ ...profile, funding_needs: values })} />
          <ListEditor label="Excluded grants" values={profile.excluded_grants} onChange={(values) => setProfile({ ...profile, excluded_grants: values })} />
          <button className="secondary-button" onClick={saveProfile} disabled={isSaving}>
            {isSaving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
            Save Profile
          </button>
        </div>

        <div className="station-panel reports-panel">
          <PanelTitle icon={HardDrive} title="Opportunity Queue" action={`${reports.length} logged`} />
          <div className="report-list">
            {reports.map((report) => (
              <button
                className={activeReport?.report_path === report.report_path ? "report-row active" : "report-row"}
                key={report.report_path}
                onClick={() => {
                  setActiveReport(report);
                  setDraft("");
                }}
              >
                <span>{report.grant.title}</span>
                <b>{report.score.total}</b>
                <small>{formatStep(report.score.next_step)}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="intel-grid">
        <div className="station-panel detail-panel">
          <PanelTitle icon={ServerCog} title="Selected Grant Intel" action={activeReport ? "Loaded" : "No target"} />
          {activeReport ? (
            <div className="intel-body">
              <h2>{activeReport.grant.title}</h2>
              <a href={activeReport.grant.url} target="_blank" rel="noreferrer">{activeReport.grant.url}</a>
              <div className="intel-stats">
                <StatusTile icon={SlidersHorizontal} label="Effort" value={activeReport.grant.estimated_effort} />
                <StatusTile icon={CheckCircle2} label="Route" value={formatStep(activeReport.score.next_step)} />
                <StatusTile icon={ListChecks} label="Questions" value={String(activeReport.grant.application_questions.length)} />
              </div>
              <h3>Routing reasons</h3>
              <ul>
                {activeReport.score.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              {activeReport.score.disqualifiers.length > 0 && (
                <>
                  <h3>Disqualifiers</h3>
                  <ul>
                    {activeReport.score.disqualifiers.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </>
              )}
              <button className="secondary-button" onClick={() => loadDraft()}>
                <ClipboardCheck size={17} />
                Open Draft
              </button>
            </div>
          ) : (
            <p className="empty-state">Run or select a grant to inspect score reasons, questions, documents, and draft output.</p>
          )}
        </div>

        <div className="station-panel draft-panel">
          <PanelTitle icon={Bot} title="Application Draft Buffer" action={draft ? "Open" : "Closed"} />
          <pre>{draft || "Drafts appear here after the deterministic threshold routes a grant into draft_application."}</pre>
        </div>
      </section>
    </main>
  );
}

function PanelTitle({
  icon: Icon,
  title,
  action
}: {
  icon: React.ElementType;
  title: string;
  action: string;
}) {
  return (
    <div className="panel-title">
      <h2><Icon size={18} /> {title}</h2>
      <span>{action}</span>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="status-tile">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ListEditor({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="field list-field">
      <span>{label}</span>
      <textarea
        value={values.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n"))}
        rows={4}
      />
    </label>
  );
}

function formatStep(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
