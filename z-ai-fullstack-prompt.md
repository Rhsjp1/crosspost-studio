Build a Next.js 15 app called "Crosspost Studio — Micro-Niche App Factory" with a dark theme sidebar dashboard. Prisma ORM with PostgreSQL, NextAuth.js for auth, Zustand for client state, Tailwind CSS, TanStack Query. Login page with email/password (default: admin@local / admin123). All sections lazy-loaded via next/dynamic with a SectionLoading spinner.

13 SIDEBAR SECTIONS:

1. DASHBOARD — Stats cards (Total Posts, Scheduled, Connections, MRR), activity chart (last 7 days), recent activity audit log, platform distribution breakdown (Twitter, LinkedIn, Instagram, Facebook, TikTok, YouTube), recent drafts list.

2. CONTENT STUDIO — Content CRUD with title, tone selector (professional/friendly/casual/playful/authoritative/humorous/inspirational), platform selector (Twitter/X, Instagram, Facebook, LinkedIn, YouTube, TikTok, Pinterest), body textarea with char count, tags input. "Generate" button to AI-generate draft from title. Saved drafts table with edit/delete. BULK IMPORT: textarea for pasting multiple posts (blank-line delimited, format: "Title\nBody"), with bulk tone/type/platform defaults and "Import All" button. API: /api/content (CRUD), /api/content/bulk (POST batch).

3. AI COMPOSER — Dedicated section with prompt input, tone selector, content type selector (social_post/blog_post/email/ad_copy/video_script), "Generate" button, rich output display with copy/regenerate. API: /api/composer, /api/ai/generate.

4. APPROVALS — Pending review queue showing content waiting for approval, each with Approve/Reject buttons, pending count badge, status transitions (pending → approved/rejected). API: /api/content (status field).

5. SCHEDULER — Scheduled posts grouped by date, platform name, status badge, scheduled time per card, "Schedule" form. API: /api/scheduled, /api/scheduled/run-due.

6. CONNECTIONS — 8 platforms: Facebook, Instagram, Twitter/X, LinkedIn, YouTube, TikTok, Google Business (GHL), Pinterest. OAuth connect per platform via Composio v3, multiple accounts per platform, connection status badges (connected/initializing/expired). API: /api/connections, /api/connections/callback.

7. HISTORY — Chronological audit trail: action type, platform badge, details text, timestamp. API: /api/history.

8. AUDITS — 4 audit types (website_check, seo_analysis, content_quality, social_media), each with "Run Audit" button, score badges (A-F), results display. API: /api/audits.

9. APP BUILDER — Prompt input + monthly price spinner, 6 quick-start templates (Fitness Planner, Content Planner, Budget Tracker, Meal Planner, Habit Tracker, Study Scheduler). Generated apps list with View/Deploy/Delete, subscriber count, deploy count. API: /api/apps, /api/apps/[id], /api/apps/[id]/deploy, /api/apps/[id]/subscribers.

10. CONTENT ENGINE — 5 categories (Hooks with 4 subtypes: problem/result/mistake/curiosity, Scripts with 2 subtypes, Captions with 2, Landing Pages with 1, Emails with 2), platform filter (TikTok/Instagram/YouTube/All), template CRUD, variable substitution, "Generate Content" button. 5x5 Framework: 5 prompt inputs stitched into cohesive content. API: /api/content-templates, /api/ai/generate.

11. LARK WORKSPACE — 5 tabs (Calendar, Mail, Messages, Docs, Tasks). Each tab: two-column layout with list panel + create form. Quick command runner. Auto-refresh every 30s. API: /api/lark (root), /api/lark/calendar, /api/lark/mail, /api/lark/messages, /api/lark/docs, /api/lark/tasks.

12. GOHIGHLEVEL CRM — 13 tabs: Overview dashboard (stats cards), CRM (contact CRUD + bulk import CSV), Pipelines, Opportunities, Tasks, Calendar, SMS logs, Call logs, Payments, Invoices, Reviews (star ratings), Automations, Forms, Webhooks. Each with appropriate list/create forms. API: /api/ghl/contacts, /api/ghl/pipelines, /api/ghl/opportunities, /api/ghl/tasks, /api/ghl/calendar, /api/ghl/sms, /api/ghl/calls, /api/ghl/payments, /api/ghl/invoices, /api/ghl/reviews, /api/ghl/automations, /api/ghl/forms, /api/ghl/webhooks, /api/ghl/analytics.

13. SETTINGS — API keys section (Composio API key, GHL API key, SMTP settings, Cron secret), Business Profile section (name, city, state, services, keywords), Save button with toast notification. API: /api/settings, /api/business-profile.

PRISMA SCHEMA — 32 models: User, Account, Session, VerificationToken, Content, Comment, ScheduledPost, HistoryEvent, AuditRun, Connection, AppSetting, GhlSync, BusinessProfile, MicroApp, Deployment, Subscriber, ContentTemplate, plus 15 GHL models (GhlContact, GhlPipeline, GhlPipelineStage, GhlOpportunity, GhlTask, GhlCalendarEvent, GhlSmsLog, GhlCallLog, GhlPayment, GhlInvoice, GhlReview, GhlAutomation, GhlForm, GhlWebhook, GhlAnalytics).

Auth: NextAuth with credentials provider, admin@local seed user. Footer: "Crosspost Studio · Micro-niche app factory · Built with Next.js, Prisma & Composio". Mobile responsive with hamburger menu sidebar toggle.
