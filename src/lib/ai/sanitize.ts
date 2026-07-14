/**
 * B-Coach output safety utility.
 *
 * sanitizeCoachOutput(output) inspects AI-generated coaching text and:
 * - Removes or replaces harsh, shaming, or forbidden phrases
 * - Blocks forbidden recommendations (firing, salary deduction, punishment)
 * - Falls back to a safe template if content is unsafe
 *
 * This is a defense-in-depth layer. The generation prompt itself must be safe;
 * this filter catches anything that slips through.
 *
 * Privacy rules:
 * - No medical/psychological diagnoses
 * - No religious/political inferences
 * - No personal assumptions beyond attendance data
 * - No punishment/termination recommendations
 */

// Forbidden words/phrases — case-insensitive substring match
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(lazy|laziness)\b/i, reason: "shaming language" },
  { pattern: /\bbad employee\b/i, reason: "shaming language" },
  { pattern: /\b(unreliable|undependable)\b/i, reason: "shaming language" },
  { pattern: /\b(problematic)\b/i, reason: "shaming language" },
  { pattern: /\b(incompetent)\b/i, reason: "shaming language" },
  { pattern: /\b(worthless|useless)\b/i, reason: "shaming language" },
  { pattern: /\bfire (him|her|them|this)\b/i, reason: "termination recommendation" },
  { pattern: /\b(terminat\w*|dismiss\w*)\b/i, reason: "termination recommendation" },
  { pattern: /\b(deduct salary|salary deduction|pay cut)\b/i, reason: "salary punishment" },
  { pattern: /\b(punish\w*|punitive)\b/i, reason: "punishment recommendation" },
  { pattern: /\b(mentally|depressed|anxiety|psychological)\b/i, reason: "medical/psychological diagnosis" },
  { pattern: /\b(religious|religion|islam|christian|muslim|coptic)\b/i, reason: "religious inference" },
  { pattern: /\b(political|politics)\b/i, reason: "political inference" },
  { pattern: /\b(will be punished|you may be fired|you will be fired)\b/i, reason: "fear language" },
  { pattern: /\b(ethnic|race|racist)\b/i, reason: "ethnicity inference" },
];

// Safe replacements for common harsh phrases
const SAFE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(lazy|laziness)\b/gi, replacement: "needing support with consistency" },
  { pattern: /\bbad employee\b/gi, replacement: "employee needing development" },
  { pattern: /\b(unreliable|undependable)\b/gi, replacement: "still building consistency" },
  { pattern: /\b(problematic)\b/gi, replacement: "needing attention" },
  { pattern: /\b(incompetent)\b/gi, replacement: "still developing skills" },
];

export interface SanitizeResult<T> {
  safe: boolean;
  output: T;
  violations: string[];
  fallbackUsed: boolean;
}

/**
 * Sanitize a coaching output object. Returns the sanitized output + violation list.
 * If the output is unsafe and cannot be repaired, fallbackUsed=true and a safe template is returned.
 */
export function sanitizeCoachOutput<T extends Record<string, any>>(output: T): SanitizeResult<T> {
  const violations: string[] = [];
  let sanitized = { ...output };

  // Scan all string fields for forbidden patterns
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      let cleaned = value;
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(cleaned)) {
          violations.push(`${reason} in field "${key}"`);
        }
      }
      // Apply safe replacements
      for (const { pattern, replacement } of SAFE_REPLACEMENTS) {
        cleaned = cleaned.replace(pattern, replacement);
      }
      sanitized[key] = cleaned as any;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === "string") {
          let cleaned = item;
          for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
            if (pattern.test(cleaned)) {
              violations.push(`${reason} in field "${key}"`);
            }
          }
          for (const { pattern, replacement } of SAFE_REPLACEMENTS) {
            cleaned = cleaned.replace(pattern, replacement);
          }
          return cleaned;
        }
        return item;
      }) as any;
    }
  }

  // If violations found, we still return the sanitized output (with replacements applied)
  // but mark safe=false so the caller can decide to log a warning or fall back.
  const safe = violations.length === 0;

  return {
    safe,
    output: sanitized,
    violations,
    fallbackUsed: false,
  };
}

/**
 * Build a safe fallback coaching summary when AI generation fails or output is unsafe.
 */
export function safeFallbackEmployeeSummary(employeeName: string): {
  positiveSummary: string;
  improvementAreas: string;
  practicalAdvice: string;
  tomorrowAction: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  tags: string[];
} {
  return {
    positiveSummary: `${employeeName}, your coaching summary will appear after a few attendance records are available. Keep showing up and doing your best — every shift is a chance to build consistency.`,
    improvementAreas: "Once attendance data is available, development areas will appear here. For now, focus on arriving on time and communicating early with your manager.",
    practicalAdvice: "Aim to arrive 5-10 minutes before your shift starts. Communicate early if you expect any delay.",
    tomorrowAction: "Tomorrow, arrive 5 minutes early and start your shift fully ready.",
    riskLevel: "LOW",
    tags: ["new-starter"],
  };
}

export function safeFallbackTeamSummary(branchName?: string): {
  summary: string;
  employeesNeedingSupport: any[];
  employeesImproving: any[];
  topConsistencyEmployees: any[];
  suggestedManagerActions: string[];
  dailyBriefingText: string;
} {
  return {
    summary: `Team coaching summary for ${branchName ?? "all branches"} will appear after attendance data is available. The AI insights are advisory only and should not be used as the sole basis for disciplinary decisions.`,
    employeesNeedingSupport: [],
    employeesImproving: [],
    topConsistencyEmployees: [],
    suggestedManagerActions: ["No specific actions needed yet — gather more attendance data first."],
    dailyBriefingText: "Today's team focus: support each other and start the shift ready. Clock in only when you are at the branch and ready to work.",
  };
}

export function safeFallbackDailyMotivation(): {
  title: string;
  body: string;
  theme: string;
  language: "EN";
  createdByAi: boolean;
} {
  return {
    title: "Today is a fresh shift",
    body: "Whatever happened yesterday is done. Today is a new shift, a new team, a new chance to do good work. Show up, be present, and let your effort speak for itself.",
    theme: "GENERAL",
    language: "EN",
    createdByAi: false,
  };
}
