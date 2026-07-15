import { z } from "zod";

// ── Content ──────────────────────────────────────────────────────
export const contentCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  body: z.string().min(1, "Body is required").max(50000),
  topic: z.string().max(200).optional(),
  tags: z.string().default("[]"),
  brief: z.string().max(2000).optional(),
  tone: z
    .enum(["professional", "casual", "formal", "friendly", "persuasive", "urgent"])
    .default("professional"),
  contentType: z
    .enum(["social_post", "blog", "email", "ad_copy", "video_script", "landing_page"])
    .default("social_post"),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  targetKeyword: z.string().max(200).optional(),
  locationTag: z.string().max(200).optional(),
  status: z
    .enum(["draft", "ready", "published", "archived"])
    .default("draft"),
});

export const contentUpdateSchema = contentCreateSchema.partial().omit({});

// ── Scheduled Post ────────────────────────────────────────────────
export const scheduledPostSchema = z.object({
  contentId: z.string().min(1, "contentId is required"),
  platform: z.string().min(1, "Platform is required"),
  scheduledFor: z.string().datetime({ message: "Valid ISO datetime required" }),
  idempotencyKey: z.string().min(1, "idempotencyKey is required"),
  leadCaptureEmail: z.string().email().optional().or(z.literal("")),
});

// ── Comment ───────────────────────────────────────────────────────
export const commentCreateSchema = z.object({
  text: z.string().min(1, "Comment text is required").max(10000),
  contentId: z.string().min(1, "contentId is required"),
  mentions: z.string().default("[]"),
});

// ── Audit ────────────────────────────────────────────────────────
export const auditRunSchema = z.object({
  type: z.enum(["seo", "accessibility", "performance", "security", "links"]),
  url: z.string().url("Valid URL required"),
});

// ── User ─────────────────────────────────────────────────────────
export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(200),
  role: z.enum(["admin", "user", "editor"]).default("user"),
});

// ── Settings ──────────────────────────────────────────────────────
export const settingUpsertSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string(),
});

// ── GHL Sync Contact ──────────────────────────────────────────────
export const ghlSyncSchema = z.object({
  contactName: z.string().min(1, "Contact name is required").max(200),
  email: z.string().email().optional().or(z.literal("")),
  action: z.string().min(1, "Action is required").max(200),
  pipeline: z.string().max(200).optional(),
});

// ── Connection ────────────────────────────────────────────────────
export const connectionUpdateSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  status: z.enum(["connected", "disconnected", "expired"]).default("disconnected"),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
});

// ── OAuth Callback ────────────────────────────────────────────────
export const oauthCallbackSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  userId: z.string().min(1, "userId is required"),
  connectedAccountId: z.string().min(1, "connectedAccountId is required"),
});

// ── AI Generate ──────────────────────────────────────────────────
export const aiGenerateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000),
  tone: z
    .enum(["professional", "casual", "formal", "friendly", "persuasive", "urgent"])
    .default("professional"),
  length: z
    .enum(["short", "medium", "long"])
    .default("medium"),
  contentType: z
    .enum(["social_post", "blog", "email", "ad_copy", "video_script", "landing_page"])
    .default("social_post"),
});

// ── GHL Business OS ───────────────────────────────────────────────
export const ghlContactSchema = z.object({
  firstName: z.string().max(200).optional(),
  lastName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  tags: z.string().default("[]"),
  customFields: z.string().default("{}"),
  leadScore: z.number().int().min(0).max(100).default(0),
  source: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "archived"]).default("active"),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
});

export const ghlPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name required").max(200),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  stages: z.array(z.object({
    name: z.string().min(1),
    position: z.number().int().default(0),
  })).optional(),
});

export const ghlOpportunitySchema = z.object({
  pipelineId: z.string().min(1, "Pipeline ID required"),
  stageId: z.string().optional(),
  contactId: z.string().optional(),
  title: z.string().min(1, "Title required").max(500),
  value: z.number().min(0).default(0),
  status: z.enum(["open", "won", "lost"]).default("open"),
  probability: z.number().int().min(0).max(100).default(50),
  assignedTo: z.string().optional(),
});

export const ghlTaskSchema = z.object({
  contactId: z.string().optional(),
  title: z.string().min(1, "Task title required").max(500),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  assignedTo: z.string().optional(),
});

export const ghlCalendarEventSchema = z.object({
  contactId: z.string().optional(),
  title: z.string().min(1, "Title required").max(500),
  description: z.string().optional(),
  startTime: z.string().datetime({ message: "Valid ISO datetime required" }),
  endTime: z.string().datetime().optional().or(z.literal("")),
  type: z.enum(["appointment", "meeting", "reminder", "class"]).default("appointment"),
  location: z.string().optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  calendarId: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

export const ghlSmsLogSchema = z.object({
  contactId: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  to: z.string().min(1),
  from: z.string().optional(),
  body: z.string().min(1),
  status: z.enum(["sent", "delivered", "failed"]).default("sent"),
});

export const ghlCallLogSchema = z.object({
  contactId: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  to: z.string().min(1),
  from: z.string().optional(),
  duration: z.number().int().min(0).default(0),
  status: z.enum(["completed", "missed", "voicemail", "no_answer"]).default("completed"),
  recordingUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const ghlPaymentSchema = z.object({
  contactId: z.string().optional(),
  invoiceId: z.string().optional(),
  amount: z.number().min(0),
  currency: z.string().default("USD"),
  method: z.string().optional(),
  status: z.enum(["pending", "completed", "failed", "refunded"]).default("pending"),
  transactionId: z.string().optional(),
  subscriptionId: z.string().optional(),
  planName: z.string().optional(),
});

export const ghlInvoiceSchema = z.object({
  contactId: z.string().optional(),
  invoiceNumber: z.string().min(1),
  items: z.string().default("[]"),
  subtotal: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  dueDate: z.string().datetime().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const ghlReviewSchema = z.object({
  contactId: z.string().optional(),
  platform: z.enum(["google", "facebook", "yelp", "bbb"]),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().optional(),
  reviewerName: z.string().optional(),
  reviewerUrl: z.string().optional(),
});

export const ghlAutomationSchema = z.object({
  name: z.string().min(1, "Name required").max(200),
  description: z.string().optional(),
  trigger: z.string().min(1, "Trigger required"),
  actions: z.string().default("[]"),
  conditions: z.string().default("[]"),
  status: z.enum(["active", "paused", "draft"]).default("active"),
});

export const ghlFormSchema = z.object({
  name: z.string().min(1, "Name required").max(200),
  description: z.string().optional(),
  fields: z.string().default("[]"),
  type: z.enum(["contact", "quote", "survey", "intake"]).default("contact"),
  status: z.enum(["active", "archived"]).default("active"),
});

export const ghlWebhookSchema = z.object({
  name: z.string().min(1, "Name required").max(200),
  url: z.string().url("Valid URL required"),
  events: z.string().default("[]"),
  secret: z.string().optional(),
  status: z.enum(["active", "paused"]).default("active"),
});

// ── GHL Bulk Import ──────────────────────────────────────────────
export const ghlBulkContactSchema = z.object({
  items: z.array(ghlContactSchema).min(1).max(500),
});

// Type exports
export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;
export type ScheduledPostInput = z.infer<typeof scheduledPostSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type AuditRunInput = z.infer<typeof auditRunSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type SettingUpsertInput = z.infer<typeof settingUpsertSchema>;
export type GhlSyncInput = z.infer<typeof ghlSyncSchema>;
export type ConnectionUpdateInput = z.infer<typeof connectionUpdateSchema>;
export type OauthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type AiGenerateInput = z.infer<typeof aiGenerateSchema>;
export type GhlContactInput = z.infer<typeof ghlContactSchema>;
export type GhlOpportunityInput = z.infer<typeof ghlOpportunitySchema>;
export type GhlTaskInput = z.infer<typeof ghlTaskSchema>;
export type GhlCalendarEventInput = z.infer<typeof ghlCalendarEventSchema>;
export type GhlPaymentInput = z.infer<typeof ghlPaymentSchema>;
export type GhlInvoiceInput = z.infer<typeof ghlInvoiceSchema>;
