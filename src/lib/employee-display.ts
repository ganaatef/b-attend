/**
 * Locale-aware employee display name helper.
 *
 * When locale is "ar", prefer arabicName → fullName fallback.
 * Otherwise use fullName.
 */
export function employeeDisplayName(
  employee: { fullName: string; arabicName?: string | null },
  locale?: string,
): string {
  if (locale === "ar" && employee.arabicName) return employee.arabicName;
  return employee.fullName;
}
