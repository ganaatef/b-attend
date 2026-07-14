// ===================================================================
// Shared Zod validation schemas for Phase 1.
// ===================================================================

import { z } from "zod";

export const businessTypeEnum = z.enum([
  "RESTAURANT",
  "CAFE",
  "CLOUD_KITCHEN",
  "CENTRAL_KITCHEN",
  "RETAIL_CHAIN",
  "GYM",
  "CLINIC",
  "WAREHOUSE",
  "SECURITY_COMPANY",
  "CLEANING_COMPANY",
  "MULTI_BRANCH_OPS",
  "OTHER",
]);

export const billingCycleEnum = z.enum(["MONTHLY", "ANNUAL"]);

// ---- Login -------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Lead (contact + request-demo) -------------------------------

export const leadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  company: z.string().optional(),
  phone: z
    .string()
    .min(6, "Enter a valid phone number.")
    .max(24, "Phone number is too long."),
  email: z.string().email("Enter a valid email address."),
  businessType: businessTypeEnum.optional(),
  employeesCount: z.coerce.number().int().min(0).max(100000).optional(),
  branchesCount: z.coerce.number().int().min(0).max(10000).optional(),
  message: z.string().max(2000, "Message is too long.").optional(),
  sourcePage: z.string().default("contact"),
});
export type LeadInput = z.infer<typeof leadSchema>;

// ---- Signup -------------------------------------------------------

export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    email: z.string().email("Enter a valid email address."),
    phone: z
      .string()
      .min(6, "Enter a valid phone number.")
      .max(24, "Phone number is too long."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long."),
    companyName: z.string().min(2, "Company name must be at least 2 characters."),
    businessType: businessTypeEnum,
    employeesCount: z.coerce
      .number()
      .int()
      .min(1, "Must have at least 1 employee.")
      .max(100000, "Contact us for 100k+ employees."),
    branchesCount: z.coerce
      .number()
      .int()
      .min(1, "Must have at least 1 branch.")
      .max(10000, "Contact us for 10k+ branches."),
    preferredPlanId: z.string().min(1, "Select a plan."),
    billingCycle: billingCycleEnum,
    city: z.string().min(1, "City is required.").max(120),
    message: z.string().max(2000, "Message is too long.").optional(),
  })
  .refine((v) => v.password !== "demo1234", {
    message: "Please choose a stronger password than the demo default.",
    path: ["password"],
  });
export type SignupInput = z.infer<typeof signupSchema>;
