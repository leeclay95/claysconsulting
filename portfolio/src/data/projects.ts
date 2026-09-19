export interface DetailTableSection {
  kind: 'table';
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface DetailTextSection {
  kind: 'text';
  heading: string;
  body: string;
}

export type DetailSection = DetailTableSection | DetailTextSection;

export interface Project {
  slug: string;
  title: string;
  summary: string;
  stack: string[];
  highlights: string[];
  href: string;
  /** Full write-up content, rendered on /projects/<slug>/. */
  detail: {
    architecture: string;
    sections: DetailSection[];
  };
}

/**
 * Real, finished write-ups only, same rule as the main site: an empty or
 * padded-out grid harms credibility more than a short one does. Add entries
 * here as new labs are documented; nothing is invented ahead of the work.
 */
export const projects: Project[] = [
  {
    slug: 'kubernetes-grc-engineering',
    title: 'Kubernetes GRC Engineering',
    summary:
      'A fully automated Kubernetes security lab that deploys a hardened nginx workload on a local k3d cluster backed by LocalStack AWS services, demonstrating layered security controls across static analysis, runtime admission control, secrets management, and infrastructure hardening, all repeatable from a single Terraform apply and reconciled continuously by Argo CD.',
    stack: [
      'Terraform',
      'k3d',
      'Argo CD',
      'OPA Gatekeeper',
      'External Secrets Operator',
      'tfsec',
      'trivy',
      'kubesec',
      'LocalStack',
    ],
    highlights: [
      'Cluster refuses insecure pods at apply time via OPA Gatekeeper, no bypass possible',
      'Secrets never live in manifests or Git; External Secrets Operator injects them at runtime from Secrets Manager',
      'Terraform scanned with tfsec pre-apply, zero HIGH findings enforced',
      'Least-privilege IAM: workload assumes a scoped role, static credentials can only call sts:AssumeRole',
    ],
    href: 'https://github.com/leeclay95/k3s-security-lab',
    detail: {
      architecture:
        'Terraform provisions everything: the k3d cluster, LocalStack-backed AWS services (KMS, Secrets Manager, RDS, ECR), and the Gatekeeper, External Secrets, and Argo CD controllers. From there, Argo CD takes over as the single reconciler of the webapp namespace, pulling the Deployment, Service, RBAC, and ESO/Gatekeeper config from Git and self-healing any drift. The workload never touches a credential directly: External Secrets Operator assumes a scoped IAM role to pull secrets from Secrets Manager into native Kubernetes Secrets, and Gatekeeper refuses the pod at apply time if it violates policy, before either one runs.',
      sections: [
        {
          kind: 'table',
          heading: 'Controls',
          columns: ['Layer', 'Tool', 'What it enforces'],
          rows: [
            ['Static analysis', 'kubesec', 'Scores manifests before anything is deployed, a CI gate'],
            ['Image scanning', 'trivy', 'Image CVE-scanned in CI, fixable HIGH/CRITICAL block the merge'],
            ['Admission control', 'OPA Gatekeeper', 'Cluster refuses insecure pods at apply time, no bypass possible'],
            ['Secrets management', 'External Secrets Operator', 'Secrets never in manifests or Git, injected at runtime from Secrets Manager'],
            ['IaC security', 'tfsec', 'Terraform scanned for misconfigurations, zero HIGH findings enforced'],
            ['Image provenance', 'ECR (LocalStack)', 'Private registry with immutable tags, no public image pull at runtime'],
            ['Encryption at rest', 'KMS', 'Secrets Manager and RDS encrypted with a customer-managed CMK'],
            ['Least privilege', 'IAM role assumption', 'ESO assumes a scoped role, static credentials can only call sts:AssumeRole'],
            ['RBAC', 'ServiceAccount + empty Role', 'Pod identity with zero API permissions, no token automount'],
          ],
        },
        {
          kind: 'table',
          heading: 'Ownership',
          columns: ['Layer', 'Owner', 'Managed by'],
          rows: [
            ['k3d cluster, floci prereqs, image import', 'Terraform', 'terraform/ roots + Makefile'],
            ['Gatekeeper, ESO, Argo CD controllers', 'Terraform', 'helm_release in terraform/cluster/'],
            ['webapp workload (Deployment, Service, RBAC, ConfigMap, ESO config, Gatekeeper policies)', 'Argo CD', 'Application webapp, synced from charts/webapp in Git'],
          ],
        },
      ],
    },
  },
  {
    slug: 'iam-privilege-escalation-lab',
    title: 'IAM Privilege Escalation Lab',
    summary:
      'A self-contained AWS IAM misconfiguration lab (Docker, no real AWS account required) that proves a full attack chain end to end: an attacker with no direct access to a secrets bucket pivots through an overpermissive Lambda execution role, then escalates further through an unscoped iam:PassRole to deploy attacker-controlled compute, exfiltrating credentials and PII at every step. The same misconfigurations are then caught pre-deploy by an OPA and tfsec policy layer, and the fixed Terraform closes every path.',
    stack: [
      'Terraform',
      'AWS IAM',
      'Lambda',
      'S3',
      'SSM Parameter Store',
      'OPA / Rego',
      'conftest',
      'tfsec',
      'Floci (LocalStack-compatible)',
    ],
    highlights: [
      'Full attack chain proven end to end, not theoretical: namespace isolation holds, but a wildcard Lambda exec role and an unscoped iam:PassRole together bypass it completely',
      'Attacker pivots through a legitimate Lambda function to exfiltrate S3 objects and SSM SecureStrings it was never granted direct access to',
      'iam:PassRole with no iam:PassedToService condition lets the attacker deploy their own Lambda with the same overpermissive role attached',
      'OPA Rego policies and tfsec custom checks flag every finding (IAM-001 through 004, LAMBDA-001) against the Terraform plan before anything is deployed',
      'Identical attack scripts re-run against the remediated Terraform fail cleanly, and the GRC scan returns zero findings',
    ],
    href: 'https://github.com/leeclay95/iam_lab',
    detail: {
      architecture:
        'Three AWS identities run against a Dockerized, LocalStack-compatible backend (Floci): an allowed account that owns an S3 secrets vault and SSM parameters, a low-privilege attacker IAM user, and a root identity used only for Terraform. The vulnerable Terraform grants the Lambda execution role s3:* and ssm:GetParameter* on Resource: *, and grants a devops-role iam:PassRole on Resource: * with no iam:PassedToService condition. Direct S3 and SSM access from the attacker account is correctly denied by account namespace isolation, but the attacker does not need direct access: invoking the existing data-processor Lambda runs code under the overpermissive exec role, and the unscoped PassRole lets the attacker deploy a second, attacker-controlled Lambda carrying that same role. An OPA and tfsec policy layer scans the Terraform plan pre-deploy and flags both misconfigurations; terraform-fix/ scopes the S3 permissions to a specific prefix, adds the iam:PassedToService condition, and restricts Lambda invocation to the allowed account principal, closing both paths.',
      sections: [
        {
          kind: 'table',
          heading: 'Attack Chain',
          columns: ['Phase', 'Action', 'Misconfiguration Exploited', 'Result'],
          rows: [
            ['1', 'Attacker attempts direct S3 and SSM access', 'None, this is the control working correctly', 'Denied, account namespace isolation holds'],
            ['2', 'Attacker invokes the data-processor Lambda', 'lambda_exec role grants s3:*, ssm:GetParameter* on Resource: *', 'Vault objects and SSM SecureStrings exfiltrated through the Lambda'],
            ['3', 'Attacker uses devops-role to deploy evil-exfil Lambda', 'iam:PassRole on Resource: * with no iam:PassedToService condition', 'Attacker-controlled Lambda deployed carrying the overpermissive exec role'],
            ['4', 'Attacker invokes evil-exfil Lambda', 'Same wildcard exec role, now attacker-controlled', 'Additional PII exfiltrated'],
          ],
        },
        {
          kind: 'table',
          heading: 'GRC Remediation',
          columns: ['Finding', 'Misconfiguration', 'Fix Applied'],
          rows: [
            ['IAM-001 / IAM-002', 's3:* and ssm:GetParameter* granted on Resource: *', 'Scoped to s3:GetObject on a specific bucket prefix; SSM access scoped per parameter'],
            ['IAM-003 / IAM-004', 'iam:PassRole on Resource: * with no condition', 'Resource scoped to the specific role ARN, plus an iam:PassedToService condition requiring lambda.amazonaws.com'],
            ['LAMBDA-001', 'Missing resource-based invoke policy', 'aws_lambda_permission restricts InvokeFunction to the allowed account principal only'],
          ],
        },
      ],
    },
  },
  {
    slug: 'azure-grc-evidence-pipeline',
    title: 'Azure GRC Evidence Pipeline',
    summary:
      'A GRC engineering pipeline built in Terraform on Azure that discovers what is configured, enables only what is missing, collects Defender for Cloud assessments into an evidence store it owns, and produces a POA&M and SAR that read only from that store. Built as the CGE-AZ capstone, which passed. Identity is managed identities inside Azure and OIDC in CI, so no credential is stored anywhere, and every control is mapped to NIST SP 800-53 Rev. 5 and CSF 2.0.',
    stack: [
      'Terraform',
      'Azure Policy',
      'Microsoft Defender for Cloud',
      'Cosmos DB',
      'Blob Storage (WORM)',
      'Azure Functions',
      'Managed Identities',
      'GitHub Actions (OIDC)',
      'OPA / Rego',
      'conftest',
      'checkov',
      'tflint',
      'gitleaks',
      'KQL',
    ],
    highlights: [
      'Zero stored credentials: managed identities inside Azure and OIDC federation in CI, with gitleaks clean across the full history',
      'Discovery first: each Defender plan is read before anything is enabled, so activation changes only what is missing',
      'Collect once: a scheduled sweep of 101 assessments feeds every framework through a data-driven crosswalk that maps 41 assessments to NIST 800-53 Rev. 5 and CSF 2.0',
      'Reports read only from the evidence store: a POA&M listing 55 open findings matched the 55 stored documents for its run, in write-once storage that refuses deletes',
      'A CI gate of OPA rules blocks insecure Terraform at pull request time, and drift detection opens and closes its own GitHub issues',
    ],
    href: 'https://github.com/leeclay95/cgeaz',
    detail: {
      architecture:
        'Five Terraform root modules, each with its own remote state, build the pipeline: foundation (management groups, Azure Policy, one remediation identity, logging), activation (Defender plans, enabled only where discovery found them off), evidence store (Cosmos DB, a write-once Blob container, and the collector Function), reporting (the report Function), and enforcement (a modify policy behind an audit, dry-run, and enforce ladder). Stages read each other only through outputs. The collector runs on a schedule as its own managed identity, reads Defender assessments, and writes one document per assessment, resource, and run to Cosmos, followed by a ledger entry for the run. The reporter runs as a different identity that can read Cosmos and write Blob but cannot reach Defender, so every figure in a POA&M or SAR traces to a stored document. Reports are named after the run they were cut from and written once to a container with a 90 day WORM policy. Pull requests pass a conftest gate before merge, and a scheduled Terraform plan opens a GitHub issue when reality drifts from the code.',
      sections: [
        {
          kind: 'table',
          heading: 'Controls',
          columns: ['Layer', 'Component', 'What it enforces'],
          rows: [
            ['Policy', 'Azure Policy initiative', 'Audit for new controls, Deny where earned, DeployIfNotExists for logging, plus a custom Audit policy for shared key access'],
            ['Identity', 'Managed identities and OIDC', 'No stored credentials anywhere; CI federates to Azure with a subject bound to the repository'],
            ['Separation of duties', 'Collector, reporter, and remediation identities', 'The identity that writes evidence cannot author reports, and neither can remediate'],
            ['Least privilege', 'Remediation identity', 'Two whitelisted roles at one scope; Owner and Contributor grants are blocked in code'],
            ['Evidence integrity', 'WORM Blob container', 'Reports are immutable for 90 days; a delete is refused for every identity'],
            ['Traceability', 'Run ledger and per-run documents', 'Every report figure reproduces from the documents of the run it names'],
            ['IaC gate', 'conftest, checkov, tflint, gitleaks', 'Insecure Terraform cannot merge; the gate rules carry NIST 800-53 tags'],
            ['Change control', 'Escalation ladder', 'Moving remediation from dry-run to enforce is a reviewed one line change'],
            ['Detection', 'Drift detection and activity-log tripwire', 'Plan drift opens a GitHub issue that closes when clean; out-of-band changes send an alert'],
          ],
        },
        {
          kind: 'table',
          heading: 'Identities',
          columns: ['Identity', 'Can', 'Cannot'],
          rows: [
            ['Collector Function', 'Read Defender assessments, write Cosmos', 'Write blobs, so it cannot author reports'],
            ['Reporter Function', 'Read Cosmos, write the reports container', 'Read Defender or write evidence'],
            ['Remediation identity', 'Two whitelisted roles at one management group scope', 'Act at subscription scope or hold Owner or Contributor'],
          ],
        },
        {
          kind: 'table',
          heading: 'Findings From Testing',
          columns: ['Finding', 'Cause', 'Fix'],
          rows: [
            ['A report stopped tracing to data after the next sweep', 'Document IDs ignored the run, so each sweep overwrote the last', 'IDs now include the run, and a ledger entry is written per sweep'],
            ['The drift issue never closed', 'CI planned as its own identity and replaced the deployer role assignments on every run', 'The deployer object ID is pinned as a variable in CI'],
            ['The identity gate rule never fired', 'A plan renders an absent block as an empty list, which Rego treats as present', 'The rule counts identity entries, with pass and fail examples that prove it fires'],
            ['An initiative update was rejected', 'Azure generated the same reference ID for two policies', 'Every policy reference has an explicit ID'],
          ],
        },
        {
          kind: 'text',
          heading: 'Scope',
          body: 'This build covers discovery, activation, the evidence store, reporting, and enforcement. The AI narrative stage of the course architecture is not part of it.',
        },
      ],
    },
  },
];
