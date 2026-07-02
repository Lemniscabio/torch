// Heat-removal capacity check: U·A·LMTD / Q_metabolic.
//
// ratio ≥ 1 → jacket can remove all metabolic heat at steady state.
// ratio < 1 → heat removal insufficient; suggest internal cooling coils.

import type { ImpellerType, OrganismSpecies } from "../../types";
import { IMPELLER_HEAT_FRACTION } from "../../constants";
import { deriveMetabolicHeat, deriveCoolingWaterOutlet, deriveLmtd } from "./heat_balance";
import { deriveJacketArea }     from "./area";
import { deriveBrothFilmCoeff, deriveJacketFilmCoeff, getWallProperties } from "./coefficients";
import { deriveOverallU }       from "./u_overall";
import type { JacketAreaResult } from "./area";
import type { BrothFilmResult, JacketFilmResult, WallProperties } from "./coefficients";
import type { OverallUResult }  from "./u_overall";

export interface HeatCapacityInputs {
  organism:       OrganismSpecies;
  our_mmol_Lh:    number;  // mmol/L/h — OUR from measured/estimated assessment input path
  volume_litres:  number;  // L        — culture volume
  t_process:      number;  // °C
  t_cw_in:        number;  // °C
  flowrate_lpm:   number;  // L/min
  D_T:            number;  // m  — vessel diameter
  H_L:            number;  // m  — liquid height
  d_imp:          number;  // m  — impeller diameter
  N_rps:          number;  // rps
  mu:             number;  // Pa·s — broth viscosity
  impeller_type:  ImpellerType;
  impeller_power_w: number; // W — gassed shaft power (all impellers), dissipated as heat
}

export interface HeatCapacityResult {
  // Heat generation
  Q_metabolic_kW: number;
  Q_impeller_kW:  number;  // impeller power dissipated as heat
  Q_generated_kW: number;  // metabolic + impeller
  // Cooling water
  t_cw_out:       number;
  dt_cw:          number;
  // Geometry
  area:           JacketAreaResult;
  // Coefficients
  broth_film:     BrothFilmResult;
  jacket_film:    JacketFilmResult;
  wall:           WallProperties;
  u_result:       OverallUResult;
  // LMTD
  lmtd:           number;
  // Capacity
  Q_available_kW: number;  // U·A·LMTD / 1000
  ratio:          number;  // Q_available / Q_metabolic
  sufficient:     boolean;
  suggestion?:    string;
}

export function runHeatCapacityCheck(inputs: HeatCapacityInputs): HeatCapacityResult {
  const Q_metabolic_kW = deriveMetabolicHeat(inputs.our_mmol_Lh, inputs.volume_litres, inputs.organism);
  const Q_impeller_kW  = (IMPELLER_HEAT_FRACTION * inputs.impeller_power_w) / 1000; // W → kW
  const Q_generated_kW = Q_metabolic_kW + Q_impeller_kW;

  const { t_cw_out, dt_cw, m_cw_kgs: _ } = deriveCoolingWaterOutlet(
    Q_generated_kW, inputs.flowrate_lpm, inputs.t_cw_in,
  );

  const lmtd = deriveLmtd(inputs.t_process, inputs.t_cw_in, t_cw_out);

  const area        = deriveJacketArea(inputs.D_T, inputs.H_L);
  const broth_film  = deriveBrothFilmCoeff(inputs.D_T, inputs.d_imp, inputs.N_rps, inputs.mu, inputs.impeller_type);
  const jacket_film = deriveJacketFilmCoeff(inputs.D_T, inputs.flowrate_lpm);
  const wall        = getWallProperties(inputs.volume_litres);
  const u_result    = deriveOverallU(
    broth_film.h_i,
    jacket_film.h_o,
    wall.k_W_mK,
    wall.thickness_m,
    wall.material,
  );

  const Q_available_kW = (u_result.U * area.A_total * lmtd) / 1000; // W → kW
  const ratio          = Q_generated_kW > 0 ? Q_available_kW / Q_generated_kW : Infinity;
  const sufficient     = ratio >= 1;

  return {
    Q_metabolic_kW,
    Q_impeller_kW,
    Q_generated_kW,
    t_cw_out,
    dt_cw,
    area,
    broth_film,
    jacket_film,
    wall,
    u_result,
    lmtd,
    Q_available_kW,
    ratio,
    sufficient,
    suggestion: sufficient ? undefined : "Add internal cooling coils to increase available heat-transfer area.",
  };
}
