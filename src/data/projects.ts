/**
 * Projects rendered by the Projects grid. Kept as TypeScript rather than JSON
 * so the shape is checked at build time instead of trusted at runtime.
 *
 * The grid is flagged off in src/config.ts while this list is empty: an empty
 * grid harms credibility more than an absent section. Add two or three entries,
 * flip `features.projects`, and the section renders.
 */
export interface Project {
  title: string;
  kind: 'offensive' | 'compliance' | 'architecture';
  summary: string;
  stack: string[];
  status: 'shipped' | 'in-dev';
  href: string | null;
}

export const projects: Project[] = [];
