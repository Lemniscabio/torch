import type { ProcessInputs, PartialAssessmentResult, RiskScore, Confidence } from "@torch/core-shared";

// ── Risk tokens (match frontend riskTokens.ts exactly) ───────────────────────

const RISK_FG: Record<RiskScore, string> = {
  low:      "#059669",
  moderate: "#b45309",
  high:     "#c2410c",
  critical: "#dc2626",
};
const RISK_BG: Record<RiskScore, string> = {
  low:      "rgba(5,150,105,0.10)",
  moderate: "rgba(251,191,36,0.12)",
  high:     "rgba(251,146,60,0.12)",
  critical: "rgba(248,113,113,0.12)",
};
const RISK_RING: Record<RiskScore, string> = {
  low:      "rgba(5,150,105,0.35)",
  moderate: "rgba(180,83,9,0.32)",
  high:     "rgba(194,65,12,0.32)",
  critical: "rgba(220,38,38,0.38)",
};
const RISK_DISTANCE: Record<RiskScore, number> = {
  low: 0.15, moderate: 0.40, high: 0.70, critical: 0.95,
};
const RISK_LABEL: Record<RiskScore, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
};
const CONF_LABEL: Record<Confidence, string> = {
  high_confidence: "High confidence", reliable: "Reliable", directional: "Directional",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return l === h ? l : `${l}–${h}`;
}

function midNumber(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  if (a > 0 && b > 0) return Math.sqrt(a * b);
  return (a + b) / 2;
}

function speciesLabel(s: string): string {
  const map: Record<string, string> = {
    e_coli: "E. coli", b_subtilis: "B. subtilis",
    s_cerevisiae: "S. cerevisiae", p_pastoris: "P. pastoris",
    other_bacteria: "Other bacteria", other_yeast: "Other yeast",
  };
  return map[s] ?? s;
}

function scaleCriterionLabel(c: string | undefined): string {
  switch (c ?? "power_per_volume") {
    case "kla":   return "kLa";
    case "shear": return "tip speed";
    default:      return "P/V";
  }
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function badge(score: RiskScore): string {
  return `<span style="display:inline-flex;align-items:center;border-radius:999px;border:1px solid ${RISK_RING[score]};padding:2px 9px;font-size:10px;font-weight:600;background:${RISK_BG[score]};color:${RISK_FG[score]};white-space:nowrap;letter-spacing:.01em">${RISK_LABEL[score]}</span>`;
}

function sectionLabel(text: string): string {
  return `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:#9ca3af;margin:0 0 10px">${text}</p>`;
}

// ── Radar SVG ─────────────────────────────────────────────────────────────────

function radarSvg(scores: Record<string, RiskScore>, title: string, size = 200): string {
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) * 0.68;
  const lR = r + 18;
  const domains = ["mixing", "otr", "shear", "co2", "heat"];
  const letters = ["M", "O", "S", "C", "H"];
  const angles = domains.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  const gridRings = [0.25, 0.5, 0.75, 1.0].map(d => {
    const pts = angles.map(a => `${(cx + d * r * Math.cos(a)).toFixed(1)},${(cy + d * r * Math.sin(a)).toFixed(1)}`).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="1"/>`;
  }).join("");

  const axes = angles.map(a =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.cos(a)).toFixed(1)}" y2="${(cy + r * Math.sin(a)).toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`
  ).join("");

  const scorePoints = domains.map((d, i) => {
    const dist = RISK_DISTANCE[scores[d] ?? "low"];
    return `${(cx + dist * r * Math.cos(angles[i])).toFixed(1)},${(cy + dist * r * Math.sin(angles[i])).toFixed(1)}`;
  }).join(" ");

  const dots = domains.map((d, i) => {
    const dist = RISK_DISTANCE[scores[d] ?? "low"];
    const x = (cx + dist * r * Math.cos(angles[i])).toFixed(1);
    const y = (cy + dist * r * Math.sin(angles[i])).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${RISK_FG[scores[d] ?? "low"]}" stroke="#ffffff" stroke-width="1.5"/>`;
  }).join("");

  const labels = angles.map((a, i) => {
    const x = (cx + lR * Math.cos(a)).toFixed(1);
    const y = (cy + lR * Math.sin(a) + 4).toFixed(1);
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" font-weight="700" fill="${RISK_FG[scores[domains[i]] ?? "low"]}">${letters[i]}</text>`;
  }).join("");

  const titleEl = `<text x="${cx}" y="${size - 4}" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="10" fill="#9ca3af">${title}</text>`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${gridRings}${axes}<polygon points="${scorePoints}" fill="#FF5A1F" fill-opacity="0.14" stroke="#FF5A1F" stroke-width="1.5"/>${dots}${labels}${titleEl}</svg>`;
}

// ── Domain card (matches DomainCard.tsx) ──────────────────────────────────────

function domainCard(letter: string, label: string, score: RiskScore, metric: string): string {
  return `
  <div style="border:1px solid ${RISK_RING[score]};border-radius:8px;padding:14px 12px;background:${RISK_BG[score]}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <span style="display:grid;place-items:center;width:28px;height:28px;border-radius:6px;background:${RISK_BG[score]};color:${RISK_FG[score]};font-size:13px;font-weight:700;flex-shrink:0;border:1px solid ${RISK_RING[score]}">${letter}</span>
      ${badge(score)}
    </div>
    <p style="margin:10px 0 0;font-size:13px;font-weight:600;color:#111827;letter-spacing:-0.005em">${label}</p>
    <p style="margin:8px 0 0;font-size:11px;color:#6b7280;font-variant-numeric:tabular-nums">${metric}</p>
  </div>`;
}

// ── Score column (matches ScoreColumn in DomainDetail.tsx) ───────────────────

function scoreCol(title: string, value: string, score: RiskScore): string {
  return `
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#f9fafb;flex:1">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af">${title}</span>
      ${badge(score)}
    </div>
    <div style="margin-top:10px;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:#111827;line-height:1.1">${value}</div>
  </div>`;
}

// ── Threshold row (matches threshold grid in DomainDetail.tsx) ───────────────

function thresholdRow(thresholds: { label: RiskScore; range: string }[]): string {
  const cells = thresholds.map(t => `
    <div style="border:1px solid ${RISK_RING[t.label]};border-radius:6px;padding:6px 4px;text-align:center;background:${RISK_BG[t.label]};flex:1">
      <p style="font-size:10px;font-weight:700;color:${RISK_FG[t.label]};margin:0">${RISK_LABEL[t.label]}</p>
      <p style="font-size:10px;font-weight:600;color:#111827;margin:2px 0 0;font-variant-numeric:tabular-nums">${t.range}</p>
    </div>`).join("");
  return `<div style="display:flex;gap:5px">${cells}</div>`;
}

// ── Metrics table ─────────────────────────────────────────────────────────────

function metricsTable(rows: { label: string; value: string }[]): string {
  const trs = rows.map((r, i) => `
    <tr style="background:${i % 2 === 1 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:5px 10px;font-size:11px;color:#6b7280">${r.label}</td>
      <td style="padding:5px 10px;text-align:right;font-family:ui-monospace,'Cascadia Code','Source Code Pro',monospace;font-size:11px;color:#111827">${r.value}</td>
    </tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">${trs}</table>`;
}

// ── Per-domain detail block ───────────────────────────────────────────────────

function domainDetailBlock(opts: {
  letter: string;
  label: string;
  score: RiskScore;
  confidence: Confidence;
  driver: string;
  question: string;
  fractionLabel: string;
  thresholds: { label: RiskScore; range: string }[];
  labValue: string;
  labScore: RiskScore;
  targetValue: string;
  targetScore: RiskScore;
  metrics: { label: string; value: string }[];
}): string {
  return `
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:18px 18px 16px;background:#ffffff;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:${RISK_BG[opts.score]};color:${RISK_FG[opts.score]};font-size:14px;font-weight:700;border:1px solid ${RISK_RING[opts.score]}">${opts.letter}</span>
        <span style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.01em">${opts.label}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:10px;color:#9ca3af">${CONF_LABEL[opts.confidence]}</span>
        ${badge(opts.score)}
      </div>
    </div>

    <p style="font-size:13px;color:#374151;line-height:1.5;margin:0 0 10px">${opts.question}</p>
    <p style="font-size:11px;color:#9ca3af;margin:0 0 10px;font-style:italic">Score = ${opts.fractionLabel}</p>

    ${thresholdRow(opts.thresholds)}

    <div style="display:flex;gap:10px;margin-top:10px">
      ${scoreCol("Lab scale", opts.labValue, opts.labScore)}
      ${scoreCol("Target scale", opts.targetValue, opts.targetScore)}
    </div>

    <div style="margin-top:10px">
      ${metricsTable(opts.metrics)}
    </div>
    <p style="font-size:10px;color:#9ca3af;margin:5px 0 0">Driver: ${opts.driver}</p>
  </div>`;
}

// ── Page header ───────────────────────────────────────────────────────────────

function pageHeader(date: string, subtitle: string): string {
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:24px">
    <div>
      <span style="font-size:14px;font-weight:800;color:#111827;letter-spacing:.06em">LEMNISCA</span>
      <span style="font-size:14px;color:#FF5A1F;margin:0 6px">·</span>
      <span style="font-size:14px;font-weight:800;color:#111827;letter-spacing:.06em">TORCH</span>
    </div>
    <div style="text-align:right">
      <p style="font-size:10px;color:#9ca3af;margin:0">${subtitle}</p>
      <p style="font-size:10px;color:#9ca3af;margin:1px 0 0">${date}</p>
    </div>
  </div>`;
}

// ── Page footer ───────────────────────────────────────────────────────────────

function pageFooter(pageNum: number, totalPages: number): string {
  return `
  <div style="position:absolute;bottom:24px;left:52px;right:52px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:9px;color:#9ca3af">torch.lemnisca.bio — bioreactor scale-up assessment</span>
    <span style="font-size:9px;color:#9ca3af">Page ${pageNum} of ${totalPages}</span>
  </div>`;
}

// ── Page 1: Overview ──────────────────────────────────────────────────────────

function overviewPage(inputs: ProcessInputs, r: PartialAssessmentResult, date: string): string {
  const bn = r.primary_bottleneck;
  const rc = r.reactor_configs;
  const scaleRatio = (inputs.v_target / inputs.v_lab).toFixed(0);

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

  const otrMetric = fmt(r.otr.otr_our_ratio_target ?? r.otr.kla_ratio, 2);
  const cards = [
    domainCard("M", "Mixing",          r.mixing.score, `Score = ${fmt(r.mixing.process_mixing_ratio_target, 1)}`),
    domainCard("O", "Oxygen Transfer", r.otr.score,    `Score = ${otrMetric}`),
    domainCard("S", "Shear Stress",    r.shear.score,  `Score = ${fmt(r.shear.tip_speed_margin, 1)}`),
    domainCard("C", "CO₂",            r.co2.score,    r.co2.activated ? `Score = ${fmt(r.co2.target?.pco2_margin ?? r.co2.pco2_margin, 1)}` : "Not activated"),
    domainCard("H", "Heat Removal",   r.heat.score,   `Score = ${fmt(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, 1)}`),
  ];

  return `
  <div class="page">
    ${pageHeader(date, "MOSCH Scale-Up Risk Assessment")}

    <div style="margin-bottom:20px">
      <h1 style="font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.02em;margin:0 0 6px">MOSCH Scale-Up Risk Assessment</h1>
      <p style="font-size:13px;color:#6b7280;margin:0">
        <strong style="color:#374151">${speciesLabel(inputs.organism_species)}</strong>
        &nbsp;·&nbsp;
        ${fmt(inputs.v_lab, 0)} L → ${fmt(inputs.v_target, 0)} L
        &nbsp;·&nbsp;
        Scale ratio <strong style="color:#374151;font-variant-numeric:tabular-nums">${scaleRatio}×</strong>
        &nbsp;·&nbsp;
        Scaled by ${scaleCriterionLabel(inputs.scaleup_criterion)}
      </p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="border:1px solid #e5e7eb;background:#f9fafb;padding:14px 16px;border-radius:8px">
        ${sectionLabel("Primary Bottleneck")}
        <p style="font-size:13px;color:#111827;line-height:1.6;margin:0">${bn.domain ? bn.statement : "No domain reached the moderate threshold at target scale."}</p>
      </div>
      <div style="border:1px solid #e5e7eb;background:#f9fafb;padding:14px 16px;border-radius:8px">
        ${sectionLabel("Scale-Up Constraints")}
        <p style="font-size:13px;color:#111827;line-height:1.6;margin:0">
          Criterion: <strong>${scaleCriterionLabel(inputs.scaleup_criterion)}</strong>.
          Target RPM: <strong style="font-variant-numeric:tabular-nums">${fmtAuto(rc?.target.rpm)}</strong>.
          Aeration: <strong style="font-variant-numeric:tabular-nums">${fmt(rc?.target.vvm, 2)} vvm</strong>.
        </p>
      </div>
    </div>

    ${sectionLabel("Risk Domains")}
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px">
      ${cards.join("")}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#ffffff;display:flex;flex-direction:column;align-items:center">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin:0 0 8px">Lab Scale Risk Profile</p>
        ${radarSvg(labScores, "Lab scale", 210)}
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#ffffff;display:flex;flex-direction:column;align-items:center">
        <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin:0 0 8px">Target Scale Risk Profile</p>
        ${radarSvg(targetScores, "Target scale", 210)}
      </div>
    </div>

    ${pageFooter(1, 4)}
  </div>`;
}

// ── Pages 2–3: Domain Details ─────────────────────────────────────────────────

function domainDetailPages(inputs: ProcessInputs, r: PartialAssessmentResult, date: string): string {
  const ratioLabOtr  = r.otr.otr_our_ratio_lab  ?? r.otr.kla_ratio;
  const ratioTgtOtr  = r.otr.otr_our_ratio_target ?? r.otr.kla_ratio;
  const co2LabMargin = r.co2.lab?.pco2_margin;
  const co2TgtMargin = r.co2.target?.pco2_margin ?? r.co2.pco2_margin;

  const domains = [
    // Mixing
    domainDetailBlock({
      letter: "M", label: "Mixing", score: r.mixing.score,
      confidence: r.mixing.confidence, driver: r.mixing.driver,
      question: "Is mixing fast enough to dissipate substrate and pH gradients?",
      fractionLabel: "τ_required / τ_mixing",
      thresholds: [
        { label: "low",      range: "> 10"   },
        { label: "moderate", range: "1–10"   },
        { label: "high",     range: "0.1–1"  },
        { label: "critical", range: "< 0.1"  },
      ],
      labValue:    fmtScore(r.mixing.process_mixing_ratio_lab,    r.mixing.process_mixing_ratio_lab_std,    1),
      labScore:    r.mixing.score_lab ?? r.mixing.score,
      targetValue: fmtScore(r.mixing.process_mixing_ratio_target, r.mixing.process_mixing_ratio_target_std, 1),
      targetScore: r.mixing.score_target ?? r.mixing.score,
      metrics: [
        { label: "Mixing time — lab",    value: fmt(r.mixing.theta_mix_lab,    1, "s") },
        { label: "Mixing time — target", value: fmt(r.mixing.theta_mix_target, 1, "s") },
        { label: "Process timescale",    value: fmt(r.mixing.t_process_target_s, 1, "s") },
      ],
    }),
    // OTR
    domainDetailBlock({
      letter: "O", label: "Oxygen Transfer", score: r.otr.score,
      confidence: r.otr.confidence, driver: r.otr.driver,
      question: "Can the reactor deliver sufficient oxygen to meet the cells' demand at scale?",
      fractionLabel: "OTR / OUR",
      thresholds: [
        { label: "low",      range: "> 1.5"   },
        { label: "moderate", range: "1.0–1.5" },
        { label: "high",     range: "0.7–1.0" },
        { label: "critical", range: "< 0.7"   },
      ],
      labValue:    fmtScore(ratioLabOtr,  r.otr.otr_our_ratio_lab_std,    1),
      labScore:    r.otr.score_lab,
      targetValue: fmtScore(ratioTgtOtr, r.otr.otr_our_ratio_target_std, 1),
      targetScore: r.otr.score_target,
      metrics: [
        { label: "kLa achievable — target", value: fmt(r.otr.kla_target_moderate, 1, "h⁻¹") },
        { label: "kLa required",            value: fmt(r.otr.kla_required,        1, "h⁻¹") },
        { label: "P/V — target",            value: fmt(r.otr.pv_target,           0, "W/m³") },
      ],
    }),
    // Shear
    domainDetailBlock({
      letter: "S", label: "Shear Stress", score: r.shear.score,
      confidence: r.shear.confidence, driver: r.shear.driver,
      question: "Is impeller tip speed low enough to protect cells from hydrodynamic damage?",
      fractionLabel: "v_tip_threshold / v_tip_impeller",
      thresholds: [
        { label: "low",      range: "> 1.43"    },
        { label: "moderate", range: "1.0–1.43"  },
        { label: "high",     range: "0.77–1.0"  },
        { label: "critical", range: "< 0.77"    },
      ],
      labValue:    fmtScore(r.shear.tip_speed_margin_lab, r.shear.tip_speed_margin_lab_std, 1),
      labScore:    r.shear.score_lab,
      targetValue: fmtScore(r.shear.tip_speed_margin,     r.shear.tip_speed_margin_std,     1),
      targetScore: r.shear.score_target,
      metrics: [
        { label: "Tip speed — lab",    value: fmt(r.shear.tip_speed_lab,       2, "m/s") },
        { label: "Tip speed — target", value: fmt(r.shear.tip_speed,           2, "m/s") },
        { label: "Threshold",          value: fmt(r.shear.tip_speed_threshold, 2, "m/s") },
      ],
    }),
    // CO₂
    domainDetailBlock({
      letter: "C", label: "CO₂ Accumulation", score: r.co2.score,
      confidence: r.co2.confidence, driver: r.co2.driver,
      question: "Is dissolved CO₂ in the reactor low enough to avoid toxicity?",
      fractionLabel: "P_CO₂_threshold / P_CO₂_reactor",
      thresholds: [
        { label: "low",      range: "> 1.5"   },
        { label: "moderate", range: "1.0–1.5" },
        { label: "high",     range: "0.75–1.0"},
        { label: "critical", range: "< 0.75"  },
      ],
      labValue:    r.co2.activated ? fmtScore(co2LabMargin, undefined, 1) : "—",
      labScore:    r.co2.lab?.score ?? r.co2.score,
      targetValue: r.co2.activated ? fmtScore(co2TgtMargin, r.co2.pco2_margin_std, 1) : "—",
      targetScore: r.co2.target?.score ?? r.co2.score,
      metrics: r.co2.activated
        ? [
            { label: "pCO₂ — lab",    value: fmt(r.co2.lab?.pco2_bottom, 3, "bar")  },
            { label: "pCO₂ — target", value: fmt(r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom, 3, "bar") },
            { label: "Threshold",     value: fmt(r.co2.pco2_critical, 3, "bar") },
          ]
        : [{ label: "Status", value: "Not activated — OUR below CO₂ stripping limit" }],
    }),
    // Heat
    domainDetailBlock({
      letter: "H", label: "Heat Removal", score: r.heat.score,
      confidence: r.heat.confidence, driver: r.heat.driver,
      question: "Can the reactor jacket withdraw all metabolic heat generated at target scale?",
      fractionLabel: "Q_cooling / Q_metabolic",
      thresholds: [
        { label: "low",      range: "> 1.67"   },
        { label: "moderate", range: "1.18–1.67"},
        { label: "high",     range: "1.0–1.18" },
        { label: "critical", range: "< 1.0"    },
      ],
      labValue:    fmt(r.heat.lab?.heat_transfer_margin, 1),
      labScore:    r.heat.lab?.score ?? r.heat.score,
      targetValue: fmtScore(r.heat.target?.heat_transfer_margin ?? r.heat.heat_transfer_margin, r.heat.heat_transfer_margin_std, 1),
      targetScore: r.heat.target?.score ?? r.heat.score,
      metrics: [
        { label: "Metabolic heat — lab",    value: fmt(r.heat.lab?.q_metabolic, 1, "kW") },
        { label: "Metabolic heat — target", value: fmt(r.heat.target?.q_metabolic ?? r.heat.q_metabolic, 1, "kW") },
        { label: "Cooling capacity",        value: fmt(r.heat.q_cool_max, 1, "kW") },
        { label: "Jacket area",             value: fmt(r.heat.a_jacket, 2, "m²") },
      ],
    }),
  ];

  // Split 3 on page 2, 2 on page 3
  return `
  <div class="page">
    ${pageHeader(date, "Risk Domains — M, O, S")}
    ${domains[0]}
    ${domains[1]}
    ${domains[2]}
    ${pageFooter(2, 4)}
  </div>

  <div class="page">
    ${pageHeader(date, "Risk Domains — C, H")}
    ${domains[3]}
    ${domains[4]}
    ${pageFooter(3, 4)}
  </div>`;
}

// ── Page 4: Scale-Up Projections + Reliability ────────────────────────────────

function projectionsPage(inputs: ProcessInputs, r: PartialAssessmentResult, date: string): string {
  const rc = r.reactor_configs;
  const pilotVolume = Math.sqrt(inputs.v_lab * inputs.v_target);
  const labAeration = inputs.vvm * inputs.v_lab;
  const targetAeration = (rc?.target.vvm ?? inputs.vvm) * inputs.v_target;

  const labPco2   = r.co2.activated ? r.co2.lab?.pco2_bottom : undefined;
  const targetPco2 = r.co2.activated ? (r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom) : undefined;

  const projRows: { label: string; lab: string; pilot: string; target: string }[] = [
    {
      label:  "Impeller RPM (rpm)",
      lab:    fmtAuto(rc?.lab.rpm),
      pilot:  fmtAuto(midNumber(rc?.lab.rpm, rc?.target.rpm)),
      target: fmtAuto(rc?.target.rpm),
    },
    {
      label:  "Aeration rate (L/min, vvm)",
      lab:    `${fmtAuto(labAeration)} (${fmtAuto(inputs.vvm)})`,
      pilot:  `${fmtAuto(midNumber(labAeration, targetAeration))} (${fmtAuto(midNumber(inputs.vvm, rc?.target.vvm))})`,
      target: `${fmtAuto(targetAeration)} (${fmtAuto(rc?.target.vvm)})`,
    },
    {
      label:  "Impeller diameter (m)",
      lab:    fmtAuto(rc?.lab.geometry.d_imp),
      pilot:  fmtAuto(midNumber(rc?.lab.geometry.d_imp, rc?.target.geometry.d_imp)),
      target: fmtAuto(rc?.target.geometry.d_imp),
    },
    {
      label:  "Reactor height (m)",
      lab:    fmtAuto(rc?.lab.geometry.h_liquid),
      pilot:  fmtAuto(midNumber(rc?.lab.geometry.h_liquid, rc?.target.geometry.h_liquid)),
      target: fmtAuto(rc?.target.geometry.h_liquid),
    },
    {
      label:  "kLa achievable (h⁻¹)",
      lab:    rc ? rangeAuto(rc.lab.kla_ensemble.min,    rc.lab.kla_ensemble.max)    : "—",
      pilot:  rc ? rangeAuto(midNumber(rc.lab.kla_ensemble.min, rc.target.kla_ensemble.min), midNumber(rc.lab.kla_ensemble.max, rc.target.kla_ensemble.max)) : "—",
      target: rc ? rangeAuto(rc.target.kla_ensemble.min, rc.target.kla_ensemble.max) : "—",
    },
    {
      label:  "Mixing time (s)",
      lab:    rangeAuto(r.mixing.theta_mix_lab_min ?? r.mixing.theta_mix_lab, r.mixing.theta_mix_lab_max ?? r.mixing.theta_mix_lab),
      pilot:  rangeAuto(midNumber(r.mixing.theta_mix_lab_min, r.mixing.theta_mix_target_min), midNumber(r.mixing.theta_mix_lab_max, r.mixing.theta_mix_target_max)),
      target: rangeAuto(r.mixing.theta_mix_target_min ?? r.mixing.theta_mix_target, r.mixing.theta_mix_target_max ?? r.mixing.theta_mix_target),
    },
    {
      label:  "Tip speed (m/s)",
      lab:    fmtAuto(r.shear.tip_speed_lab),
      pilot:  fmtAuto(midNumber(r.shear.tip_speed_lab, r.shear.tip_speed)),
      target: fmtAuto(r.shear.tip_speed),
    },
    {
      label:  "pCO₂ at bottom (bar)",
      lab:    fmtAuto(labPco2),
      pilot:  fmtAuto(midNumber(labPco2, targetPco2)),
      target: fmtAuto(targetPco2),
    },
    {
      label:  "Metabolic heat (kW)",
      lab:    fmtAuto(r.heat.lab?.q_metabolic),
      pilot:  fmtAuto(midNumber(r.heat.lab?.q_metabolic, r.heat.target?.q_metabolic ?? r.heat.q_metabolic)),
      target: fmtAuto(r.heat.target?.q_metabolic ?? r.heat.q_metabolic),
    },
    {
      label:  "Cooling capacity (kW)",
      lab:    fmtAuto(r.heat.lab?.q_cool_max),
      pilot:  fmtAuto(midNumber(r.heat.lab?.q_cool_max, r.heat.target?.q_cool_max ?? r.heat.q_cool_max)),
      target: fmtAuto(r.heat.target?.q_cool_max ?? r.heat.q_cool_max),
    },
  ];

  const tableHead = `
    <thead>
      <tr style="background:#111827">
        <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:.06em">Quantity</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:.06em">Lab (${fmt(inputs.v_lab, 0)} L)</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:.06em">Pilot (${fmtAuto(pilotVolume)} L)</th>
        <th style="padding:9px 12px;text-align:right;font-size:11px;font-weight:700;color:#ffffff;letter-spacing:.06em">Production (${fmt(inputs.v_target, 0)} L)</th>
      </tr>
    </thead>`;

  const tableBody = projRows.map((row, i) => `
    <tr style="background:${i % 2 === 1 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb">${row.label}</td>
      <td style="padding:8px 12px;text-align:right;font-family:ui-monospace,'Cascadia Code','Source Code Pro',monospace;font-size:12px;color:#111827;border-bottom:1px solid #e5e7eb">${row.lab}</td>
      <td style="padding:8px 12px;text-align:right;font-family:ui-monospace,'Cascadia Code','Source Code Pro',monospace;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb">${row.pilot}</td>
      <td style="padding:8px 12px;text-align:right;font-family:ui-monospace,'Cascadia Code','Source Code Pro',monospace;font-size:12px;color:#111827;border-bottom:1px solid #e5e7eb">${row.target}</td>
    </tr>`).join("");

  const ourMeasured = inputs.our_mode === "measured";

  const assumptions = [
    "kLa estimated via van't Riet ensemble; ±30–40% intrinsic uncertainty.",
    inputs.impeller_type === "unknown"
      ? "Unknown impeller treated as Rushton geometry — replace with actual type for sharper estimates."
      : "Mixing time blended across Ruszkowski, Cooke, and Grenville-Nienow ensembles.",
    ourMeasured
      ? "OUR is user-measured; downstream margins inherit this value directly."
      : "OUR estimated from biomass × species — a measured value would tighten every domain except shear.",
  ];

  const provenance = [
    { label: "Organism",                              value: "User-provided" },
    { label: "Scale (lab / target)",                  value: "User-provided" },
    { label: "Geometry (H/D, D/T, impeller)",         value: "User-provided with defaults" },
    { label: "Operating (RPM, VVM, DO)",              value: "User-provided with defaults where omitted" },
    { label: "OUR (peak)",                            value: ourMeasured ? "User-measured (high confidence)" : "Estimated from literature kinetics" },
    { label: "Temperature / cooling water",           value: "User-provided" },
  ];

  return `
  <div class="page">
    ${pageHeader(date, "Scale-Up Projections · Reliability")}

    ${sectionLabel("Scale-Up Projections — Lab → Pilot → Production")}
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      ${tableHead}
      <tbody>${tableBody}</tbody>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div>
        ${sectionLabel("Input Provenance")}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          ${provenance.map((p, i) => `
          <tr style="background:${i % 2 === 1 ? "#f9fafb" : "#ffffff"}">
            <td style="padding:6px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb">${p.label}</td>
            <td style="padding:6px 10px;text-align:right;font-size:11px;color:#111827;border-bottom:1px solid #e5e7eb">${p.value}</td>
          </tr>`).join("")}
        </table>
      </div>

      <div>
        ${sectionLabel("Key Assumptions")}
        <ol style="margin:0;padding-left:16px">
          ${assumptions.map(a => `<li style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:6px">${a}</li>`).join("")}
        </ol>

        <div style="margin-top:12px;border:1px solid #e5e7eb;background:#f9fafb;padding:10px 12px;border-radius:6px">
          <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#0d9488;margin:0 0 5px">Most valuable next measurement</p>
          <p style="font-size:11px;color:#374151;line-height:1.6;margin:0">
            ${ourMeasured
              ? "Pilot kLa measurement at intermediate volume to validate the scale-up envelope."
              : "A direct OUR measurement at peak biomass — upgrades every domain confidence except shear."}
          </p>
        </div>
      </div>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;background:#f9fafb;margin-bottom:20px">
      <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#9ca3af;margin:0 0 6px">Scope Limitations</p>
      <p style="font-size:11px;color:#374151;line-height:1.7;margin:0">
        This assessment uses empirical correlations with ±30–40% uncertainty on kLa and ±15–20% on heat transfer.
        Risk categories indicate the magnitude of attention each domain requires — not an absolute pass/fail.
        Yield, product titer, and product-specific cell damage thresholds are outside the scope of this report.
        Results should complement, not replace, pilot experimentation.
      </p>
    </div>

    <div style="border-top:1px solid #e5e7eb;padding-top:16px">
      ${sectionLabel("Lemnisca Platform")}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[
          { name: "lemnisca.bio",  desc: "Platform home",            url: "https://www.lemnisca.bio/" },
          { name: "Tune",          desc: "Bioprocess optimisation", url: "https://www.lemnisca.bio/tune" },
          { name: "Thrust",        desc: "Bioreactor design",       url: "https://www.lemnisca.bio/thrust" },
        ].map(p => `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#ffffff">
            <p style="font-size:12px;font-weight:700;color:#111827;margin:0 0 3px">${p.name}</p>
            <p style="font-size:10px;color:#6b7280;margin:0 0 6px;line-height:1.4">${p.desc}</p>
            <p style="font-size:10px;color:#FF5A1F;margin:0;word-break:break-all">${p.url}</p>
          </div>`).join("")}
      </div>
    </div>

    ${pageFooter(4, 4)}
  </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildReportHtml(inputs: ProcessInputs, results: PartialAssessmentResult): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const title = `MOSCH Report — ${speciesLabel(inputs.organism_species)} ${fmt(inputs.v_lab, 0)}→${fmt(inputs.v_target, 0)} L`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 794px; min-height: 1123px; padding: 40px 52px 72px; position: relative; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  ${overviewPage(inputs, results, date)}
  ${domainDetailPages(inputs, results, date)}
  ${projectionsPage(inputs, results, date)}
</body>
</html>`;
}
