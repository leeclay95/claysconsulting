/**
 * Simulated command terminal. No backend execution, no process spawning, no
 * shell access. Every command below just renders pre-authored content that
 * ships in the page (see the "terminal-data" JSON block in Terminal.astro).
 * Unknown input is a real "command not found", not a scripted fallback.
 */

interface SkillGroup {
  group: string;
  items: string[];
}

interface ProjectData {
  slug: string;
  title: string;
  summary: string;
  stack: string[];
  highlights: string[];
  href: string;
}

interface TerminalData {
  operator: { name: string; title: string; bio: string; focus: string };
  skills: SkillGroup[];
  certifications: string[];
  projects: ProjectData[];
  contact: { email: string; contactUrl: string };
}

type Line = string | { text: string; href: string } | { label: string; value: string };

const PROMPT = 'lee@portfolio:~$';

/**
 * Aligned "Label:   value" pairs, e.g.
 *   Name:   Lee Clayton
 *   Role:   Offensive Security Engineer & GRC Engineering Practitioner
 * Column width is derived from the longest label in the set, with a minimum
 * two-space gap. Rendered as two separately colored spans (see renderLines)
 * so the label reads as a key and the value as the answer, the way
 * `show engineer detail`-style command output usually looks.
 */
function fieldBlock(fields: [string, string][]): { label: string; value: string }[] {
  const labelWidth = Math.max(...fields.map(([label]) => label.length + 1));
  return fields.map(([label, value]) => ({ label: (label + ':').padEnd(labelWidth + 2), value }));
}

const HELP_LINES: Line[] = [
  'show details        name, role, focus, and certifications',
  'whoami              full bio',
  'show skills         skills and areas of practice',
  'show certs          certifications',
  'show projects       list documented projects',
  'show <slug>         details for one project',
  'contact             how to reach me',
  'clear               clear the screen',
  'help                this list',
];

function readData(): TerminalData {
  const el = document.getElementById('terminal-data');
  if (!el?.textContent) throw new Error('terminal data missing');
  return JSON.parse(el.textContent) as TerminalData;
}

// Nodes below are attached with appendChild rather than the multi-argument
// Element.append(): wrangler's generated worker-configuration.d.ts declares
// its own ambient Element interface (for HTMLRewriter) that collides with
// the DOM's Element.append() overload once both are in scope.
function renderLines(log: HTMLElement, lines: Line[]): void {
  for (const line of lines) {
    const row = document.createElement('div');
    row.className = 'terminal__line';
    if (typeof line === 'string') {
      row.textContent = line;
    } else if ('href' in line) {
      const a = document.createElement('a');
      a.href = line.href;
      a.textContent = line.text;
      a.rel = 'noopener';
      row.appendChild(a);
    } else {
      const label = document.createElement('span');
      label.className = 'terminal__field-label';
      label.textContent = line.label;
      const value = document.createElement('span');
      value.className = 'terminal__field-value';
      value.textContent = line.value;
      row.appendChild(label);
      row.appendChild(value);
    }
    log.appendChild(row);
  }
}

/** Renders a line as if the visitor had typed it: prompt and command get distinct colors. */
function echoCommand(log: HTMLElement, command: string): void {
  const row = document.createElement('div');
  row.className = 'terminal__line';
  const prompt = document.createElement('span');
  prompt.className = 'terminal__echo-prompt';
  prompt.textContent = `${PROMPT} `;
  const typed = document.createElement('span');
  typed.className = 'terminal__echo-command';
  typed.textContent = command;
  row.appendChild(prompt);
  row.appendChild(typed);
  log.appendChild(row);
}

function buildCommands(data: TerminalData): Record<string, () => Line[]> {
  const commands: Record<string, () => Line[]> = {
    whoami: () => [data.operator.bio, '', data.operator.focus],
    'show details': () =>
      fieldBlock([
        ['Name', data.operator.name],
        ['Role', data.operator.title],
        ['Focus', data.operator.focus],
        ['Certs', data.certifications.join(', ')],
      ]),
    help: () => HELP_LINES,
    'show skills': () =>
      data.skills.flatMap((group) => [
        `${group.group}:`,
        ...group.items.map((item) => `  ${item}`),
        '',
      ]),
    'show certs': () => data.certifications,
    'show projects': () =>
      data.projects.length === 0
        ? ['No projects documented yet.']
        : data.projects.flatMap((p) => [
            `${p.slug}  -  ${p.title}`,
            `  ${p.summary}`,
            `  type "show ${p.slug}" for details`,
            '',
          ]),
    contact: () => [
      { text: data.contact.email, href: `mailto:${data.contact.email}` },
      { text: 'claysconsulting.org/#contact', href: data.contact.contactUrl },
    ],
  };

  // One "show <slug>" command per documented project, generated from
  // data/projects.ts, so adding a project needs no change here.
  for (const project of data.projects) {
    commands[`show ${project.slug}`] = () => [
      project.title,
      '',
      project.summary,
      '',
      `stack: ${project.stack.join(', ')}`,
      '',
      ...project.highlights.map((h) => `- ${h}`),
      '',
      { text: 'Full write-up (architecture, controls)', href: `/projects/${project.slug}/` },
      { text: 'Source on GitHub', href: project.href },
    ];
  }

  return commands;
}

function init(): void {
  const log = document.getElementById('terminal-log');
  const form = document.getElementById('terminal-form');
  const input = document.getElementById('terminal-input');
  if (!(log instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
    return;
  }

  const data = readData();
  const commands = buildCommands(data);

  // On load, the terminal looks like "show details" was already run: the
  // command is echoed first, then its real output, same as typing it.
  echoCommand(log, 'show details');
  renderLines(log, commands['show details']!());
  renderLines(log, ['', "Type 'help' for more commands, or scroll for the full page."]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value;
    const trimmed = raw.trim();
    input.value = '';
    if (!trimmed) return;

    echoCommand(log, raw);

    if (trimmed.toLowerCase() === 'clear') {
      log.replaceChildren();
    } else {
      const run = commands[trimmed.toLowerCase()];
      renderLines(
        log,
        run ? run() : [`command not found: ${trimmed}`, 'type "help" for a list of commands'],
      );
    }

    log.scrollTop = log.scrollHeight;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
