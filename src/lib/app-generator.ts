/**
 * Prompt-to-App Generator
 *
 * Takes a plain-English prompt and returns a fully-formed MicroApp scaffold
 * with pages, config, and metadata — no external AI API needed.
 */

// ── Niche detection ────────────────────────────────────────────
const NICHE_KEYWORDS: Record<string, string[]> = {
  fitness: ["fitness", "gym", "workout", "exercise", "health", "personal trainer", "weight loss", "nutrition"],
  coaching: ["coaching", "mentor", "life coach", "business coach", "consultant", "advisory"],
  real_estate: ["real estate", "realtor", "property", "housing", "homes", "mortgage", "listing"],
  restaurant: ["restaurant", "food", "cafe", "bakery", "catering", "dining", "menu", "chef"],
  salon: ["salon", "beauty", "hair", "barber", "spa", "nail", "massage", "esthetician"],
  content_creator: ["content creator", "influencer", "social media", "youtube", "tiktok", "podcast", "blog"],
  ecommerce: ["ecommerce", "shop", "store", "retail", "product", "sell", "dropship", "amazon"],
  education: ["education", "course", "teach", "tutor", "learn", "school", "academy", "training"],
  saas: ["saas", "software", "app", "tool", "platform", "subscription", "dashboard", "analytics"],
  photography: ["photography", "photo", "video", "camera", "wedding", "portrait", "shoot", "studio"],
  legal: ["law", "legal", "attorney", "lawyer", "contract", "litigation", "firm"],
  dental: ["dental", "dentist", "teeth", "orthodontics", "smile", "oral"],
  auto: ["auto", "car", "mechanic", "dealership", "repair", "detailing", "body shop"],
  pet: ["pet", "dog", "cat", "grooming", "vet", "animal", "boarding"],
  cleaning: ["cleaning", "maid", "janitorial", "housekeeping", "pressure washing"],
  landscaping: ["landscaping", "lawn", "garden", "yard", "outdoor", "mowing", "tree"],
  therapy: ["therapy", "counseling", "mental health", "psychologist", "wellness", "mindfulness"],
  finance: ["finance", "accounting", "tax", "bookkeeping", "wealth", "financial", "cpa"],
};

// ── Brand color palettes per niche ─────────────────────────────
const BRAND_PALETTES: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
  default:       { primary: "#2563EB", secondary: "#1E40AF", accent: "#3B82F6", bg: "#F8FAFC" },
  fitness:       { primary: "#EF4444", secondary: "#B91C1C", accent: "#F97316", bg: "#FFF7ED" },
  coaching:      { primary: "#8B5CF6", secondary: "#6D28D9", accent: "#A78BFA", bg: "#F5F3FF" },
  real_estate:   { primary: "#0EA5E9", secondary: "#0369A1", accent: "#38BDF8", bg: "#F0F9FF" },
  restaurant:    { primary: "#DC2626", secondary: "#991B1B", accent: "#F59E0B", bg: "#FFFBEB" },
  salon:         { primary: "#EC4899", secondary: "#BE185D", accent: "#F472B6", bg: "#FDF2F8" },
  content_creator: { primary: "#06B6D4", secondary: "#0E7490", accent: "#22D3EE", bg: "#ECFEFF" },
  ecommerce:     { primary: "#10B981", secondary: "#047857", accent: "#34D399", bg: "#ECFDF5" },
  education:     { primary: "#6366F1", secondary: "#4338CA", accent: "#818CF8", bg: "#EEF2FF" },
  saas:          { primary: "#3B82F6", secondary: "#1D4ED8", accent: "#60A5FA", bg: "#EFF6FF" },
  photography:   { primary: "#1F2937", secondary: "#111827", accent: "#9CA3AF", bg: "#F9FAFB" },
  legal:         { primary: "#1E3A5F", secondary: "#0F2440", accent: "#3B6B9C", bg: "#F1F5F9" },
  dental:        { primary: "#14B8A6", secondary: "#0D9488", accent: "#5EEAD4", bg: "#F0FDFA" },
  auto:          { primary: "#475569", secondary: "#1E293B", accent: "#94A3B8", bg: "#F8FAFC" },
  pet:           { primary: "#F97316", secondary: "#C2410C", accent: "#FB923C", bg: "#FFF7ED" },
  cleaning:      { primary: "#22C55E", secondary: "#15803D", accent: "#86EFAC", bg: "#F0FDF4" },
  landscaping:   { primary: "#16A34A", secondary: "#166534", accent: "#4ADE80", bg: "#F0FDF4" },
  therapy:       { primary: "#A855F7", secondary: "#7E22CE", accent: "#C084FC", bg: "#FAF5FF" },
  finance:       { primary: "#059669", secondary: "#065F46", accent: "#34D399", bg: "#ECFDF5" },
};

// ── Helpers ────────────────────────────────────────────────────
function detectNiche(prompt: string): string {
  const lower = prompt.toLowerCase();
  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return niche;
  }
  return "default";
}

function extractAppName(prompt: string): string {
  // Try to find quoted app name
  const quoted = prompt.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1].trim();

  // Try "called X" or "named X" patterns
  const called = prompt.match(/(?:called|named)\s+([A-Z][A-Za-z0-9\s]{2,30})/);
  if (called) return called[1].trim();

  // Try "for [My Business Name]" pattern
  const forBiz = prompt.match(/for\s+([A-Z][A-Za-z0-9\s]{2,30})/);
  if (forBiz) return forBiz[1].trim();

  // Fallback: use first meaningful phrase
  const niche = detectNiche(prompt);
  const nicheLabel = niche.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${nicheLabel} Studio`;
}

function getColors(niche: string) {
  return BRAND_PALETTES[niche] ?? BRAND_PALETTES.default;
}

function nicheDescriptor(niche: string): string {
  const map: Record<string, string> = {
    default: "your business", fitness: "your fitness business", coaching: "your coaching practice",
    real_estate: "your real estate business", restaurant: "your restaurant", salon: "your salon",
    content_creator: "your content brand", ecommerce: "your online store", education: "your courses",
    saas: "your platform", photography: "your photography business", legal: "your law firm",
    dental: "your dental practice", auto: "your auto shop", pet: "your pet business",
    cleaning: "your cleaning service", landscaping: "your landscaping business",
    therapy: "your therapy practice", finance: "your financial services",
  };
  return map[niche] ?? "your business";
}

function nicheAction(niche: string): string {
  const map: Record<string, string> = {
    default: "Get Started", fitness: "Start Your Journey", coaching: "Book a Session",
    real_estate: "Browse Listings", restaurant: "View Menu", salon: "Book Appointment",
    content_creator: "Join the Community", ecommerce: "Shop Now", education: "Enroll Today",
    saas: "Try Free", photography: "View Portfolio", legal: "Schedule Consultation",
    dental: "Book Visit", auto: "Schedule Service", pet: "Book Grooming",
    cleaning: "Get a Quote", landscaping: "Request Estimate",
    therapy: "Book Session", finance: "Get in Touch",
  };
  return map[niche] ?? "Get Started";
}

// ── Page generators ───────────────────────────────────────────
function onboardingPage(appName: string, niche: string, colors: ReturnType<typeof getColors>): string {
  const desc = nicheDescriptor(niche);
  const action = nicheAction(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Welcome — ${appName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${colors.bg};color:#1E293B;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:16px;padding:48px 40px;max-width:520px;width:90%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.06)}
.badge{display:inline-block;background:${colors.primary};color:#fff;font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;margin-bottom:20px;letter-spacing:.5px;text-transform:uppercase}
h1{font-size:28px;font-weight:700;margin-bottom:12px;line-height:1.2}
p{font-size:16px;color:#64748B;line-height:1.6;margin-bottom:32px}
.steps{display:flex;justify-content:center;gap:12px;margin-bottom:32px}
.step{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;background:${colors.bg};color:${colors.primary};border:2px solid ${colors.primary}}
.step.active{background:${colors.primary};color:#fff}
.step.done{background:${colors.primary};color:#fff}
.form-group{text-align:left;margin-bottom:20px}
.form-group label{display:block;font-size:14px;font-weight:600;color:#334155;margin-bottom:6px}
.form-group input{width:100%;padding:12px 16px;border:2px solid #E2E8F0;border-radius:10px;font-size:15px;outline:none;transition:border-color .2s}
.form-group input:focus{border-color:${colors.primary}}
.btn{width:100%;padding:14px;background:${colors.primary};color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;transition:background .2s}
.btn:hover{background:${colors.secondary}}
.skip{margin-top:12px;display:inline-block;font-size:14px;color:#94A3B8;text-decoration:none}
.skip:hover{color:${colors.primary}}
</style>
</head>
<body>
<div class="card">
  <span class="badge">Step 1 of 3</span>
  <h1>Welcome to ${appName}</h1>
  <p>${action === "Get Started" ? "Let's personalize your experience" : "Let's set up " + desc + " in seconds"}.<br/>We'll have you up and running in under a minute.</p>
  <div class="steps">
    <div class="step active">1</div>
    <div class="step">2</div>
    <div class="step">3</div>
  </div>
  <div class="form-group">
    <label>Your Name</label>
    <input type="text" placeholder="Jane Smith" />
  </div>
  <div class="form-group">
    <label>Email Address</label>
    <input type="email" placeholder="jane@example.com" />
  </div>
  <button class="btn">${action}</button>
  <br/><a href="#" class="skip">Skip for now →</a>
</div>
</body>
</html>`;
}

function dashboardPage(appName: string, niche: string, colors: ReturnType<typeof getColors>): string {
  const desc = nicheDescriptor(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Dashboard — ${appName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F1F5F9;color:#1E293B}
.header{background:#fff;padding:16px 32px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between}
.header h1{font-size:20px;font-weight:700;color:${colors.primary}}
.header span{font-size:14px;color:#64748B}
.container{max-width:1100px;margin:32px auto;padding:0 24px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-bottom:32px}
.stat{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.stat .label{font-size:13px;color:#64748B;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.stat .value{font-size:32px;font-weight:700;margin-top:4px;color:${colors.primary}}
.stat .change{font-size:13px;color:#10B981;margin-top:4px}
.grid{display:grid;grid-template-columns:2fr 1fr;gap:20px}
.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card h2{font-size:16px;font-weight:700;margin-bottom:16px}
.card ul{list-style:none}
.card li{padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:14px;color:#475569;display:flex;justify-content:space-between}
.card li:last-child{border-bottom:none}
.badge-pill{font-size:11px;padding:3px 10px;border-radius:12px;font-weight:600}
.badge-green{background:#D1FAE5;color:#065F46}
.badge-blue{background:#DBEAFE;color:#1E40AF}
.badge-amber{background:#FEF3C7;color:#92400E}
.activity{margin-top:8px}
.activity li{display:flex;align-items:center;gap:12px}
.dot{width:8px;height:8px;border-radius:50%;background:${colors.primary};flex-shrink:0}
@media(max-width:768px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="header">
  <h1>📊 ${appName}</h1>
  <span>Dashboard Overview</span>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="label">Total Revenue</div><div class="value">$4,280</div><div class="change">↑ 12% this month</div></div>
    <div class="stat"><div class="label">Active Subscribers</div><div class="value">184</div><div class="change">↑ 8 this week</div></div>
    <div class="stat"><div class="label">Conversion Rate</div><div class="value">3.2%</div><div class="change">↑ 0.4% vs last month</div></div>
    <div class="stat"><div class="label">Page Views</div><div class="value">12.4k</div><div class="change">↑ 22% this week</div></div>
  </div>
  <div class="grid">
    <div class="card">
      <h2>Recent Activity</h2>
      <ul class="activity">
        <li><span class="dot"></span>New subscriber signed up — 2 min ago</li>
        <li><span class="dot"></span>Payment received — $29.99</li>
        <li><span class="dot"></span>Landing page viewed 48 times today</li>
        <li><span class="dot"></span>Faq page updated</li>
        <li><span class="dot"></span>Deployment published</li>
      </ul>
    </div>
    <div class="card">
      <h2>Quick Stats</h2>
      <ul>
        <li>Trial Signups <span class="badge-pill badge-green">24</span></li>
        <li>Paid Plans <span class="badge-pill badge-blue">160</span></li>
        <li>Churned <span class="badge-pill badge-amber">8</span></li>
      </ul>
    </div>
  </div>
</div>
</body>
</html>`;
}

function pricingPage(appName: string, niche: string, colors: ReturnType<typeof getColors>): string {
  const desc = nicheDescriptor(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Pricing — ${appName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${colors.bg};color:#1E293B;min-height:100vh}
.hero{text-align:center;padding:60px 24px 40px}
.hero h1{font-size:36px;font-weight:800;margin-bottom:8px}
.hero p{font-size:18px;color:#64748B}
.plans{display:flex;gap:24px;max-width:1000px;margin:0 auto;padding:0 24px 60px;flex-wrap:wrap;justify-content:center}
.plan{background:#fff;border-radius:16px;padding:32px;width:300px;box-shadow:0 4px 20px rgba(0,0,0,.06);position:relative;transition:transform .2s}
.plan:hover{transform:translateY(-4px)}
.plan.featured{border:2px solid ${colors.primary};transform:scale(1.04)}
.plan.featured:hover{transform:scale(1.04) translateY(-4px)}
.popular{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:${colors.primary};color:#fff;font-size:12px;font-weight:700;padding:4px 16px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px}
.plan h2{font-size:20px;font-weight:700;margin-bottom:4px}
.plan .subtitle{font-size:14px;color:#64748B;margin-bottom:20px}
.plan .price{font-size:48px;font-weight:800;color:${colors.primary}}
.plan .price span{font-size:16px;font-weight:400;color:#94A3B8}
.plan ul{list-style:none;margin:24px 0;flex:1}
.plan li{padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #F1F5F9}
.plan li:last-child{border-bottom:none}
.plan li::before{content:"✓ ";color:${colors.primary};font-weight:700}
.btn{display:block;width:100%;padding:14px;background:${colors.primary};color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;transition:background .2s}
.btn:hover{background:${colors.secondary}}
.btn-outline{background:transparent;border:2px solid ${colors.primary};color:${colors.primary}}
.btn-outline:hover{background:${colors.bg}}
.guarantee{text-align:center;padding:0 24px 60px;font-size:14px;color:#64748B}
</style>
</head>
<body>
<div class="hero">
  <h1>Simple, Transparent Pricing</h1>
  <p>Choose the plan that fits ${desc}. Upgrade or cancel anytime.</p>
</div>
<div class="plans">
  <div class="plan">
    <h2>Starter</h2>
    <div class="subtitle">Perfect for getting started</div>
    <div class="price">$0<span>/mo</span></div>
    <ul>
      <li>1 micro-app page</li>
      <li>Up to 50 subscribers</li>
      <li>Basic analytics</li>
      <li>Community support</li>
    </ul>
    <a href="#" class="btn btn-outline">Start Free</a>
  </div>
  <div class="plan featured">
    <span class="popular">Most Popular</span>
    <h2>Pro</h2>
    <div class="subtitle">For growing businesses</div>
    <div class="price">$29<span>/mo</span></div>
    <ul>
      <li>Unlimited pages</li>
      <li>Unlimited subscribers</li>
      <li>Advanced analytics</li>
      <li>Custom branding</li>
      <li>Priority support</li>
    </ul>
    <a href="#" class="btn">Get Started</a>
  </div>
  <div class="plan">
    <h2>Business</h2>
    <div class="subtitle">For scaling teams</div>
    <div class="price">$79<span>/mo</span></div>
    <ul>
      <li>Everything in Pro</li>
      <li>White-label</li>
      <li>API access</li>
      <li>Team collaboration</li>
      <li>Dedicated support</li>
    </ul>
    <a href="#" class="btn btn-outline">Contact Sales</a>
  </div>
</div>
<div class="guarantee">🔒 30-day money-back guarantee · No questions asked</div>
</body>
</html>`;
}

function faqPage(appName: string, niche: string, colors: ReturnType<typeof getColors>): string {
  const desc = nicheDescriptor(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>FAQ — ${appName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${colors.bg};color:#1E293B;min-height:100vh}
.header{text-align:center;padding:60px 24px 40px}
.header h1{font-size:36px;font-weight:800;margin-bottom:8px}
.header p{font-size:18px;color:#64748B}
.faq{max-width:720px;margin:0 auto 60px;padding:0 24px}
.item{background:#fff;border-radius:12px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.question{padding:20px 24px;font-size:16px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;color:${colors.secondary}}
.question::after{content:"+";font-size:22px;color:${colors.primary};font-weight:300}
.question:hover{background:${colors.bg}}
.answer{padding:0 24px 20px;font-size:15px;color:#475569;line-height:1.7;display:none}
.item.open .answer{display:block}
.item.open .question::after{content:"−"}
.cta{text-align:center;padding:0 24px 80px}
.cta h2{font-size:24px;font-weight:700;margin-bottom:12px}
.cta p{font-size:16px;color:#64748B;margin-bottom:24px}
.btn{display:inline-block;padding:14px 32px;background:${colors.primary};color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .2s}
.btn:hover{background:${colors.secondary}}
</style>
</head>
<body>
<div class="header">
  <h1>Frequently Asked Questions</h1>
  <p>Everything you need to know about ${appName}</p>
</div>
<div class="faq">
  <div class="item">
    <div class="question">What is ${appName}?</div>
    <div class="answer">${appName} is a micro-app platform designed for ${desc}. It gives you a professional landing experience, subscriber management, and analytics — all in one place.</div>
  </div>
  <div class="item">
    <div class="question">How quickly can I get set up?</div>
    <div class="answer">Most users are fully set up in under 5 minutes. Just describe your business, and we generate your custom pages instantly.</div>
  </div>
  <div class="item">
    <div class="question">Can I customize the pages after generation?</div>
    <div class="answer">Absolutely. Every page can be edited with your own content, colors, and branding. You have full control over the HTML and styling.</div>
  </div>
  <div class="item">
    <div class="question">What's included in the subscription?</div>
    <div class="answer">Your subscription includes unlimited page generation, subscriber management, analytics, deployment hosting, and priority email support.</div>
  </div>
  <div class="item">
    <div class="question">How do I cancel?</div>
    <div class="answer">You can cancel anytime from your dashboard. No contracts, no hidden fees. You'll retain access until the end of your billing period.</div>
  </div>
  <div class="item">
    <div class="question">Do you offer a free trial?</div>
    <div class="answer">Yes! The Starter plan is free forever with core features. You can upgrade to Pro anytime to unlock unlimited pages and advanced analytics.</div>
  </div>
</div>
<div class="cta">
  <h2>Still have questions?</h2>
  <p>We're here to help. Reach out and we'll get back to you within 24 hours.</p>
  <a href="#" class="btn">Contact Support</a>
</div>
<script>
document.querySelectorAll('.item').forEach(item => {
  item.querySelector('.question').addEventListener('click', () => {
    item.classList.toggle('open');
  });
});
</script>
</body>
</html>`;
}

// ── Main generator ────────────────────────────────────────────
export interface GeneratedApp {
  name: string;
  niche: string;
  description: string;
  pricing: number;
  pages: { path: string; title: string; componentCode: string }[];
  config: {
    brandColors: { primary: string; secondary: string; accent: string; bg: string };
    fontFamily: string;
    borderRadius: string;
  };
}

export function generateAppFromPrompt(prompt: string, authorId: string): GeneratedApp {
  const niche = detectNiche(prompt);
  const name = extractAppName(prompt);
  const colors = getColors(niche);

  const pages: GeneratedApp["pages"] = [
    { path: "/onboarding", title: "Welcome", componentCode: onboardingPage(name, niche, colors) },
    { path: "/dashboard", title: "Dashboard", componentCode: dashboardPage(name, niche, colors) },
    { path: "/pricing", title: "Pricing", componentCode: pricingPage(name, niche, colors) },
    { path: "/faq", title: "FAQ", componentCode: faqPage(name, niche, colors) },
  ];

  return {
    name,
    niche,
    description: prompt.length > 200 ? prompt.slice(0, 200) + "…" : prompt,
    pricing: 29.99,
    pages,
    config: {
      brandColors: colors,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      borderRadius: "12px",
    },
  };
}
