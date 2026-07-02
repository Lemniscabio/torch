import type { ProcessInputs, PartialAssessmentResult, RiskScore, Confidence } from "@torch/core-shared";

// ─── Design tokens ───────────────────────────────────────────────────────────

const INK_900 = "#0a0a0a";
const INK_700 = "#404040";
const INK_500 = "#737373";
const INK_400 = "#a3a3a3";
const INK_300 = "#bcbcbc";
const INK_200 = "#d4d4d4";
const INK_100 = "#e5e5e5";
const SURFACE = "#fafafa";
const FLAME   = "#ff5a1f";

const RISK_FG: Record<RiskScore, string> = {
  low:      "#15803d",
  moderate: "#b45309",
  high:     "#c2410c",
  critical: "#b91c1c",
};
const RISK_BG: Record<RiskScore, string> = {
  low:      "#f0fdf4",
  moderate: "#fffbeb",
  high:     "#fff7ed",
  critical: "#fef2f2",
};
const RISK_BORDER: Record<RiskScore, string> = {
  low:      "#bbf7d0",
  moderate: "#fde68a",
  high:     "#fed7aa",
  critical: "#fecaca",
};
const RISK_DISTANCE: Record<RiskScore, number> = {
  low: 0.20, moderate: 0.45, high: 0.72, critical: 0.95,
};
const RISK_LABEL: Record<RiskScore, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
};
const CONF_LABEL: Record<Confidence, string> = {
  high_confidence: "High confidence",
  reliable: "Reliable",
  directional: "Directional",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined, digits = 1, unit = ""): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function fmtScore(n: number | undefined, std: number | undefined, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const base = n.toFixed(digits);
  if (std === undefined || !Number.isFinite(std) || std <= 0) return base;
  return `${base} ± ${std.toFixed(digits)}`;
}

function fmtAuto(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100) return Math.round(n).toLocaleString("en-US");
  if (abs >= 10)  return Math.round(n).toString();
  if (abs >= 1)   return n.toFixed(1);
  return n.toFixed(2);
}

function rangeAuto(lo: number | undefined, hi: number | undefined): string {
  if (lo === undefined || hi === undefined) return "—";
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "—";
  const l = fmtAuto(lo), h = fmtAuto(hi);
  return l === h ? l : `${l} – ${h}`;
}

function midNumber(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  if (a > 0 && b > 0) return Math.sqrt(a * b);
  return (a + b) / 2;
}

function speciesLabel(s: string): string {
  const map: Record<string, string> = {
    e_coli: "Escherichia coli",
    b_subtilis: "Bacillus subtilis",
    s_cerevisiae: "Saccharomyces cerevisiae",
    p_pastoris: "Pichia pastoris",
    other_bacteria: "Bacteria (unspecified)",
    other_yeast: "Yeast (unspecified)",
  };
  return map[s] ?? s;
}

function speciesShort(s: string): string {
  const map: Record<string, string> = {
    e_coli: "E. coli",
    b_subtilis: "B. subtilis",
    s_cerevisiae: "S. cerevisiae",
    p_pastoris: "P. pastoris",
    other_bacteria: "Other bacteria",
    other_yeast: "Other yeast",
  };
  return map[s] ?? s;
}

function scaleCriterionLabel(c: string | undefined): string {
  switch (c ?? "power_per_volume") {
    case "kla":   return "kLa";
    case "shear": return "Tip speed";
    default:      return "Power per volume";
  }
}

// ─── UI primitives ───────────────────────────────────────────────────────────

function pill(score: RiskScore): string {
  return `<span class="pill" style="background:${RISK_BG[score]};color:${RISK_FG[score]};border-color:${RISK_BORDER[score]}">${RISK_LABEL[score]}</span>`;
}

function eyebrow(text: string): string {
  return `<p class="eyebrow">${text}</p>`;
}

// ─── Radar SVG ───────────────────────────────────────────────────────────────

function radarSvg(scores: Record<string, RiskScore>, size = 220): string {
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) * 0.65;
  const lR = r + 20;
  const domains = ["mixing", "otr", "shear", "co2", "heat"];
  const letters = ["M", "O", "S", "C", "H"];
  const angles = domains.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  const gridRings = [0.25, 0.5, 0.75, 1.0].map((d, i) => {
    const pts = angles.map(a => `${(cx + d * r * Math.cos(a)).toFixed(2)},${(cy + d * r * Math.sin(a)).toFixed(2)}`).join(" ");
    return `<polygon points="${pts}" fill="${i === 3 ? "transparent" : "transparent"}" stroke="${INK_100}" stroke-width="0.75"/>`;
  }).join("");

  const axes = angles.map(a =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.cos(a)).toFixed(2)}" y2="${(cy + r * Math.sin(a)).toFixed(2)}" stroke="${INK_100}" stroke-width="0.75"/>`
  ).join("");

  const scorePoints = domains.map((d, i) => {
    const dist = RISK_DISTANCE[scores[d] ?? "low"];
    return `${(cx + dist * r * Math.cos(angles[i])).toFixed(2)},${(cy + dist * r * Math.sin(angles[i])).toFixed(2)}`;
  }).join(" ");

  const dots = domains.map((d, i) => {
    const dist = RISK_DISTANCE[scores[d] ?? "low"];
    const x = (cx + dist * r * Math.cos(angles[i])).toFixed(2);
    const y = (cy + dist * r * Math.sin(angles[i])).toFixed(2);
    const color = RISK_FG[scores[d] ?? "low"];
    return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#ffffff" stroke-width="2"/>`;
  }).join("");

  const labels = angles.map((a, i) => {
    const x = (cx + lR * Math.cos(a)).toFixed(2);
    const y = (cy + lR * Math.sin(a) + 4).toFixed(2);
    const score = scores[domains[i]] ?? "low";
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="inherit" font-size="11" font-weight="700" fill="${RISK_FG[score]}">${letters[i]}</text>`;
  }).join("");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${gridRings}${axes}
    <polygon points="${scorePoints}" fill="${FLAME}" fill-opacity="0.10" stroke="${FLAME}" stroke-width="1.5"/>
    ${dots}${labels}
  </svg>`;
}

// ─── Cover page ──────────────────────────────────────────────────────────────

function coverPage(inputs: ProcessInputs, date: string): string {
  const scaleRatio = (inputs.v_target / inputs.v_lab).toFixed(0);
  return `
  <section class="cover">
    <div class="cover-top">
      <span class="wordmark">LEMNISCA <span class="dot">·</span> TORCH</span>
    </div>

    <div class="cover-middle">
      <p class="cover-eyebrow">Scale-Up Risk Assessment</p>
      <h1 class="cover-title">MOSCH<span class="cover-title-dot">.</span></h1>
      <p class="cover-subtitle">Mixing · Oxygen · Shear · CO<sub>2</sub> · Heat</p>
    </div>

    <div class="cover-data">
      <div class="cover-data-row">
        <span class="cover-data-label">Organism</span>
        <span class="cover-data-value">${speciesLabel(inputs.organism_species)}</span>
      </div>
      <div class="cover-data-row">
        <span class="cover-data-label">Scale</span>
        <span class="cover-data-value">${fmt(inputs.v_lab, 0)} L <span class="arrow">→</span> ${fmt(inputs.v_target, 0)} L <span class="muted">(${scaleRatio}×)</span></span>
      </div>
      <div class="cover-data-row">
        <span class="cover-data-label">Criterion</span>
        <span class="cover-data-value">${scaleCriterionLabel(inputs.scaleup_criterion)}</span>
      </div>
      <div class="cover-data-row">
        <span class="cover-data-label">Process</span>
        <span class="cover-data-value">${inputs.process_type === "fed_batch" ? "Fed-batch" : "Batch"}</span>
      </div>
    </div>

    <div class="cover-bottom">
      <div class="cover-bottom-row">
        <span class="cover-bottom-label">Generated</span>
        <span class="cover-bottom-value">${date}</span>
      </div>
      <div class="cover-bottom-row">
        <span class="cover-bottom-label">torch.lemnisca.bio</span>
        <span class="cover-bottom-value">Confidential — for engineering use</span>
      </div>
    </div>
  </section>`;
}

// ─── Page 2: Executive Summary ───────────────────────────────────────────────

function summaryPage(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  const bn = r.primary_bottleneck;
  const rc = r.reactor_configs;

  const labScores: Record<string, RiskScore> = {
    mixing: r.mixing.score_lab ?? r.mixing.score,
    otr:    r.otr.score_lab,
    shear:  r.shear.score_lab,
    co2:    r.co2.lab?.score ?? r.co2.score,
    heat:   r.heat.lab?.score ?? r.heat.score,
  };
  const targetScores: Record<string, RiskScore> = {
    mixing: r.mixing.score_target ?? r.mixing.score,
    otr:    r.otr.score_target,
    shear:  r.shear.score_target,
    co2:    r.co2.target?.score ?? r.co2.score,
    heat:   r.heat.target?.score ?? r.heat.score,
  };

  type Row = { letter: string; name: string; score: RiskScore; metric: string };
  const rows: Row[] = [
    { letter: "M", name: "Mixing",          score: r.mixing.score, metric: `Score ${fmt(r.mixing.process_mixing_ratio_target, 1)}` },
    { letter: "O", name: "Oxygen Transfer", score: r.otr.score,    metric: `OTR/OUR ${fmt(r.otr.otr_our_ratio_target ?? r.otr.kla_ratio, 2)}` },
    { letter: "S", name: "Shear Stress",    score: r.shear.score,  metric: `v_threshold/v_tip ${fmt(r.shear.tip_speed_margin, 1)}` },
    { letter: "C", name: "CO<sub>2</sub> Accumulation",score: r.co2.score,    metric: r.co2.activated ? `Score ${fmt(r.co2.target?.pco2_margin ?? r.co2.pco2_margin, 1)}` : "Not activated" },
    { letter: "H", name: "Heat Removal",    score: r.heat.score,   metric: `Score ${fmt(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, 1)}` },
  ];

  const domainRows = rows.map(row => `
    <tr class="no-break">
      <td class="domain-letter">
        <span class="letter-mark" style="color:${RISK_FG[row.score]};background:${RISK_BG[row.score]};border-color:${RISK_BORDER[row.score]}">${row.letter}</span>
      </td>
      <td class="domain-name">${row.name}</td>
      <td class="domain-metric">${row.metric}</td>
      <td class="domain-score">${pill(row.score)}</td>
    </tr>`).join("");

  return `
  <section class="section">
    ${runningHead(inputs)}

    ${eyebrow("Section 01 · Executive Summary")}
    <h2 class="display-2">At a glance</h2>

    <div class="grid-two no-break" style="margin-top:32px">
      <div class="callout">
        ${eyebrow("Primary Bottleneck")}
        <p class="callout-body">${bn.domain ? bn.statement : "No domain reaches the moderate threshold at target scale."}</p>
      </div>
      <div class="callout">
        ${eyebrow("Operating Configuration at Target")}
        <ul class="kv-list">
          <li><span>Criterion</span><strong>${scaleCriterionLabel(inputs.scaleup_criterion)}</strong></li>
          <li><span>Impeller RPM</span><strong>${fmtAuto(rc?.target.rpm)}</strong></li>
          <li><span>Aeration</span><strong>${fmt(rc?.target.vvm, 2)} vvm</strong></li>
          <li><span>P/V</span><strong>${fmtAuto(rc?.target.pv_w_m3)} W/m³</strong></li>
        </ul>
      </div>
    </div>

    <div class="section-block no-break" style="margin-top:36px">
      ${eyebrow("Five Risk Domains")}
      <table class="domain-table">
        ${domainRows}
      </table>
    </div>

    <div class="grid-two no-break" style="margin-top:36px">
      <div class="radar-card">
        ${eyebrow("Lab Scale Risk Profile")}
        ${radarSvg(labScores, 200)}
      </div>
      <div class="radar-card">
        ${eyebrow("Target Scale Risk Profile")}
        ${radarSvg(targetScores, 200)}
      </div>
    </div>

  </section>`;
}

// ─── Domain detail blocks ────────────────────────────────────────────────────

type DomainSpec = {
  letter: string;
  name: string;
  score: RiskScore;
  confidence: Confidence;
  driver: string;
  question: string;
  formula: string;
  thresholds: { label: RiskScore; range: string }[];
  labValue: string;
  labScore: RiskScore;
  targetValue: string;
  targetScore: RiskScore;
  metrics: { label: string; value: string }[];
};

function domainBlock(d: DomainSpec): string {
  const thresholdScale = d.thresholds.map(t => `
    <div class="thresh-cell" style="background:${RISK_BG[t.label]};border-color:${RISK_BORDER[t.label]}">
      <span class="thresh-label" style="color:${RISK_FG[t.label]}">${RISK_LABEL[t.label]}</span>
      <span class="thresh-range">${t.range}</span>
    </div>`).join("");

  const metricsInline = d.metrics
    .map(m => `<span class="m-label">${m.label}</span> <span class="m-value">${m.value}</span>`)
    .join(`<span class="m-sep">·</span>`);

  return `
  <article class="domain-block no-break">
    <header class="domain-head">
      <span class="domain-letter-lg" style="color:${RISK_FG[d.score]};background:${RISK_BG[d.score]};border-color:${RISK_BORDER[d.score]}">${d.letter}</span>
      <div class="domain-id-text">
        <h3 class="domain-title">${d.name}</h3>
        <p class="domain-q">${d.question}</p>
      </div>
      <div class="domain-score-cell">
        ${pill(d.score)}
        <span class="domain-formula">Score = ${d.formula}</span>
      </div>
    </header>

    <div class="score-row">
      <div class="score-cell">
        <span class="score-tag">Lab</span>
        <span class="score-num">${d.labValue}</span>
        ${pill(d.labScore)}
      </div>
      <div class="score-cell">
        <span class="score-tag">Target</span>
        <span class="score-num">${d.targetValue}</span>
        ${pill(d.targetScore)}
      </div>
    </div>

    <div class="thresh-row">${thresholdScale}</div>

    <p class="metrics-inline">${metricsInline}</p>
  </article>`;
}

function buildDomainSpecs(r: PartialAssessmentResult): DomainSpec[] {
  const ratioLabOtr = r.otr.otr_our_ratio_lab  ?? r.otr.kla_ratio;
  const ratioTgtOtr = r.otr.otr_our_ratio_target ?? r.otr.kla_ratio;
  const co2LabMargin = r.co2.lab?.pco2_margin;
  const co2TgtMargin = r.co2.target?.pco2_margin ?? r.co2.pco2_margin;

  return [
    {
      letter: "M", name: "Mixing", score: r.mixing.score,
      confidence: r.mixing.confidence, driver: r.mixing.driver,
      question: "Is mixing fast enough to dissipate substrate and pH gradients?",
      formula: "τ_required / τ_mixing",
      thresholds: [
        { label: "low", range: "> 10" },
        { label: "moderate", range: "1 – 10" },
        { label: "high", range: "0.1 – 1" },
        { label: "critical", range: "< 0.1" },
      ],
      labValue: fmtScore(r.mixing.process_mixing_ratio_lab, r.mixing.process_mixing_ratio_lab_std, 1),
      labScore: r.mixing.score_lab ?? r.mixing.score,
      targetValue: fmtScore(r.mixing.process_mixing_ratio_target, r.mixing.process_mixing_ratio_target_std, 1),
      targetScore: r.mixing.score_target ?? r.mixing.score,
      metrics: [
        { label: "Mixing time — lab",    value: fmt(r.mixing.theta_mix_lab, 1, "s") },
        { label: "Mixing time — target", value: fmt(r.mixing.theta_mix_target, 1, "s") },
        { label: "Process timescale",    value: fmt(r.mixing.t_process_target_s, 1, "s") },
      ],
    },
    {
      letter: "O", name: "Oxygen Transfer", score: r.otr.score,
      confidence: r.otr.confidence, driver: r.otr.driver,
      question: "Can the reactor deliver sufficient oxygen to meet cell demand?",
      formula: "OTR / OUR",
      thresholds: [
        { label: "low", range: "> 1.5" },
        { label: "moderate", range: "1.0 – 1.5" },
        { label: "high", range: "0.7 – 1.0" },
        { label: "critical", range: "< 0.7" },
      ],
      labValue: fmtScore(ratioLabOtr, r.otr.otr_our_ratio_lab_std, 1),
      labScore: r.otr.score_lab,
      targetValue: fmtScore(ratioTgtOtr, r.otr.otr_our_ratio_target_std, 1),
      targetScore: r.otr.score_target,
      metrics: [
        { label: "kLa achievable — target", value: fmt(r.otr.kla_target_moderate, 1, "h⁻¹") },
        { label: "kLa required",            value: fmt(r.otr.kla_required, 1, "h⁻¹") },
        { label: "P/V — target",            value: fmt(r.otr.pv_target, 0, "W/m³") },
      ],
    },
    {
      letter: "S", name: "Shear Stress", score: r.shear.score,
      confidence: r.shear.confidence, driver: r.shear.driver,
      question: "Is tip speed low enough to protect cells from hydrodynamic damage?",
      formula: "v_threshold / v_tip",
      thresholds: [
        { label: "low", range: "> 1.43" },
        { label: "moderate", range: "1.0 – 1.43" },
        { label: "high", range: "0.77 – 1.0" },
        { label: "critical", range: "< 0.77" },
      ],
      labValue: fmtScore(r.shear.tip_speed_margin_lab, r.shear.tip_speed_margin_lab_std, 1),
      labScore: r.shear.score_lab,
      targetValue: fmtScore(r.shear.tip_speed_margin, r.shear.tip_speed_margin_std, 1),
      targetScore: r.shear.score_target,
      metrics: [
        { label: "Tip speed — lab",    value: fmt(r.shear.tip_speed_lab, 2, "m/s") },
        { label: "Tip speed — target", value: fmt(r.shear.tip_speed, 2, "m/s") },
        { label: "Threshold",          value: fmt(r.shear.tip_speed_threshold, 2, "m/s") },
      ],
    },
    {
      letter: "C", name: "CO<sub>2</sub> Accumulation", score: r.co2.score,
      confidence: r.co2.confidence, driver: r.co2.driver,
      question: "Is dissolved CO<sub>2</sub> low enough to avoid toxicity?",
      formula: "P_CO<sub>2</sub>_threshold / P_CO<sub>2</sub>_reactor",
      thresholds: [
        { label: "low", range: "> 1.5" },
        { label: "moderate", range: "1.0 – 1.5" },
        { label: "high", range: "0.75 – 1.0" },
        { label: "critical", range: "< 0.75" },
      ],
      labValue: r.co2.activated ? fmtScore(co2LabMargin, undefined, 1) : "n/a",
      labScore: r.co2.lab?.score ?? r.co2.score,
      targetValue: r.co2.activated ? fmtScore(co2TgtMargin, r.co2.pco2_margin_std, 1) : "n/a",
      targetScore: r.co2.target?.score ?? r.co2.score,
      metrics: r.co2.activated
        ? [
            { label: "pCO<sub>2</sub> — lab",    value: fmt(r.co2.lab?.pco2_bottom, 3, "bar") },
            { label: "pCO<sub>2</sub> — target", value: fmt(r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom, 3, "bar") },
            { label: "Threshold",     value: fmt(r.co2.pco2_critical, 3, "bar") },
          ]
        : [{ label: "Status", value: "Not activated — OUR below CO<sub>2</sub> stripping limit" }],
    },
    {
      letter: "H", name: "Heat Removal", score: r.heat.score,
      confidence: r.heat.confidence, driver: r.heat.driver,
      question: "Can the jacket withdraw all metabolic heat at target scale?",
      formula: "Q_cooling / Q_metabolic",
      thresholds: [
        { label: "low", range: "> 1.67" },
        { label: "moderate", range: "1.18 – 1.67" },
        { label: "high", range: "1.0 – 1.18" },
        { label: "critical", range: "< 1.0" },
      ],
      labValue: fmt(r.heat.lab?.heat_transfer_margin, 1),
      labScore: r.heat.lab?.score ?? r.heat.score,
      targetValue: fmtScore(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, r.heat.heat_transfer_margin_std, 1),
      targetScore: r.heat.target?.score ?? r.heat.score,
      metrics: [
        { label: "Metabolic heat — target", value: fmt(r.heat.target?.q_metabolic ?? r.heat.q_metabolic, 1, "kW") },
        { label: "Impeller heat — target",  value: fmt(r.heat.target?.q_impeller ?? r.heat.q_impeller, 1, "kW") },
        { label: "Total heat generation",   value: fmt(r.heat.target?.q_generated ?? r.heat.q_generated, 1, "kW") },
        { label: "Cooling capacity",        value: fmt(r.heat.q_cool_max, 1, "kW") },
        { label: "Jacket area",             value: fmt(r.heat.a_jacket, 2, "m²") },
      ],
    },
  ];
}

function domainsSection(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  const specs = buildDomainSpecs(r);
  return `
  <section class="section break-before">
    ${runningHead(inputs)}
    ${eyebrow("Section 02 · Risk Detail")}
    <h2 class="display-2">Five domains, in detail</h2>
    <p class="lede">Each domain is scored independently at lab and target scale. The score is a margin: values above 1.0 indicate the reactor exceeds the threshold; values below 1.0 do not.</p>

    <div class="domain-list">
      ${specs.map(domainBlock).join("")}
    </div>

  </section>`;
}

// ─── Projections page ────────────────────────────────────────────────────────

function projectionsSection(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  const rc = r.reactor_configs;
  const pilotVolume = Math.sqrt(inputs.v_lab * inputs.v_target);
  const labAeration = inputs.vvm * inputs.v_lab;
  const targetAeration = (rc?.target.vvm ?? inputs.vvm) * inputs.v_target;
  const labPco2 = r.co2.activated ? r.co2.lab?.pco2_bottom : undefined;
  const targetPco2 = r.co2.activated ? (r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom) : undefined;

  const rows: { label: string; lab: string; pilot: string; target: string }[] = [
    {
      label: "Impeller RPM (rpm)",
      lab: fmtAuto(rc?.lab.rpm),
      pilot: fmtAuto(midNumber(rc?.lab.rpm, rc?.target.rpm)),
      target: fmtAuto(rc?.target.rpm),
    },
    {
      label: "Aeration rate (L/min · vvm)",
      lab: `${fmtAuto(labAeration)} · ${fmtAuto(inputs.vvm)}`,
      pilot: `${fmtAuto(midNumber(labAeration, targetAeration))} · ${fmtAuto(midNumber(inputs.vvm, rc?.target.vvm))}`,
      target: `${fmtAuto(targetAeration)} · ${fmtAuto(rc?.target.vvm)}`,
    },
    {
      label: "Impeller diameter (m)",
      lab: fmtAuto(rc?.lab.geometry.d_imp),
      pilot: fmtAuto(midNumber(rc?.lab.geometry.d_imp, rc?.target.geometry.d_imp)),
      target: fmtAuto(rc?.target.geometry.d_imp),
    },
    {
      label: "Reactor height (m)",
      lab: fmtAuto(rc?.lab.geometry.h_liquid),
      pilot: fmtAuto(midNumber(rc?.lab.geometry.h_liquid, rc?.target.geometry.h_liquid)),
      target: fmtAuto(rc?.target.geometry.h_liquid),
    },
    {
      label: "kLa achievable (h⁻¹)",
      lab: rc ? rangeAuto(rc.lab.kla_ensemble.min, rc.lab.kla_ensemble.max) : "—",
      pilot: rc ? rangeAuto(midNumber(rc.lab.kla_ensemble.min, rc.target.kla_ensemble.min), midNumber(rc.lab.kla_ensemble.max, rc.target.kla_ensemble.max)) : "—",
      target: rc ? rangeAuto(rc.target.kla_ensemble.min, rc.target.kla_ensemble.max) : "—",
    },
    {
      label: "Mixing time (s)",
      lab: rangeAuto(r.mixing.theta_mix_lab_min ?? r.mixing.theta_mix_lab, r.mixing.theta_mix_lab_max ?? r.mixing.theta_mix_lab),
      pilot: rangeAuto(midNumber(r.mixing.theta_mix_lab_min, r.mixing.theta_mix_target_min), midNumber(r.mixing.theta_mix_lab_max, r.mixing.theta_mix_target_max)),
      target: rangeAuto(r.mixing.theta_mix_target_min ?? r.mixing.theta_mix_target, r.mixing.theta_mix_target_max ?? r.mixing.theta_mix_target),
    },
    {
      label: "Tip speed (m/s)",
      lab: fmtAuto(r.shear.tip_speed_lab),
      pilot: fmtAuto(midNumber(r.shear.tip_speed_lab, r.shear.tip_speed)),
      target: fmtAuto(r.shear.tip_speed),
    },
    {
      label: "pCO<sub>2</sub> at bottom (bar)",
      lab: fmtAuto(labPco2),
      pilot: fmtAuto(midNumber(labPco2, targetPco2)),
      target: fmtAuto(targetPco2),
    },
    {
      label: "Heat generation (kW)",
      lab: fmtAuto(r.heat.lab?.q_generated),
      pilot: fmtAuto(midNumber(r.heat.lab?.q_generated, r.heat.target?.q_generated ?? r.heat.q_generated)),
      target: fmtAuto(r.heat.target?.q_generated ?? r.heat.q_generated),
    },
    {
      label: "Cooling capacity (kW)",
      lab: fmtAuto(r.heat.lab?.q_cool_max),
      pilot: fmtAuto(midNumber(r.heat.lab?.q_cool_max, r.heat.target?.q_cool_max ?? r.heat.q_cool_max)),
      target: fmtAuto(r.heat.target?.q_cool_max ?? r.heat.q_cool_max),
    },
  ];

  const body = rows.map((row, i) => `
    <tr class="${i % 2 === 1 ? "alt" : ""}">
      <td class="proj-label">${row.label}</td>
      <td class="proj-num">${row.lab}</td>
      <td class="proj-num muted">${row.pilot}</td>
      <td class="proj-num">${row.target}</td>
    </tr>`).join("");

  return `
  <section class="section break-before">
    ${runningHead(inputs)}
    ${eyebrow("Section 03 · Scale-Up Projections")}
    <h2 class="display-2">Lab to Production</h2>
    <p class="lede">Pilot column is the geometric midpoint — a useful interpolation between the two engine-computed scales.</p>

    <table class="proj-table no-break">
      <thead>
        <tr>
          <th class="proj-th">Quantity</th>
          <th class="proj-th right">Lab — ${fmt(inputs.v_lab, 0)} L</th>
          <th class="proj-th right muted">Pilot — ${fmtAuto(pilotVolume)} L</th>
          <th class="proj-th right">Production — ${fmt(inputs.v_target, 0)} L</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>

    ${platformFooter()}
  </section>`;
}

// ─── Platform footer block (appended to projections page) ───────────────────

function platformFooter(): string {
  return `
    <div class="platform no-break" style="margin-top:36px">
      ${eyebrow("Lemnisca Platform")}
      <div class="platform-grid">
        <div class="platform-card">
          <p class="platform-name">lemnisca.bio</p>
          <p class="platform-desc">Platform home</p>
          <p class="platform-url">https://www.lemnisca.bio</p>
        </div>
        <div class="platform-card">
          <p class="platform-name">Tune</p>
          <p class="platform-desc">Bioprocess optimisation</p>
          <p class="platform-url">https://www.lemnisca.bio/tune</p>
        </div>
        <div class="platform-card">
          <p class="platform-name">Thrust</p>
          <p class="platform-desc">Bioreactor design</p>
          <p class="platform-url">https://www.lemnisca.bio/thrust</p>
        </div>
      </div>
    </div>`;
}

// ─── Page chrome ─────────────────────────────────────────────────────────────

function runningHead(inputs: ProcessInputs): string {
  return `
  <div class="run-head">
    <span class="run-head-mark">LEMNISCA <span class="dot">·</span> TORCH</span>
    <span class="run-head-meta">${speciesShort(inputs.organism_species)} · ${fmt(inputs.v_lab, 0)}L → ${fmt(inputs.v_target, 0)}L</span>
  </div>`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildReportHtml(inputs: ProcessInputs, results: PartialAssessmentResult): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const title = `MOSCH Report — ${speciesShort(inputs.organism_species)} ${fmt(inputs.v_lab, 0)}→${fmt(inputs.v_target, 0)} L`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
/* ─── Print page setup ───────────────────────────────────────────────────── */
@page {
  size: A4;
  margin: 18mm 18mm 22mm 18mm;
}
@page :first {
  margin: 0;
}

/* ─── Reset & body ──────────────────────────────────────────────────────── */
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: ${INK_900};
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-feature-settings: "ss01", "cv11";
}

/* ─── Page-break utilities ──────────────────────────────────────────────── */
.break-before { page-break-before: always; break-before: page; }
.no-break { page-break-inside: avoid; break-inside: avoid; }

/* ─── Subscripts / superscripts ─────────────────────────────────────────── */
sub, sup { font-size: 0.72em; line-height: 0; position: relative; vertical-align: baseline; }
sub { top: 0.32em; }
sup { top: -0.45em; }

/* ─── Typography ────────────────────────────────────────────────────────── */
.display-2 {
  font-size: 30px;
  line-height: 1.12;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: ${INK_900};
  margin-bottom: 8px;
}
.lede {
  font-size: 12px;
  line-height: 1.6;
  color: ${INK_500};
  margin-top: 6px;
  max-width: 540px;
}
.eyebrow {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${INK_400};
  margin-bottom: 10px;
}

/* ─── Running head & foot ───────────────────────────────────────────────── */
.run-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 10px;
  border-bottom: 0.75px solid ${INK_100};
  margin-bottom: 28px;
}
.run-head-mark {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.10em;
  color: ${INK_900};
}
.run-head-mark .dot { color: ${FLAME}; margin: 0 4px; }
.run-head-meta {
  font-size: 10px;
  color: ${INK_400};
  font-variant-numeric: tabular-nums;
}

/* ─── Cover ─────────────────────────────────────────────────────────────── */
.cover {
  width: 210mm;
  height: 297mm;
  padding: 26mm 22mm 22mm 22mm;
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
  position: relative;
  background: #ffffff;
}
.cover-top { display: flex; justify-content: space-between; align-items: baseline; }
.wordmark {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: ${INK_900};
}
.wordmark .dot { color: ${FLAME}; margin: 0 6px; }

.cover-middle {
  margin-top: 42mm;
  flex: 0 0 auto;
}
.cover-eyebrow {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: ${INK_400};
  margin-bottom: 18px;
}
.cover-title {
  font-size: 96px;
  line-height: 0.92;
  font-weight: 800;
  letter-spacing: -0.055em;
  color: ${INK_900};
}
.cover-title-dot { color: ${FLAME}; }
.cover-subtitle {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 500;
  color: ${INK_500};
  letter-spacing: -0.01em;
}

.cover-data {
  margin-top: 48mm;
  border-top: 0.75px solid ${INK_100};
  padding-top: 16px;
}
.cover-data-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  padding: 9px 0;
  border-bottom: 0.75px solid ${INK_100};
}
.cover-data-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${INK_400};
  align-self: center;
}
.cover-data-value {
  font-size: 14px;
  font-weight: 500;
  color: ${INK_900};
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.cover-data-value .arrow { color: ${INK_400}; margin: 0 6px; }
.cover-data-value .muted { color: ${INK_500}; font-size: 13px; }

.cover-bottom {
  margin-top: auto;
  padding-top: 16px;
  border-top: 0.75px solid ${INK_100};
}
.cover-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
}
.cover-bottom-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: ${INK_400};
}
.cover-bottom-value {
  font-size: 11px;
  color: ${INK_700};
  font-variant-numeric: tabular-nums;
}

/* ─── Pills (risk badges) ──────────────────────────────────────────────── */
.pill {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 9px;
  border-radius: 999px;
  border-width: 0.75px;
  border-style: solid;
  white-space: nowrap;
}

/* ─── Callout cards ─────────────────────────────────────────────────────── */
.grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.callout {
  background: ${SURFACE};
  border: 0.75px solid ${INK_100};
  border-radius: 8px;
  padding: 16px 18px;
}
.callout-body {
  font-size: 12.5px;
  line-height: 1.6;
  color: ${INK_900};
  letter-spacing: -0.005em;
}
.kv-list { list-style: none; }
.kv-list li {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 0.5px solid ${INK_100};
  font-size: 11.5px;
}
.kv-list li:last-child { border-bottom: none; }
.kv-list li span { color: ${INK_500}; }
.kv-list li strong {
  color: ${INK_900};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* ─── Domain summary table ──────────────────────────────────────────────── */
.section-block { margin-top: 24px; }

.domain-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 0.75px solid ${INK_100};
}
.domain-table tr { border-bottom: 0.75px solid ${INK_100}; }
.domain-table td { padding: 12px 8px; vertical-align: middle; }
.domain-letter { width: 34px; }
.letter-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  border-width: 0.75px;
  border-style: solid;
}
.domain-name {
  font-size: 13px;
  font-weight: 600;
  color: ${INK_900};
  letter-spacing: -0.005em;
}
.domain-metric {
  font-size: 11px;
  color: ${INK_500};
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding-right: 16px;
}
.domain-score { width: 88px; text-align: right; }

/* ─── Radar cards ───────────────────────────────────────────────────────── */
.radar-card {
  background: ${SURFACE};
  border: 0.75px solid ${INK_100};
  border-radius: 8px;
  padding: 14px 14px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.radar-card .eyebrow { align-self: flex-start; }

/* ─── Domain detail block (compact) ────────────────────────────────────── */
.domain-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.domain-block {
  border: 0.75px solid ${INK_100};
  border-radius: 8px;
  padding: 12px 14px;
  background: #ffffff;
}
.domain-head {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 10px;
  align-items: center;
}
.domain-letter-lg {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  border-width: 0.75px;
  border-style: solid;
}
.domain-id-text { min-width: 0; }
.domain-title {
  font-size: 13px;
  font-weight: 700;
  color: ${INK_900};
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.domain-q {
  font-size: 10px;
  color: ${INK_500};
  margin-top: 1px;
  line-height: 1.35;
}
.domain-score-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.domain-formula {
  font-family: ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", monospace;
  font-size: 9px;
  color: ${INK_400};
  letter-spacing: -0.02em;
}

.score-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}
.score-cell {
  background: ${SURFACE};
  border: 0.5px solid ${INK_100};
  border-radius: 5px;
  padding: 6px 10px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.score-tag {
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${INK_400};
  flex: 0 0 30px;
}
.score-num {
  font-size: 17px;
  font-weight: 700;
  color: ${INK_900};
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  flex: 1;
  line-height: 1.0;
}

.thresh-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  margin-top: 8px;
}
.thresh-cell {
  border-width: 0.5px;
  border-style: solid;
  border-radius: 3px;
  padding: 3px 5px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.thresh-label {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.thresh-range {
  font-size: 9px;
  font-weight: 600;
  color: ${INK_900};
  font-variant-numeric: tabular-nums;
}

.metrics-inline {
  font-size: 9.5px;
  color: ${INK_700};
  margin-top: 8px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.metrics-inline .m-label { color: ${INK_400}; }
.metrics-inline .m-value {
  color: ${INK_900};
  font-weight: 600;
  font-family: ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", monospace;
  font-size: 9.5px;
}
.metrics-inline .m-sep { color: ${INK_200}; margin: 0 6px; }

/* ─── Projections table ─────────────────────────────────────────────────── */
.proj-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 24px;
  font-size: 11px;
}
.proj-th {
  text-align: left;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: ${INK_400};
  padding: 12px 10px;
  border-bottom: 0.75px solid ${INK_500};
}
.proj-th.right { text-align: right; font-variant-numeric: tabular-nums; }
.proj-th.muted { color: ${INK_300}; }
.proj-table tr.alt { background: ${SURFACE}; }
.proj-label { color: ${INK_700}; padding: 9px 10px; border-bottom: 0.5px solid ${INK_100}; }
.proj-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", monospace;
  color: ${INK_900};
  padding: 9px 10px;
  border-bottom: 0.5px solid ${INK_100};
  font-size: 10.5px;
}
.proj-num.muted { color: ${INK_400}; }

/* ─── Methodology ───────────────────────────────────────────────────────── */
.meth-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 0.75px solid ${INK_100};
}
.meth-table tr { border-bottom: 0.5px solid ${INK_100}; }
.meth-table td { padding: 7px 0; font-size: 11px; }
.meth-label { color: ${INK_500}; width: 50%; }
.meth-value {
  color: ${INK_900};
  text-align: right;
  font-weight: 500;
}

.assumptions { list-style: none; counter-reset: a; }
.assumptions li {
  counter-increment: a;
  font-size: 11px;
  line-height: 1.65;
  color: ${INK_700};
  padding: 8px 0 8px 28px;
  position: relative;
  border-bottom: 0.5px solid ${INK_100};
}
.assumptions li:last-child { border-bottom: none; }
.assumptions li::before {
  content: counter(a, decimal-leading-zero);
  position: absolute;
  left: 0;
  top: 8px;
  font-size: 10px;
  font-weight: 700;
  color: ${INK_400};
  font-variant-numeric: tabular-nums;
}

.next-measurement {
  margin-top: 14px;
  padding: 12px 14px;
  background: ${SURFACE};
  border: 0.75px solid ${INK_100};
  border-radius: 6px;
}
.next-measurement p {
  font-size: 11px;
  line-height: 1.6;
  color: ${INK_900};
}

.scope-note {
  margin-top: 28px;
  padding: 14px 16px;
  background: ${SURFACE};
  border: 0.75px solid ${INK_100};
  border-radius: 8px;
}
.scope-note p {
  font-size: 11px;
  line-height: 1.7;
  color: ${INK_700};
}

.platform { margin-top: 28px; }
.platform-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.platform-card {
  border: 0.75px solid ${INK_100};
  border-radius: 8px;
  padding: 12px 14px;
}
.platform-name {
  font-size: 13px;
  font-weight: 700;
  color: ${INK_900};
  letter-spacing: -0.01em;
}
.platform-desc {
  font-size: 10.5px;
  color: ${INK_500};
  margin-top: 2px;
}
.platform-url {
  font-size: 10px;
  color: ${FLAME};
  margin-top: 8px;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
  font-family: ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", monospace;
}

/* ─── Sections wrapper ──────────────────────────────────────────────────── */
.section { width: 100%; }
</style>
</head>
<body>
${coverPage(inputs, date)}
${summaryPage(inputs, results)}
${domainsSection(inputs, results)}
${projectionsSection(inputs, results)}
</body>
</html>`;
}
