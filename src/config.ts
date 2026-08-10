/**
 * Feature flags and single-source-of-truth site content.
 *
 * The capability map and projects grid are built-but-disabled: no real project
 * entries exist yet, and an empty grid harms credibility more than an absent
 * section does. Turning one on is a one-line change here.
 */
export const features = {
  /** Kill-chain capability map. Component not yet built. */
  capabilityMap: false,
  /** Projects grid, driven by src/data/projects.json. */
  projects: false,
  /**
   * The contact form posts to /api/contact. Requires the MAIL_API_KEY secret to
   * be set on the Worker; without it the endpoint returns 503 rather than
   * accepting a submission it cannot deliver.
   */
  contactForm: true,
} as const;

/**
 * Turnstile site key (public — safe to ship in HTML). Null until a widget is
 * created, in which case the form renders without a CAPTCHA and relies on the
 * honeypot, minimum time-to-submit, and field limits.
 *
 * The Worker verifies Turnstile server-side only when TURNSTILE_SECRET_KEY is
 * set, so this and that secret must be configured together.
 */
export const turnstileSiteKey: string | null = null;

/**
 * Section order and nav membership. Nav entries are generated from this, so a
 * nav link can never point at a section that doesn't render — and the anchor
 * integrity check in CI enforces it against the built HTML.
 */
export const sections = [
  { id: 'top', label: 'Home', inNav: false, enabled: true },
  { id: 'about', label: 'About', inNav: true, enabled: true },
  { id: 'services', label: 'Services', inNav: true, enabled: true },
  { id: 'capability', label: 'Capability', inNav: true, enabled: features.capabilityMap },
  { id: 'approach', label: 'Approach', inNav: true, enabled: true },
  { id: 'work', label: 'Projects', inNav: true, enabled: features.projects },
  { id: 'portfolio', label: 'Portfolio', inNav: true, enabled: true },
  { id: 'contact', label: 'Contact', inNav: true, enabled: true },
] as const;

export type SectionId = (typeof sections)[number]['id'];

/** Sections that actually render, in document order. */
export const enabledSections = sections.filter((s) => s.enabled);

/**
 * Display number for a section, derived from position among enabled sections.
 * Keeps the "01 / 02 / 03" labels sequential with no gaps when a section is
 * flagged on or off, instead of hardcoding a number per component.
 */
export function sectionNumber(id: SectionId): string {
  const index = enabledSections.findIndex((s) => s.id === id);
  return index === -1 ? '--' : String(index + 1).padStart(2, '0');
}

/**
 * Hero copy. The headline is drawn from the operator's own About copy
 * ("test, validate, and strengthen their defenses") rather than invented.
 */
export const hero = {
  headline: 'Test, validate, and strengthen your defenses.',
} as const;

/** Verified facts only. */
export const site = {
  name: "Clay's Consulting",
  domain: 'claysconsulting.org',
  tagline:
    'Offensive security, compliance automation, and security architecture for Department of Defense and commercial clients.',
  email: 'info@claysconsulting.org',
  phone: '469-429-2267',
  phoneHref: 'tel:+14694292267',
  hours: 'Mon–Fri, 08:00–18:00 CT',
  github: 'https://github.com/leeclay95',
} as const;

/** Company-level about copy, supplied by the operator. */
export const about = [
  "Clay's Consulting is a premier cybersecurity consulting firm dedicated to empowering organizations to test, validate, and strengthen their defenses. We specialize in offensive security, compliance automation, and security architecture, serving both Department of Defense and commercial clients with practical, results-driven solutions. Our team of expert security professionals brings deep technical knowledge and real-world experience to every engagement.",
  'We deliver comprehensive penetration testing, red team operations, RMF consulting, and seamless security tooling integration. By combining offensive security expertise with compliance automation and strategic security architecture, we help organizations identify vulnerabilities, meet regulatory requirements, and build resilient security postures that protect their most critical assets.',
] as const;

/** Operator identity and portfolio bio. */
export const operator = {
  name: 'Lee Clayton',
  bio: 'Offensive security professional with close to 10 years of experience in private and public sectors. I have performed testing on UAS, cloud infrastructure, and web applications. My other domains of experience are GRC engineering, custom tool development, command and control development, and security architecture.',
  /**
   * Credly profiles, shown under Certifications as third-party verification.
   * `label` exists because two links reading "Credly" would be ambiguous to
   * anyone navigating by link text alone.
   */
  credly: [
    { label: 'Credly profile 1', href: 'https://www.credly.com/users/lee-clayton.87dde9ed' },
    { label: 'Credly profile 2', href: 'https://www.credly.com/users/lee-clayton.50d724f2' },
  ],
} as const;

/**
 * Named certifications, rendered above the Credly links in the portfolio card.
 * Empty by default: credentials are never invented here. Add exact names only.
 */
export const certifications: string[] = [];
