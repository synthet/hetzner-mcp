import { z } from "zod";

export const resourceRefSchema = z
  .string()
  .min(1, "Resource reference is required")
  .max(128);

export const resourceNameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/i, "Invalid resource name format");

export const labelsSchema = z
  .record(z.string().min(1).max(63), z.string().max(255))
  .optional();

export const confirmationSchema = z.object({
  confirm: z.literal(true),
  confirmation_text: z.string().min(1),
});

export const serverRefSchema = resourceRefSchema;

export const trafficLevelSchema = z.enum(["low", "medium", "high"]);
export const budgetSensitivitySchema = z.enum(["low", "medium", "high"]);
export const auditFocusSchema = z.enum([
  "cost",
  "security",
  "reliability",
  "all",
]);

export const metricsTypeSchema = z.enum(["cpu", "disk", "network"]);
