// Smoke test for the calculation engine.
// Runs a known-good input through runAssessment() and asserts the output
// shape + a few invariants. Catches obvious regressions during the lift-shift.
//
// Run with: cd packages/tea-core && npm install && npm test

import { describe, it, expect } from 'vitest';
import { runAssessment } from '../engine';
import type { ProcessInputs } from '../types';

const baseInput: ProcessInputs = {
  organism_class: 'bacteria',
  organism_species: 'e_coli',
  v_lab: 10,
  v_target: 5000,
  scaleup_criterion: 'power_per_volume',
  h_d_lab: 1.2,
  h_d_target: 1.5,
  n_impellers: 2,
  impeller_type: 'rushton',
  rpm: 600,
  vvm: 1.0,
  biomass_cdw_g_l: 40,
  our_mode: 'estimate',
  o2_inlet: 20.9,
  do_setpoint: 30,
  process_type: 'batch',
  temperature: 37,
  t_cw_inlet: 12,
};

describe('runAssessment (smoke)', () => {
  const out = runAssessment(baseInput);

  it('returns all five risk domains', () => {
    expect(out.otr).toBeDefined();
    expect(out.mixing).toBeDefined();
    expect(out.shear).toBeDefined();
    expect(out.co2).toBeDefined();
    expect(out.heat).toBeDefined();
  });

  it('assigns a valid risk score to each domain', () => {
    const valid = ['low', 'moderate', 'high', 'critical'];
    expect(valid).toContain(out.otr.score);
    expect(valid).toContain(out.mixing.score);
    expect(valid).toContain(out.shear.score);
    expect(valid).toContain(out.co2.score);
    expect(valid).toContain(out.heat.score);
  });

  it('computes a primary bottleneck (or null when everything is low)', () => {
    const allLow =
      out.otr.score === 'low' &&
      out.mixing.score === 'low' &&
      out.shear.score === 'low' &&
      out.co2.score === 'low' &&
      out.heat.score === 'low';
    if (allLow) {
      expect(out.primary_bottleneck.domain).toBeNull();
    } else {
      expect(['otr', 'mixing', 'shear', 'co2', 'heat']).toContain(
        out.primary_bottleneck.domain
      );
      expect(out.primary_bottleneck.statement.length).toBeGreaterThan(20);
    }
  });

  it('returns derived parameters with positive geometries', () => {
    expect(out.derived.our_peak).toBeGreaterThan(0);
    expect(out.derived.lab_geometry.volume_m3).toBeGreaterThan(0);
    expect(out.derived.target_geometry.volume_m3).toBeGreaterThan(
      out.derived.lab_geometry.volume_m3
    );
    expect(out.derived.n_rps).toBe(baseInput.rpm / 60);
  });

  it('flags is an array (may be empty)', () => {
    expect(Array.isArray(out.flags)).toBe(true);
  });
});

describe('runAssessment — fed-batch path', () => {
  it('accepts a fed-batch input and produces a result', () => {
    const out = runAssessment({
      ...baseInput,
      process_type: 'fed_batch',
      feeding_frequency: '10_30min',
    });
    expect(out.mixing).toBeDefined();
    expect(out.mixing.t_feed_s).toBeDefined();
  });
});

describe('runAssessment — measured OUR path', () => {
  it('uses measured OUR when provided', () => {
    const out = runAssessment({ ...baseInput, our_mode: 'measured', our_measured: 120 });
    expect(out.derived.our_peak).toBeCloseTo(120, 1);
  });
});
