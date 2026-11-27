/** Academic departments a teacher account can be assigned to. */
export const DEPARTMENTS = [
  "Department of Biological and Physical Sciences",
  "Department of Computer Studies",
  "Department of Hospitality Management",
  "Department of Languages and Mass Communication",
  "Department of Management",
  "Department of Physical Education",
  "Department of Social Sciences and Humanities",
  "Teacher Education Department",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}
