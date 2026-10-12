"use client";

import {
  Activity,
  Antenna,
  BookOpenCheck,
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
  Radar,
  RotateCcw,
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

const suggestedProfile: FounderProfile = {
  ...emptyProfile,
  name: "Abena DMS",
  founder_name: "Shariff Tarver",
  industry: "Childcare and early-learning compliance software",
  focus_areas: ["Childcare compliance", "Early learning and preschool", "Licensing and inspection readiness", "Staff compliance and background-check tracking", "Audit-ready records and documentation"],
  eligible_locations: ["New Jersey", "Pennsylvania"],
  target_customers: ["Childcare center directors and operators", "Early-learning providers", "Family child-care providers"]
};

const pipeline = [
  { label: "Read page", icon: Antenna },
  { label: "Pull details", icon: FileSearch },
  { label: "Check fit", icon: CircleGauge },
  { label: "Pick path", icon: GitBranch },
  { label: "Make draft", icon: ClipboardCheck },
  { label: "You review", icon: ShieldCheck }
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
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryLimit, setDiscoveryLimit] = useState(5);
  const [notice, setNotice] = useState("Start by clicking Find Grants.");
  const isLoadingOverlayActive = isDiscovering || isRunning || isArchiving;
  const loadingTitle = isDiscovering
    ? "Searching for grants"
    : isRunning
      ? "Building your draft"
      : "Archiving grant";

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

  const profileSuggestions = activeReport ? getProfileSuggestions(activeReport, profile) : [];

  useEffect(() => {
    refresh();
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile unavailable");
        const saved = await response.json() as FounderProfile;
        const completed = { ...suggestedProfile, ...saved };
        for (const key of ["focus_areas", "eligible_locations", "target_customers", "funding_needs", "excluded_grants"] as const) {
          if (!completed[key]?.length) completed[key] = suggestedProfile[key];
        }
        setProfile(completed);
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(completed)
        });
      })
      .catch(() => setProfile(suggestedProfile));
  }, []);

  async function refresh() {
    const [reportsResponse, discoveriesResponse] = await Promise.all([
      fetch("/api/reports"),
      fetch("/api/discover")
    ]);
    const nextReports = await reportsResponse.json();
    const nextDiscoveries = await discoveriesResponse.json();
    setReports(nextReports);
    setDiscoveries(nextDiscoveries);
    setSelectedDiscovery((current) => current ?? nextDiscoveries[0] ?? null);
    setActiveReport(nextReports[0] ?? null);
  }


  async function saveProfile() {
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "Could not save profile.");
      setProfile(payload);
      setNotice("Company profile saved. Grant fit scores will use these details.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function resetProfile() {
    setProfile({ ...emptyProfile });
    setNotice("Company profile cleared. It will also reset whenever this page is refreshed.");
  }

  async function runDiscovery() {
    setIsDiscovering(true);
    setNotice("Looking for grant opportunities. This may take a minute.");
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: discoveryLimit })
    });
    const payload = await readJsonResponse(response);
    const opportunities = Array.isArray(payload) ? payload : payload.opportunities ?? [];

    if (!response.ok || payload.error) {
      setNotice(payload.error ?? "Discovery failed.");
      setIsDiscovering(false);
      return;
    }

    setDiscoveries(opportunities);
    setSelectedDiscovery(opportunities[0] ?? null);
    setIsDiscovering(false);
    setNotice(
      opportunities.length > 0
        ? `Found ${opportunities.length} grant opportunities. Choose one, then click Start Draft.`
        : "No grants came back from the search. Try again in a minute."
    );
  }

  async function runGrant(targetUrl = grantUrl.trim()) {
    if (!targetUrl) {
      setNotice("Paste a grant website link first.");
      return;
    }

    setIsRunning(true);
    setDraft("");
    setGrantUrl(targetUrl);
    setNotice("Reading the grant page and making a first application draft.");
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: targetUrl, profile })
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.error ?? "Agent run failed.");
      setIsRunning(false);
      return;
    }

    await refresh();
    setActiveReport(payload);
    if (payload.draft_path) {
      await loadDraft(payload);
      setNotice(`Draft ready for review; it has not been submitted. Fit score: ${payload.score.total}/100 for ${profile.name || "your company"}.`);
    } else {
      setNotice(`The workflow did not return a draft. Fit score: ${payload.score.total}/100. Please retry or review the report.`);
    }
    setIsRunning(false);
  }

  async function applySelectedGrant() {
    if (!selectedDiscovery) {
      setNotice("Choose a grant from the list first.");
      return;
    }

    await runGrant(selectedDiscovery.url);
  }

  async function loadDraft(report = activeReport) {
    if (!report?.draft_path) {
      setDraft("No draft was made for this grant yet. Check the score notes to see why.");
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

  async function archiveActiveGrant() {
    if (!activeReport) {
      setNotice("Choose a checked grant first.");
      return;
    }

    if (activeReport.grant.status === "archived") {
      setNotice(`${activeReport.grant.title} is already archived.`);
      return;
    }

    setIsArchiving(true);
    setNotice("Archiving this grant after review.");
    const response = await fetch("/api/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportPath: activeReport.report_path })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      setNotice(payload.error ?? payload.detail ?? "Could not archive this grant.");
      setIsArchiving(false);
      return;
    }

    setActiveReport(payload);
    setReports((current) =>
      current.map((report) => (report.report_path === payload.report_path ? payload : report))
    );
    setDraft("");
    setIsArchiving(false);
    setNotice(`${payload.grant.title} has been archived.`);
  }

  return (
    <>
    <main className={isLoadingOverlayActive ? "ops-shell loading-blur" : "ops-shell"}>
      <section className="hero-band">
        <div>
          <p className="eyebrow"><BookOpenCheck size={16} /> Granted</p>
          <h1>Granted</h1>
          <p className="mission-copy">
            Use this like a simple checklist: find grants, choose the one that looks best, then
            let the helper make a first draft for you to review.
          </p>
          <div className="simple-steps" aria-label="How to use Granted">
            <span>1. Find grants</span>
            <span>2. Pick one</span>
            <span>3. Review the draft</span>
          </div>
        </div>
        <div className="status-stack">
          <StatusTile icon={Wifi} label="Granted" value="Ready" />
          <StatusTile icon={Gauge} label="Company profile" value={`${readiness}% ready`} />
          <StatusTile icon={LockKeyhole} label="Final step" value="You approve" />
        </div>
      </section>

      <section className="discovery-command station-panel">
        <div className="discovery-header">
          <div>
            <PanelTitle
              icon={Search}
              title="Step 1: Find Grants"
              action={isDiscovering ? "Searching" : `${discoveries.length} found`}
            />
            <p>
              Click <strong>Find Grants</strong>. Then pick one grant from the list and click
              <strong> Start Draft</strong>. Think of it like choosing an article in Google Docs,
              then asking for a first draft.
            </p>
          </div>
          <div className="discovery-actions">
            <label className="field compact-field">
              <span>How many per topic</span>
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
              Find Grants
            </button>
            <button className="apply-button" onClick={applySelectedGrant} disabled={!selectedDiscovery || isRunning}>
              {isRunning ? <Loader2 className="spin" size={19} /> : <Target size={19} />}
              Start Draft
            </button>
          </div>
        </div>
        <div className="discovery-search">
          <Search size={18} />
          <input
            value={discoveryQuery}
            onChange={(event) => setDiscoveryQuery(event.target.value)}
            placeholder="Search the grant list by topic, name, or website"
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
                  setNotice(`You picked ${opportunity.title}. Click Start Draft when ready.`);
                }}
              >
                <span>{opportunity.title}</span>
                <small>{opportunity.search_keyword ?? "discovered"}</small>
              </button>
            ))}
            {filteredDiscoveries.length === 0 && (
              <p className="empty-state">
                No grants match this search. Clear the search box or click Find Grants again.
              </p>
            )}
          </div>
          <div className="selected-discovery">
            <span className="selected-label">Grant you picked</span>
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
                    Use this link
                  </button>
                  <button className="apply-button inline-apply" onClick={applySelectedGrant} disabled={isRunning}>
                    {isRunning ? <Loader2 className="spin" size={17} /> : <Target size={17} />}
                    Start Draft
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-state">Choose a grant from the list to see it here.</p>
            )}
          </div>
        </div>
      </section>

      <section className="command-grid">
        <div className="station-panel mission-control">
          <PanelTitle icon={Radar} title="Have a grant link already?" action={isRunning ? "Working" : "Ready"} />
          <div className="target-row">
            <input
              value={grantUrl}
              onChange={(event) => setGrantUrl(event.target.value)}
              placeholder="Paste the grant website link here"
              aria-label="Grant URL"
            />
            <button className="primary-button" onClick={() => runGrant()} disabled={isRunning}>
              {isRunning ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              Start Draft
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
          <PanelTitle icon={Activity} title="Grant Fit Score" action={activeReport ? activeReport.grant.status : "Not started"} />
          <div className="score-orbit">
            <div>
              <span>Fit Score</span>
              <strong>{activeReport?.score.total ?? "--"}</strong>
              <small>/100</small>
            </div>
          </div>
          <div className="breakdown-list">
            {Object.entries(activeReport?.score.breakdown ?? {}).map(([key, value]) => (
              <div className="meter-row" key={key}>
                <span>{formatStep(key)}</span>
                <div><i style={{ width: `${Math.min(100, value / (key === "mission_fit" || key === "eligibility_fit" ? 25 : key === "funding_use_fit" ? 20 : 10) * 100)}%` }} /></div>
                <b>{value}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="work-grid">
        <div className="station-panel profile-panel">
          <PanelTitle icon={UserCog} title="Company Profile" action="Saved details" />
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
          <div className="profile-guidance">
            <h3>Profile suggestions</h3>
            <p>Generated from the details already entered. Treat these as prompts, not facts; only save what is true.</p>
            <ul>{getProfileCompletionSuggestions(profile).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <button className="secondary-button" onClick={resetProfile}>
            <RotateCcw size={17} />
            Clear Profile
          </button>
          <button className="primary-button" onClick={saveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}
            {isSavingProfile ? "Saving" : "Save Profile"}
          </button>
        </div>

        <div className="station-panel reports-panel">
          <PanelTitle icon={HardDrive} title="Grants We Checked" action={`${reports.length} saved`} />
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
                <small>{formatStep(report.grant.status)} · {formatStep(report.score.next_step)}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="intel-grid">
        <div className="station-panel detail-panel">
          <PanelTitle icon={ServerCog} title="Notes About This Grant" action={activeReport ? "Ready" : "Pick a grant"} />
          {activeReport ? (
            <div className="intel-body">
              <h2>{displayGrantTitle(activeReport.grant.title, activeReport.grant.url)}</h2>
              <a href={activeReport.grant.url} target="_blank" rel="noreferrer">Open official grant page</a>
              {(activeReport.grant.funder || activeReport.grant.deadline || activeReport.grant.funding_amount || activeReport.grant.eligibility_summary || activeReport.grant.focus_areas.length > 0) && (
                <div className="grant-facts">
                  {activeReport.grant.funder && <p><strong>Funder:</strong> {activeReport.grant.funder}</p>}
                  {activeReport.grant.deadline && <p><strong>Deadline:</strong> {activeReport.grant.deadline}</p>}
                  {activeReport.grant.funding_amount != null && <p><strong>Funding:</strong> {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(activeReport.grant.funding_amount)}</p>}
                  {activeReport.grant.eligibility_summary && <p><strong>Eligibility:</strong> {activeReport.grant.eligibility_summary}</p>}
                  {activeReport.grant.focus_areas.length > 0 && <p><strong>Grant priorities:</strong> {activeReport.grant.focus_areas.join(", ")}</p>}
                </div>
              )}
              {activeReport.grant.extraction_notes.length > 0 && <><h3>Page-reading notes</h3><ul>{activeReport.grant.extraction_notes.map((note) => <li key={note}>{note}</li>)}</ul></>}
              <div className="intel-stats">
                <StatusTile icon={SlidersHorizontal} label="Effort" value={activeReport.grant.estimated_effort} />
                <StatusTile icon={CheckCircle2} label="Next step" value={formatStep(activeReport.score.next_step)} />
                <StatusTile icon={ListChecks} label="Questions" value={String(activeReport.grant.application_questions.length)} />
              </div>
              <h3>Why it got this score</h3>
              <ul>
                {activeReport.score.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              {activeReport.score.disqualifiers.length > 0 && (
                <>
                  <h3>Possible problems</h3>
                  <ul>
                    {activeReport.score.disqualifiers.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </>
              )}
              <h3>Profile details to verify</h3>
              <p>Only add information that is accurate for Abena. Profile changes cannot make an ineligible grant eligible.</p>
              <ul>{profileSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
              <div className="review-actions">
                <button className="secondary-button" onClick={() => loadDraft()}>
                  <ClipboardCheck size={17} />
                  Open Draft
                </button>
                <button
                  className="danger-button"
                  onClick={archiveActiveGrant}
                  disabled={isArchiving || activeReport.grant.status === "archived"}
                >
                  {isArchiving ? <Loader2 className="spin" size={17} /> : <HardDrive size={17} />}
                  {activeReport.grant.status === "archived" ? "Already Archived" : "Archive Grant"}
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-state">Choose a grant and start a draft to see notes here.</p>
          )}
        </div>

        <div className="station-panel draft-panel">
          <PanelTitle icon={Bot} title="Application Draft" action={draft ? "Not submitted" : "Waiting for grant"} />
          <pre>{draft || "When a grant is a good fit, the first draft will appear here. You can read it, copy it, and make changes before anything is submitted."}</pre>
        </div>
      </section>
    </main>
    {isLoadingOverlayActive && <GrantLoadingOverlay title={loadingTitle} />}
    </>
  );
}

function GrantLoadingOverlay({ title }: { title: string }) {
  return (
    <div className="grant-loading-overlay" role="status" aria-live="polite" aria-label={title}>
      <div className="loader-card">
        <div className="loader-showcase" aria-hidden="true">
          <span className="loader-orbit" />
          <img src="/images/loaders/polar-bear-loader.webp" alt="" />
        </div>
        <div className="loader-copy">
          <Loader2 className="spin" size={20} aria-hidden="true" />
          <div>
            <strong>{title}</strong>
            <p>Please wait a moment.</p>
          </div>
        </div>
      </div>
    </div>
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

function displayGrantTitle(title: string, url: string) {
  const cleaned = title.replace(/^\s*!?\[[^\]]*\]\([^)]*\)\s*/g, "").replace(/^\s*#+\s*/, "").trim();
  if (cleaned && !/^\[?(skip to|menu|main content)/i.test(cleaned) && cleaned.length < 180) return cleaned;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Grant opportunity"; }
}

function getProfileCompletionSuggestions(profile: FounderProfile) {
  const customers = profile.target_customers.length ? profile.target_customers.join(", ") : "the people Abena serves";
  const focus = profile.focus_areas.length ? profile.focus_areas.join(", ") : profile.industry || "the problem Abena solves";
  const suggestions: string[] = [];
  if (!profile.business_stage.trim()) suggestions.push(`Choose the accurate stage for ${profile.name || "the company"} (for example, pilot, early revenue, or scaling) and add one sentence of evidence.`);
  if (!profile.funding_needs.length) suggestions.push(`Based on ${profile.industry || "the company's focus"}, consider whether product development, provider onboarding, or compliance-workflow improvements are real funding needs for ${customers}. Add only confirmed uses.`);
  if (!profile.target_customers.length) suggestions.push(`Name the specific buyer or user for ${focus}; this helps distinguish childcare providers, families, and public schools.`);
  if (!profile.eligible_locations.length) suggestions.push("Add the states where the company operates or will deliver the funded project; use only confirmed locations.");
  if (!profile.focus_areas.length) suggestions.push(`Use the industry already entered (${profile.industry || "not specified"}) to name 2-4 specific problems the product addresses, rather than broad adjacent sectors.`);
  suggestions.push(`Founder story starter: ${profile.name || "[Company]"} helps ${customers} with ${focus} so they can [verified outcome]. Fill the bracket with an outcome you can support.`);
  return suggestions;
}

function getProfileSuggestions(report: WorkflowResult, profile: FounderProfile) {
  const suggestions: string[] = [];
  const breakdown = report.score.breakdown;
  if ((breakdown.mission_fit ?? 0) < 15) suggestions.push(profile.focus_areas.length ? "Mission fit is low. Keep Abena\u0027s childcare and early-learning focus accurate; pursue this grant only if the funded project directly serves those priorities." : "Add Abena\u0027s verified childcare and early-learning focus areas to the profile.");
  if ((breakdown.eligibility_fit ?? 0) < 15) suggestions.push("Check the official eligibility rules and record Abena\u0027s actual legal entity and applicant status; do not change the entity type just to raise the score.");
  if ((breakdown.funding_use_fit ?? 0) < 15) suggestions.push(profile.funding_needs.length ? "Compare the real planned use of funds with the funder\u0027s allowed uses and describe any direct match precisely." : "List specific, current uses Abena would fund only if they are genuine, then compare them with this grant\u0027s allowed uses.");
  if ((breakdown.geographic_fit ?? 0) < 7) suggestions.push("Confirm Abena\u0027s actual operating/service locations and whether the funder accepts applicants or projects there.");
  if ((breakdown.stage_fit ?? 0) < 7) suggestions.push(profile.business_stage ? `Verify that the saved stage (${profile.business_stage}) matches the stage this grant funds.` : "Add Abena\u0027s current business stage and compare it with the grant\u0027s stated stage requirements.");
  if ((breakdown.application_effort ?? 0) < 7) suggestions.push("Effort fit is based on the application burden, not the founder profile; review the official application and deadline before deciding.");
  return suggestions;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      error:
        text.trim() ||
        "Find Grants could not run. Please check that Firecrawl is connected on the server."
    };
  }
}
