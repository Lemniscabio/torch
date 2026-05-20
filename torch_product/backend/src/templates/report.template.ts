import type { ProcessInputs, PartialAssessmentResult, RiskScore, Confidence } from "@torch/core-shared";

const RISK_COLOR: Record<RiskScore, { bg: string; text: string; border: string }> = {
  low:      { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7" },
  moderate: { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
  high:     { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" },
  critical: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

const RISK_LABEL: Record<RiskScore, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
};

const CONF_LABEL: Record<Confidence, string> = {
  high_confidence: "High confidence",
  reliable: "Reliable",
  directional: "Directional",
};

function fmt(n: number | undefined, digits = 2, unit = ""): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function speciesLabel(s: string): string {
  const map: Record<string, string> = {
    e_coli: "E. coli", b_subtilis: "B. subtilis",
    s_cerevisiae: "S. cerevisiae", p_pastoris: "P. pastoris",
    other_bacteria: "Other bacteria", other_yeast: "Other yeast",
  };
  return map[s] ?? s;
}

function badge(score: RiskScore): string {
  const c = RISK_COLOR[score];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${c.bg};color:${c.text};border:1px solid ${c.border}">${RISK_LABEL[score]}</span>`;
}

function paramRow(label: string, value: string): string {
  return `<tr><td style="padding:5px 8px;color:#374151;font-size:12px">${label}</td><td style="padding:5px 8px;text-align:right;font-family:monospace;font-size:12px;color:#111827">${value}</td></tr>`;
}

function section(title: string, content: string): string {
  return `
    <div class="section">
      <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px">${title}</h2>
      ${content}
    </div>`;
}

// ── Page 1: Executive Summary ─────────────────────────────────────────────────

function executiveSummary(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  const bn = r.primary_bottleneck;
  const domainRows = [
    { domain: "Oxygen transfer",  score: r.otr.score,   metric: `kLa ratio ${fmt(r.otr.otr_our_ratio_target ?? r.otr.kla_ratio, 2)}`, conf: r.otr.confidence },
    { domain: "Mixing",           score: r.mixing.score, metric: `τ_mix ${fmt(r.mixing.theta_mix_target, 1, "s")}`,                   conf: r.mixing.confidence },
    { domain: "Shear stress",     score: r.shear.score,  metric: `v_tip ${fmt(r.shear.tip_speed, 2, "m/s")}`,                        conf: r.shear.confidence },
    { domain: "CO₂ accumulation", score: r.co2.score,    metric: r.co2.activated ? `pCO₂ ${fmt(r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom, 3, "bar")}` : "Not activated", conf: r.co2.confidence },
    { domain: "Heat removal",     score: r.heat.score,   metric: `Q ${fmt(r.heat.q_cool_max, 1)}/${fmt(r.heat.q_metabolic, 1, "kW")}`, conf: r.heat.confidence },
  ];

  const tableRows = domainRows.map((d, i) => `
    <tr style="background:${i % 2 === 1 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:8px 12px;font-size:12px;color:#111827">${d.domain}</td>
      <td style="padding:8px 12px">${badge(d.score)}</td>
      <td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#374151">${d.metric}</td>
      <td style="padding:8px 12px;font-size:11px;color:#6b7280">${CONF_LABEL[d.conf]}</td>
    </tr>`).join("");

  return section("Executive Summary", `
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:16px">
      ${paramRow("Organism", speciesLabel(inputs.organism_species))}
      ${paramRow("Lab volume", `${inputs.v_lab} L`)}
      ${paramRow("Target volume", `${inputs.v_target} L`)}
      ${paramRow("Scale ratio", `${(inputs.v_target / inputs.v_lab).toFixed(0)}×`)}
      ${paramRow("Scale-up criterion", (inputs.scaleup_criterion ?? "power_per_volume").replace(/_/g, " "))}
    </table>

    <div style="border-left:4px solid #FF5A1F;background:#fff7f5;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:#FF5A1F;letter-spacing:.08em;margin-bottom:6px">PRIMARY BOTTLENECK</div>
      <div style="font-size:13px;color:#111827;line-height:1.5">${bn.domain ? bn.statement : "No domain reached the moderate threshold at target scale."}</div>
    </div>

    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px">Domain summary</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead><tr style="background:#111827">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff">Domain</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff">Score</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff">Key metric</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff">Confidence</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `);
}

// ── Page 2: Risk Detail ───────────────────────────────────────────────────────

function riskDetail(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  type DomainBlock = {
    title: string; score: RiskScore; confidence: Confidence;
    driver: string; params: { label: string; value: string }[];
    thresholds: string; mitigation?: string;
  };

  const blocks: DomainBlock[] = [
    {
      title: "Oxygen transfer", score: r.otr.score, confidence: r.otr.confidence, driver: r.otr.driver,
      params: [
        { label: "kLa achievable (target)", value: fmt(r.otr.kla_target_moderate, 1, "h⁻¹") },
        { label: "kLa required",            value: fmt(r.otr.kla_required, 1, "h⁻¹") },
        { label: "OTR/OUR ratio",           value: fmt(r.otr.otr_our_ratio_target ?? r.otr.kla_ratio, 2) },
        { label: "P/V (target)",            value: fmt(r.otr.pv_target, 0, "W/m³") },
      ],
      thresholds: "Low > 1.5 · Moderate 1.0–1.5 · High 0.7–1.0 · Critical < 0.7",
      mitigation: r.otr.score === "high" || r.otr.score === "critical"
        ? "Increase RPM (within tip-speed bound), raise O₂ enrichment, or add baffles to push kLa upward." : undefined,
    },
    {
      title: "Mixing", score: r.mixing.score, confidence: r.mixing.confidence, driver: r.mixing.driver,
      params: [
        { label: "τ_mix (target)",      value: fmt(r.mixing.theta_mix_target, 1, "s") },
        { label: "τ_process",           value: fmt(r.mixing.t_process_target_s, 1, "s") },
        { label: "Process/mix margin",  value: fmt(r.mixing.process_mixing_ratio_target, 2) },
      ],
      thresholds: "Low > 10 · Moderate 1–10 · High 0.1–1 · Critical < 0.1",
      mitigation: r.mixing.score === "high" || r.mixing.score === "critical"
        ? "Use multiple impellers, increase impeller diameter (within D/T 0.4), or reduce feed pulsing frequency." : undefined,
    },
    {
      title: "Shear stress", score: r.shear.score, confidence: r.shear.confidence, driver: r.shear.driver,
      params: [
        { label: "Tip speed (target)", value: fmt(r.shear.tip_speed, 2, "m/s") },
        { label: "Threshold",          value: fmt(r.shear.tip_speed_threshold, 2, "m/s") },
        { label: "Margin",             value: fmt(r.shear.tip_speed_margin, 2) },
      ],
      thresholds: "Low > 1.43 · Moderate 1.0–1.43 · High 0.77–1.0 · Critical < 0.77",
      mitigation: r.shear.score === "high" || r.shear.score === "critical"
        ? "Switch to lower-shear impeller (pitched-blade or marine), reduce RPM, or scale by tip-speed criterion." : undefined,
    },
    {
      title: "CO₂ accumulation", score: r.co2.score, confidence: r.co2.confidence, driver: r.co2.driver,
      params: r.co2.activated
        ? [
            { label: "pCO₂ at bottom", value: fmt(r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom, 3, "bar") },
            { label: "pCO₂ threshold", value: fmt(r.co2.pco2_critical, 3, "bar") },
            { label: "Margin",         value: fmt(r.co2.pco2_margin, 2) },
          ]
        : [{ label: "Status", value: "Not activated (low OUR)" }],
      thresholds: "Low > 1.5 · Moderate 1.0–1.5 · High 0.75–1.0 · Critical < 0.75",
      mitigation: r.co2.score === "high" || r.co2.score === "critical"
        ? "Increase aeration (VVM), use a tall narrow geometry, or reduce vessel depth via a wider H/D." : undefined,
    },
    {
      title: "Heat removal", score: r.heat.score, confidence: r.heat.confidence, driver: r.heat.driver,
      params: [
        { label: "Q_metabolic",    value: fmt(r.heat.q_metabolic, 1, "kW") },
        { label: "Q_cooling_max",  value: fmt(r.heat.q_cool_max, 1, "kW") },
        { label: "Margin",         value: fmt(r.heat.heat_transfer_margin, 2) },
        { label: "Jacket area",    value: fmt(r.heat.a_jacket, 2, "m²") },
      ],
      thresholds: "Low > 1.67 · Moderate 1.18–1.67 · High 1.0–1.18 · Critical < 1.0",
      mitigation: r.heat.score === "high" || r.heat.score === "critical"
        ? "Add internal cooling coils, drop CW inlet temperature, or accept reduced peak biomass." : undefined,
    },
  ];

  const blockHtml = blocks.map(b => {
    const mitigationHtml = b.mitigation ? `
      <div style="margin-top:8px;border-left:3px solid #FF5A1F;background:#fff7f5;padding:8px 12px">
        <div style="font-size:10px;font-weight:700;color:#FF5A1F;margin-bottom:3px">Mitigation</div>
        <div style="font-size:11px;color:#374151;line-height:1.5">${b.mitigation}</div>
      </div>` : "";

    return `
      <div style="margin-bottom:20px;break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:14px;font-weight:700;color:#111827">${b.title}</span>
          ${badge(b.score)}
        </div>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px">
          ${b.params.map(p => paramRow(p.label, p.value)).join("")}
        </table>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">Thresholds: ${b.thresholds}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px">Confidence: ${CONF_LABEL[b.confidence]} — ${b.driver}</div>
        ${mitigationHtml}
      </div>`;
  }).join("");

  return section("Risk Detail", `
    <div style="font-size:11px;color:#6b7280;margin-bottom:16px">
      ${speciesLabel(inputs.organism_species)} · ${inputs.v_lab}→${inputs.v_target} L · ${(inputs.scaleup_criterion ?? "power_per_volume").replace(/_/g, " ")}
    </div>
    ${blockHtml}
  `);
}

// ── Page 3: Quantitative Projections ─────────────────────────────────────────

function projections(inputs: ProcessInputs, r: PartialAssessmentResult): string {
  const rows: { label: string; lab: string; target: string }[] = [
    { label: "kLa (h⁻¹)",             lab: fmt(r.otr.kla_lab, 1),                                          target: fmt(r.otr.kla_target_moderate, 1) },
    { label: "kLa required (h⁻¹)",    lab: fmt(r.otr.kla_required, 1),                                     target: fmt(r.otr.kla_required, 1) },
    { label: "Mixing time (s)",        lab: fmt(r.mixing.theta_mix_lab, 1),                                 target: fmt(r.mixing.theta_mix_target, 1) },
    { label: "Mixing margin",          lab: fmt(r.mixing.process_mixing_ratio_lab, 2),                      target: fmt(r.mixing.process_mixing_ratio_target, 2) },
    { label: "Tip speed (m/s)",        lab: fmt(r.shear.tip_speed_lab, 2),                                  target: fmt(r.shear.tip_speed, 2) },
    { label: "pCO₂ at bottom (bar)",   lab: r.co2.activated ? fmt(r.co2.lab?.pco2_bottom, 3) : "—",         target: r.co2.activated ? fmt(r.co2.target?.pco2_bottom ?? r.co2.pco2_bottom, 3) : "—" },
    { label: "Metabolic heat (kW)",    lab: fmt(r.heat.lab?.q_metabolic, 2),                                target: fmt(r.heat.target?.q_metabolic ?? r.heat.q_metabolic, 2) },
    { label: "Cooling capacity (kW)",  lab: fmt(r.heat.lab?.q_cool_max, 2),                                 target: fmt(r.heat.target?.q_cool_max ?? r.heat.q_cool_max, 2) },
  ];

  const tableRows = rows.map((row, i) => `
    <tr style="background:${i % 2 === 1 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:8px 12px;font-size:12px;color:#111827">${row.label}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:12px;color:#374151">${row.lab}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:12px;color:#374151">${row.target}</td>
    </tr>`).join("");

  return section("Quantitative Projections", `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:20px">
      <thead><tr style="background:#111827">
        <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff">Quantity</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff">Lab (${inputs.v_lab} L)</th>
        <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff">Target (${inputs.v_target} L)</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px">Scale-up basis</h3>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px">
      ${paramRow("Criterion", (inputs.scaleup_criterion ?? "power_per_volume").replace(/_/g, " "))}
      ${paramRow("Impeller type", inputs.impeller_type.replace("_", "-"))}
      ${paramRow("Impellers (lab / target)", `${inputs.n_impellers} / ${inputs.n_impellers_target ?? inputs.n_impellers}`)}
      ${paramRow("H/D (lab / target)", `${inputs.h_d_lab.toFixed(2)} / ${inputs.h_d_target.toFixed(2)}`)}
      ${paramRow("VVM", inputs.vvm.toFixed(2))}
    </table>
  `);
}

// ── Page 4: Reliability Statement ────────────────────────────────────────────

function reliability(inputs: ProcessInputs): string {
  const ourMeasured = inputs.our_mode === "measured";
  const provenance = [
    { label: "Organism + species",            value: "User-provided" },
    { label: "Scale (lab / target)",          value: "User-provided" },
    { label: "Geometry (H/D, D/T, impeller)", value: "User-provided with sensible defaults" },
    { label: "Operating (RPM, VVM, DO)",      value: "User-provided with defaults where omitted" },
    { label: "OUR (peak)",                    value: ourMeasured ? "User-measured (high confidence)" : "Estimated from literature kinetics" },
    { label: "Temperature + cooling water",   value: "User-provided" },
  ];

  const assumptions = [
    "kLa estimated via van't Riet ensemble; ±30–40% intrinsic uncertainty.",
    inputs.impeller_type === "unknown"
      ? "Unknown impeller type treated as Rushton geometry — replace with actual type for sharper estimates."
      : "Mixing time blended across Ruszkowski, Cooke, and Grenville-Nienow ensembles.",
    ourMeasured
      ? "OUR is user-measured; downstream margins inherit this directly."
      : "OUR estimated from biomass + species — a measured value would tighten every domain except shear.",
  ];

  const recommendation = ourMeasured
    ? "Pilot kLa measurement at intermediate volume to validate the scale-up envelope."
    : "A direct OUR measurement at peak biomass is the highest-leverage single measurement to upgrade this report.";

  return section("Reliability Statement", `
    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px">Input provenance</h3>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:20px">
      ${provenance.map(p => paramRow(p.label, p.value)).join("")}
    </table>

    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 8px">Highest-impact assumptions</h3>
    <ol style="margin:0 0 20px;padding-left:20px">
      ${assumptions.map(a => `<li style="font-size:12px;color:#374151;line-height:1.6;margin-bottom:4px">${a}</li>`).join("")}
    </ol>

    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 6px">Most valuable additional measurement</h3>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 20px">${recommendation}</p>

    <div style="border-left:4px solid #0D7377;background:#f0f9f9;padding:12px 16px;border-radius:0 6px 6px 0">
      <div style="font-size:10px;font-weight:700;color:#0D7377;letter-spacing:.08em;margin-bottom:6px">SCOPE LIMITATIONS</div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0">
        This assessment is based on empirical correlations with ±30–40% uncertainty on kLa and ±15–20% on heat transfer.
        It does not predict yield, product titer, or replace pilot experimentation. Risk categories indicate the magnitude
        of attention each domain needs, not absolute pass/fail.
      </p>
    </div>

    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af">
      ${speciesLabel(inputs.organism_species)} · ${inputs.process_type.replace("_", "-")} · ${inputs.v_lab} L → ${inputs.v_target} L · ${ourMeasured ? `measured OUR ${fmt(inputs.our_measured, 0, "mmol/L/h")}` : "estimated OUR"}
    </div>
  `);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildReportHtml(inputs: ProcessInputs, results: PartialAssessmentResult): string {
  const date = new Date().toISOString().slice(0, 10);
  const title = `Lemnisca Torch — ${speciesLabel(inputs.organism_species)} ${inputs.v_lab}→${inputs.v_target} L`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #fff; }
    .page { width: 794px; min-height: 1123px; padding: 48px 52px 60px; position: relative; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; margin-bottom: 28px; }
    .brand { font-size: 13px; font-weight: 700; color: #111827; letter-spacing: .08em; }
    .brand-accent { color: #FF5A1F; }
    .header-meta { font-size: 10px; color: #6b7280; }
    .footer { position: absolute; bottom: 24px; left: 52px; right: 52px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; }
    .section { margin-bottom: 32px; }
    @media print {
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>

  <div class="page">
    <div class="header">
      <div class="brand">LEMNISCA <span class="brand-accent">·</span> TORCH</div>
      <div class="header-meta">Scale-up risk assessment · ${date}</div>
    </div>
    ${executiveSummary(inputs, results)}
    <div class="footer">Generated by Lemnisca Torch. Predictions are bounded by empirical correlations (±30–40% on kLa) and do not replace pilot experimentation.</div>
  </div>

  <div class="page">
    <div class="header">
      <div class="brand">LEMNISCA <span class="brand-accent">·</span> TORCH</div>
      <div class="header-meta">Scale-up risk assessment · ${date}</div>
    </div>
    ${riskDetail(inputs, results)}
    <div class="footer">Generated by Lemnisca Torch. Predictions are bounded by empirical correlations (±30–40% on kLa) and do not replace pilot experimentation.</div>
  </div>

  <div class="page">
    <div class="header">
      <div class="brand">LEMNISCA <span class="brand-accent">·</span> TORCH</div>
      <div class="header-meta">Scale-up risk assessment · ${date}</div>
    </div>
    ${projections(inputs, results)}
    <div class="footer">Generated by Lemnisca Torch. Predictions are bounded by empirical correlations (±30–40% on kLa) and do not replace pilot experimentation.</div>
  </div>

  <div class="page">
    <div class="header">
      <div class="brand">LEMNISCA <span class="brand-accent">·</span> TORCH</div>
      <div class="header-meta">Scale-up risk assessment · ${date}</div>
    </div>
    ${reliability(inputs)}
    <div class="footer">Generated by Lemnisca Torch. Predictions are bounded by empirical correlations (±30–40% on kLa) and do not replace pilot experimentation.</div>
  </div>

</body>
</html>`;
}
