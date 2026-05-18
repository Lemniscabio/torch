"use client";

import { useMemo } from "react";
import type { ProcessInputs } from "@/lib/types";
import { runAssessment } from "@/lib/engine";
import type { StoredAssessment } from "@/lib/store";
import ResultsDashboard from "@/components/ResultsDashboard";

// Pre-loaded example inputs per /docs/lemnisca_dev_spec.md Section 4.5
const EXAMPLE_INPUTS: ProcessInputs = {
  organism_class: "bacteria",
  organism_species: "e_coli",
  v_lab: 10,
  v_target: 1_000,
  scaleup_criterion: "power_per_volume",
  impeller_type: "rushton",
  rpm: 1200,
  vvm: 0.8,
  biomass_cdw_g_l: 20,
  our_mode: "estimate",
  o2_inlet: 40,
  do_setpoint: 30,
  temperature: 37,
  t_cw_inlet: 25,
  cooling_water_flowrate_lpm: 50,
  h_d_lab: 1.2,
  h_d_target: 1.2,
  dt_ratio_lab: 0.3,
  dt_ratio_target: 0.3,
  n_impellers: 2,
  process_type: "batch",
  n_impellers_target: 2,
};

export default function ExamplePage() {
  const data = useMemo<StoredAssessment>(() => {
    const results = runAssessment(EXAMPLE_INPUTS);
    return {
      inputs: EXAMPLE_INPUTS,
      derived: results.derived,
      results,
    };
  }, []);

  return <ResultsDashboard data={data} isExample />;
}
