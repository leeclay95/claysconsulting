export interface ControlRow {
  layer: string;
  tool: string;
  enforcement: string;
}

export interface OwnershipRow {
  layer: string;
  owner: string;
  managedBy: string;
}

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
    controls: ControlRow[];
    ownership: OwnershipRow[];
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
      controls: [
        { layer: 'Static analysis', tool: 'kubesec', enforcement: 'Scores manifests before anything is deployed, a CI gate' },
        { layer: 'Image scanning', tool: 'trivy', enforcement: 'Image CVE-scanned in CI, fixable HIGH/CRITICAL block the merge' },
        { layer: 'Admission control', tool: 'OPA Gatekeeper', enforcement: 'Cluster refuses insecure pods at apply time, no bypass possible' },
        { layer: 'Secrets management', tool: 'External Secrets Operator', enforcement: 'Secrets never in manifests or Git, injected at runtime from Secrets Manager' },
        { layer: 'IaC security', tool: 'tfsec', enforcement: 'Terraform scanned for misconfigurations, zero HIGH findings enforced' },
        { layer: 'Image provenance', tool: 'ECR (LocalStack)', enforcement: 'Private registry with immutable tags, no public image pull at runtime' },
        { layer: 'Encryption at rest', tool: 'KMS', enforcement: 'Secrets Manager and RDS encrypted with a customer-managed CMK' },
        { layer: 'Least privilege', tool: 'IAM role assumption', enforcement: 'ESO assumes a scoped role, static credentials can only call sts:AssumeRole' },
        { layer: 'RBAC', tool: 'ServiceAccount + empty Role', enforcement: 'Pod identity with zero API permissions, no token automount' },
      ],
      ownership: [
        { layer: 'k3d cluster, floci prereqs, image import', owner: 'Terraform', managedBy: 'terraform/ roots + Makefile' },
        { layer: 'Gatekeeper, ESO, Argo CD controllers', owner: 'Terraform', managedBy: 'helm_release in terraform/cluster/' },
        { layer: 'webapp workload (Deployment, Service, RBAC, ConfigMap, ESO config, Gatekeeper policies)', owner: 'Argo CD', managedBy: 'Application webapp, synced from charts/webapp in Git' },
      ],
    },
  },
];
