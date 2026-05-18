// D5 — Superficial gas velocity.

export interface GasVelocityResult {
  q_gas: number; // m³/s
  vs:    number; // m/s
}

export function deriveGasVelocity(
  vvm: number,
  volume_litres: number,
  a_cross: number,
): GasVelocityResult {
  const q_gas = (vvm * volume_litres) / (1000 * 60);
  const vs    = q_gas / a_cross;
  return { q_gas, vs };
}
