// Scale-dependent operating envelopes for aerobic microbial stirred-tank scale-up.
// Source: user-provided engineering ranges, 2026-05-07.
// Rationale: allowable maximum P/V, RPM, and aeration generally decrease with
// scale due to motor power, shaft/mechanical limits, heat removal, gas handling,
// foaming, and operating cost constraints.

export interface NumericRange {
  min: number;
  max: number;
}

export interface ScaleupOperatingRange {
  scale_label: string;
  reference_volume_l: number;
  volume_min_l: number;
  volume_max_l: number;
  max_pv_kw_m3: NumericRange;
  max_pv_w_m3: NumericRange;
  max_rpm: NumericRange;
  max_aeration_vvm: NumericRange;
}

// Volume bins are centred on the provided order-of-magnitude anchors:
// 1, 10, 100, 1,000, and 10,000 L. Boundaries use geometric midpoints.
export const SCALEUP_OPERATING_RANGES: ScaleupOperatingRange[] = [
  {
    scale_label: "1 L",
    reference_volume_l: 1,
    volume_min_l: 0,
    volume_max_l: Math.sqrt(10),
    max_pv_kw_m3: { min: 10, max: 15 },
    max_pv_w_m3: { min: 10000, max: 15000 },
    max_rpm: { min: 1000, max: 1500 },
    max_aeration_vvm: { min: 2.0, max: 3.0 },
  },
  {
    scale_label: "10 L",
    reference_volume_l: 10,
    volume_min_l: Math.sqrt(10),
    volume_max_l: Math.sqrt(1000),
    max_pv_kw_m3: { min: 5, max: 10 },
    max_pv_w_m3: { min: 5000, max: 10000 },
    max_rpm: { min: 600, max: 1000 },
    max_aeration_vvm: { min: 1.5, max: 2.0 },
  },
  {
    scale_label: "100 L",
    reference_volume_l: 100,
    volume_min_l: Math.sqrt(1000),
    volume_max_l: Math.sqrt(100000),
    max_pv_kw_m3: { min: 3, max: 5 },
    max_pv_w_m3: { min: 3000, max: 5000 },
    max_rpm: { min: 300, max: 500 },
    max_aeration_vvm: { min: 1.0, max: 1.5 },
  },
  {
    scale_label: "1,000 L",
    reference_volume_l: 1000,
    volume_min_l: Math.sqrt(100000),
    volume_max_l: Math.sqrt(10000000),
    max_pv_kw_m3: { min: 2, max: 3 },
    max_pv_w_m3: { min: 2000, max: 3000 },
    max_rpm: { min: 150, max: 250 },
    max_aeration_vvm: { min: 0.8, max: 1.2 },
  },
  {
    scale_label: "10,000 L",
    reference_volume_l: 10000,
    volume_min_l: Math.sqrt(10000000),
    volume_max_l: Infinity,
    max_pv_kw_m3: { min: 1.5, max: 2.5 },
    max_pv_w_m3: { min: 1500, max: 2500 },
    max_rpm: { min: 70, max: 120 },
    max_aeration_vvm: { min: 0.5, max: 1.0 },
  },
];

export function getScaleupOperatingRange(volume_l: number): ScaleupOperatingRange {
  return (
    SCALEUP_OPERATING_RANGES.find(
      (range) => volume_l >= range.volume_min_l && volume_l < range.volume_max_l,
    ) ?? SCALEUP_OPERATING_RANGES[SCALEUP_OPERATING_RANGES.length - 1]
  );
}
