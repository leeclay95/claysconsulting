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
];
