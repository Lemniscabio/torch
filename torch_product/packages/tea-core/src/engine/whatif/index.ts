export type {
  ModificationId,
  ModificationDefinition,
  WhatIfParams,
  WhatIfTargetOtr,
  WhatIfTargetMixing,
  WhatIfTargetShear,
  WhatIfTargetCo2,
  WhatIfTargetHeat,
  WhatIfResult,
} from "./types";

export {
  OXYGEN_LEVELS_DEFAULT,
  MODIFICATION_CATALOG,
  MODIFICATION_CONFLICTS,
  oxygenLevelsFromBaseline,
  applyModifications,
  canApplyModification,
  stepOxygenLevel,
  stepFeedFrequency,
} from "./modifications";

export { runWhatIf } from "./runner";
