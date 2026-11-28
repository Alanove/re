export const ROLES = ["OWNER", "ADULT", "CHILD"] as const;
export type Role = (typeof ROLES)[number];

export function isAdultRole(role: Role): boolean {
  return role === "OWNER" || role === "ADULT";
}

export function canManageInvites(role: Role): boolean {
  return role === "OWNER";
}

export function canAccessWork(role: Role): boolean {
  return isAdultRole(role);
}

export function canAccessPlan(role: Role): boolean {
  return isAdultRole(role);
}

export function canAccessSavings(role: Role): boolean {
  return isAdultRole(role);
}

export function canAccessReports(role: Role): boolean {
  return isAdultRole(role);
}

export function canAddIncome(role: Role): boolean {
  return isAdultRole(role);
}

export function canManageDebts(role: Role): boolean {
  return isAdultRole(role);
}
