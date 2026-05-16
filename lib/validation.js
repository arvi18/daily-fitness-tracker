export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateDailyLog(body) {
  const requiredFields = [
    "date",
    "diet_summary",
    "intake_kcal",
    "protein_g",
    "steps",
    "burn_kcal",
    "net_diff",
  ];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `${field} is required`;
    }
  }

  if (!isValidDate(body.date)) return "date must be in YYYY-MM-DD format";
  if (typeof body.diet_summary !== "string") return "diet_summary must be a string";

  const numberFields = ["intake_kcal", "protein_g", "steps", "burn_kcal", "net_diff"];

  for (const field of numberFields) {
    if (!Number.isInteger(Number(body[field]))) {
      return `${field} must be an integer`;
    }
  }

  const intake = Number(body.intake_kcal);
  const burn = Number(body.burn_kcal);
  const expectedNet = intake - burn;

  if (Number(body.net_diff) !== expectedNet) {
    return `net_diff must equal intake_kcal - burn_kcal (${expectedNet})`;
  }

  if (body.water_ml !== undefined && body.water_ml !== null && body.water_ml !== "") {
    if (!Number.isInteger(Number(body.water_ml)) || Number(body.water_ml) < 0) {
      return "water_ml must be a non-negative integer";
    }
  }

  return null;
}

export function validateGoals(body) {
  const fields = [
    "steps_target",
    "protein_g_target",
    "intake_kcal_max",
    "net_diff_target",
    "water_ml_target",
  ];

  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `${field} is required`;
    }
    if (!Number.isInteger(Number(body[field]))) {
      return `${field} must be an integer`;
    }
  }

  if (Number(body.intake_kcal_max) <= 0) return "intake_kcal_max must be positive";
  if (Number(body.steps_target) <= 0) return "steps_target must be positive";
  if (Number(body.protein_g_target) <= 0) return "protein_g_target must be positive";
  if (Number(body.water_ml_target) <= 0) return "water_ml_target must be positive";

  return null;
}
