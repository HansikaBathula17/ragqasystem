export interface SampleDocument {
  id: string;
  name: string;
  category: string;
  description: string;
  pages: Array<{
    pageNumber: number;
    section: string;
    content: string;
  }>;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: "refund_policy_q1",
    name: "refund_policy_q1.pdf",
    category: "Company Policies",
    description: "Original Q1 company-wide refund policy specifying standard 30-day return windows.",
    pages: [
      {
        pageNumber: 1,
        section: "1.0 Purpose & General Terms",
        content: `Apex Retail Corp - Q1 Standard Return & Refund Policy (Version 1.4)
1.0 Purpose and Scope:
This policy governs all consumer returns, exchanges, and warranty claim refunds for goods and services purchased directly through Apex Retail channels during the first half of the operating year.
Eligible purchases include consumer electronics, apparel, homeware, and bundled software subscriptions purchased through our online storefront or authorized retail partners.`,
      },
      {
        pageNumber: 2,
        section: "2.1 Refund Window & Eligibility",
        content: `2.1 Standard Return Window:
The Q1 policy allows customer refunds within 30 calendar days from the date of physical receipt or electronic delivery. Customers returning items in new, unblemished, or unopened condition are entitled to a full 100% refund credited back to the original method of payment.
2.2 Return Shipping & Processing:
Return shipping fees are fully covered by Apex Retail for defective items or mistaken shipments. Standard return requests are processed within 3 to 5 business days after inspection at our central fulfillment depot.`,
      },
    ],
  },
  {
    id: "refund_policy_q3",
    name: "refund_policy_q3.pdf",
    category: "Company Policies",
    description: "Q3 Updated refund policy modifying return windows for digital goods to 14 days.",
    pages: [
      {
        pageNumber: 1,
        section: "1.0 Policy Revision & Digital Goods Scope",
        content: `Apex Retail Corp - Q3 Comprehensive Policy Amendment (Version 2.1)
1.0 Executive Summary of Changes:
Effective August 1st for Q3 operations, our return policy is updated to address automated license issuance. While physical merchandise continues to follow the baseline 30-day return window established in Q1, the Q3 update reduced this window to 14 days for all digital goods, downloadable software, API keys, and cloud credits.
1.1 Digital License Conditions:
Any refund request for downloadable software licenses or digital content must be submitted within 14 calendar days of transaction timestamp, provided license key activation logs confirm under 2 hours of platform usage.`,
      },
      {
        pageNumber: 2,
        section: "2.0 Hardware Restocking & Exceptions",
        content: `2.0 Hardware Returns and Restocking Surcharges:
Opened consumer hardware and high-end workstation electronics returned after 14 days are subject to a mandatory 10% restocking inspection fee. Physical goods returned within 14 days without missing accessories receive 100% reimbursement.
2.1 Non-Refundable Items:
Custom-configured server equipment, customized personalized gear, and digital subscriptions after 14 days from initial registration are strictly non-refundable.`,
      },
    ],
  },
  {
    id: "cloud_security_handbook",
    name: "cloud_security_handbook.pdf",
    category: "Technical Standards",
    description: "Enterprise infrastructure security guidelines detailing MFA, timeouts, and encryption.",
    pages: [
      {
        pageNumber: 1,
        section: "3.1 Identity & Session Management",
        content: `Apex Cloud Infrastructure Security Handbook
3.1 Multi-Factor Authentication (MFA):
All internal staff, engineering contractors, and administrative users are required to authenticate using phishing-resistant FIDO2 WebAuthn hardware keys or verified mobile push authenticators. SMS and voice-call verification are strictly deprecated.
3.2 Idle Session Timeouts:
To prevent unauthorized physical workstation hijackings, all active web console sessions, cloud dashboard consoles, and SSH jump-box bastion connections must automatically terminate after 15 minutes of user inactivity. Re-authentication is mandatory upon resumption.`,
      },
      {
        pageNumber: 2,
        section: "4.2 Encryption & Key Rotation",
        content: `4.2 Cryptographic Protection at Rest and in Transit:
All relational database instances, blob storage buckets, and document stores must enforce AES-256-GCM hardware-accelerated encryption at rest. All ingress and egress transit lines require TLS 1.3 or higher.
4.3 Credential Lifecycle:
Automated service account credentials, OAuth tokens, and database access passwords must be automatically rotated every 90 days via our automated secrets orchestrator. Manual key exemptions are disallowed.`,
      },
    ],
  },
  {
    id: "employee_perks_guide",
    name: "employee_perks_guide.pdf",
    category: "HR & People",
    description: "Employee stipends for remote home office, learning allowances, and wellness.",
    pages: [
      {
        pageNumber: 1,
        section: "2.0 Remote Office & Connectivity Stipends",
        content: `Apex Global Employee Experience & Perks Handbook
2.0 Ergonomic Home Setup:
Permanent remote and hybrid employees receive an annual remote work equipment allowance of $500. This fund covers ergonomic chairs, motorized standing desks, external monitors, and noise-canceling headsets.
2.1 Internet Connectivity:
Employees receive a flat monthly internet stipend of $60 added directly to their monthly paystub to ensure reliable broadband fiber connectivity.`,
      },
      {
        pageNumber: 2,
        section: "3.0 Growth & Wellbeing Allowances",
        content: `3.0 Professional Learning & Development:
Every employee receives $1,500 per fiscal year in dedicated learning and development budget. Covered expenses include college tuition credits, technical certifications (AWS, GCP, CKA), conference tickets, and technical textbooks.
3.1 Health and Wellness:
We provide an ongoing $75 monthly wellness reimbursement for gym memberships, fitness class packages, yoga studios, mental health apps, or athletic equipment.`,
      },
    ],
  },
];
