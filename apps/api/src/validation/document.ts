import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().default("")
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  content: z.string().optional()
}).refine((value) => value.title !== undefined || value.content !== undefined, {
  message: "At least one field must be provided"
});

export const addEditorSchema = z.object({
  email: z.string().email()
});
