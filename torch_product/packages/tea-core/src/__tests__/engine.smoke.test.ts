// Smoke test for the calculation engine.
// Runs a known-good input through runAssessment() and asserts the output
// shape + a few invariants. Catches obvious regressions during the lift-shift.
//
// Run with: cd packages/tea-core && npm install && npm test

import { describe, it, expect } from 'vitest';
import { runAssessment, ruszkowskiMixingTime } from '../engine';
import { deriveDesignJacketFlowLpm } from '../engine/heat/coefficients';
import { KLA_CO2_O2_RATIO } from '../constants';
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

describe('change-plan invariants', () => {
  const out = runAssessment(baseInput);

  // Change 3: total heat generation = metabolic + impeller, and impeller term is real.
  it('heat generation is metabolic + impeller at both scales', () => {
    for (const scale of [out.heat.lab, out.heat.target]) {
      expect(scale).toBeDefined();
      expect(scale!.q_generated).toBeCloseTo(scale!.q_metabolic + scale!.q_impeller, 6);
      expect(scale!.q_impeller).toBeGreaterThan(0);
      expect(scale!.q_generated).toBeGreaterThanOrEqual(scale!.q_metabolic);
    }
  });

  // 4D: kLa_CO2/kLa_O2 uses the D^0.5 penetration-theory ratio (~0.951), not 0.905.
  it('KLA_CO2_O2_RATIO is the sqrt of the diffusivity ratio', () => {
    expect(KLA_CO2_O2_RATIO).toBeCloseTo(Math.sqrt(1.9e-9 / 2.1e-9), 6);
  });

  // Change 1 + 4A: ruszkowskiMixingTime requires a real N and returns a finite,
  // positive mixing time (the old N_rps=1 placeholder is gone).
  it('ruszkowskiMixingTime returns a finite positive theta at a real N', () => {
    const theta = ruszkowskiMixingTime(2.0, 0.7, 500, 120 / 60);
    expect(Number.isFinite(theta)).toBe(true);
    expect(theta).toBeGreaterThan(0);
  });

  // Scale-dependent cooling: design jacket flow grows with vessel diameter, and a
  // normal high-OUR target no longer reports zero cooling from coolant starvation.
  it('design jacket flow scales up with vessel diameter', () => {
    const small = deriveDesignJacketFlowLpm(0.2);
    const large = deriveDesignJacketFlowLpm(1.7);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it('target scale reports non-zero cooling for a normal high-OUR case', () => {
    const hot = runAssessment({ ...baseInput, our_mode: 'measured', our_measured: 120 });
    expect(hot.heat.target.q_cool_max).toBeGreaterThan(0);
  });
});
