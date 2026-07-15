// ===================================================================
// Shared form field components for public forms.
// ===================================================================

"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Control } from "react-hook-form";

type FormControl = any;

export function TextField({
  control,
  name,
  label,
  placeholder,
  description,
  type = "text",
  autoComplete,
  required,
}: {
  control: FormControl;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
          </FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              {...field}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField({
  control,
  name,
  label,
  placeholder,
  description,
  required,
  min,
}: {
  control: FormControl;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  min?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min={min}
              placeholder={placeholder}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
              }
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField({
  control,
  name,
  label,
  placeholder,
  description,
  rows = 4,
}: {
  control: FormControl;
  name: string;
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea rows={rows} placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "CAFE", label: "Cafe" },
  { value: "CLOUD_KITCHEN", label: "Cloud kitchen" },
  { value: "CENTRAL_KITCHEN", label: "Central kitchen" },
  { value: "RETAIL_CHAIN", label: "Retail chain" },
  { value: "GYM", label: "Gym" },
  { value: "CLINIC", label: "Clinic" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "SECURITY_COMPANY", label: "Security company" },
  { value: "CLEANING_COMPANY", label: "Cleaning company" },
  { value: "MULTI_BRANCH_OPS", label: "Multi-branch operations" },
  { value: "OTHER", label: "Other" },
];

export function BusinessTypeSelect({
  control,
  name,
  label,
  required,
  placeholder = "Select business type",
}: {
  control: FormControl;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
          </FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {BUSINESS_TYPES.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function PlanSelect({
  control,
  name,
  label,
  plans,
  required,
}: {
  control: FormControl;
  name: string;
  label: string;
  plans: { id: string; name: string; slug: string; priceMonthly: number; isCustom: boolean }[];
  required?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
          </FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.isCustom
                    ? " · Custom"
                    : p.slug === "trial"
                      ? " · Free 14-day trial"
                      : ` · EGP ${p.priceMonthly}/mo`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function BillingCycleSelect({
  control,
  name,
  label,
  required,
}: {
  control: FormControl;
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="ml-0.5 text-brand-danger">*</span> : null}
          </FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select billing cycle" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="ANNUAL">Annual (save ~17%)</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Form };
