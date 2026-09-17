/**
 * Operator identity and bio. Kept in sync by hand with the `operator` export
 * in the main site's src/config.ts. Same person, same facts, condensed for a
 * technical-showcase audience instead of a sales pitch.
 */
export const operator = {
  name: 'Lee Clayton',
  title: 'Offensive Security Engineer & GRC Engineering Practitioner',
  bio: 'Offensive security engineer and GRC engineering practitioner with close to 10 years of experience in private and public sectors. I have performed testing on UAS, cloud infrastructure, and web applications, and I build the compliance automation, policy-as-code controls, and security architecture that GRC engineering requires, not just assess them from the outside. My other areas of experience include custom tool development and command and control development.',
  focus: 'Currently building out hands-on infrastructure labs that pair offensive security with GRC engineering.',
  github: 'https://github.com/leeclay95',
} as const;

/** Skills grouped for `show skills`. */
export const skills = [
  { group: 'Offensive security', items: ['Penetration testing', 'Red team operations', 'C2 development'] },
  { group: 'GRC engineering', items: ['RMF consulting', 'Policy-as-code (OPA)', 'Compliance automation'] },
  { group: 'Cloud & infrastructure', items: ['AWS', 'Kubernetes', 'Terraform', 'GitOps (Argo CD)'] },
] as const;

/** Named certifications, exactly as held. Add here only, never invent. */
export const certifications = [
  'A+',
  'SEC+',
  'CYSA',
  'CASP+',
  'GCIH',
  'GPEN',
  'GCPN',
  'GRTP',
  'CGE-P',
] as const;
