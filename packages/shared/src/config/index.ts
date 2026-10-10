import { AcquisitionThesis } from '../schemas/index';

export const ACTION_THRESHOLDS = {
  pursueNow: {
    minFit: 75,
    minOwnerSignal: 65,
    minConfidence: 65,
  },
  researchOwner: {
    minFit: 65,
    // strong company fit but lacking clear owner/succession evidence or moderate confidence
  },
  monitor: {
    minFit: 45,
    // potential fit or weak timing/confidence
  },
} as const;

export const FIT_WEIGHTS = {
  industry: 20,
  geography: 15,
  revenue: 20,
  employees: 15,
  age: 10,
  founderLed: 10,
  independent: 10,
} as const;

export const DEFAULT_DEMO_THESIS: AcquisitionThesis = {
  id: 'thesis-it-services-us',
  name: 'B2B IT & Managed Services (US Lower-Middle Market)',
  industry: 'IT Services',
  geography: 'United States',
  minRevenue: 2000000, // $2M
  maxRevenue: 15000000, // $15M
  minEmployees: 10,
  maxEmployees: 75,
  minBusinessAge: 10,
  preferFounderLed: true,
  preferIndependent: true,
  exclusionKeywords: ['venture capital', 'franchise', 'crypto', 'cannabis'],
  notes:
    'Targeting established, cash-flowing IT Managed Service Providers and specialized B2B software/IT integration firms where founder involvement and current ownership require verification.',
};

export const COMMERCIAL_SERVICES_THESIS: AcquisitionThesis = {
  id: 'thesis-commercial-services-us',
  name: 'Commercial & Facility Services (Lower-Middle Market)',
  industry: 'Facilities Services',
  geography: 'United States',
  minRevenue: 3000000, // $3M
  maxRevenue: 20000000, // $20M
  minEmployees: 15,
  maxEmployees: 100,
  minBusinessAge: 12,
  preferFounderLed: true,
  preferIndependent: true,
  exclusionKeywords: ['franchise', 'residential', 'consumer', 'retail'],
  notes:
    'Targeting mission-critical B2B commercial facility maintenance, HVAC/mechanical, and specialty technical service providers with high contract renewal rates.',
};

export const HEALTHCARE_TECH_THESIS: AcquisitionThesis = {
  id: 'thesis-healthcare-tech-us',
  name: 'Healthcare IT & Specialized Medical Software',
  industry: 'Healthcare',
  geography: 'United States',
  minRevenue: 2000000, // $2M
  maxRevenue: 12000000, // $12M
  minEmployees: 8,
  maxEmployees: 50,
  minBusinessAge: 8,
  preferFounderLed: true,
  preferIndependent: true,
  exclusionKeywords: ['biotech', 'clinical trials', 'pharmaceutical', 'medical device'],
  notes:
    'Targeting profitable, specialized clinical workflow, billing, and practice management software platforms with sticky practitioner relationships.',
};

export const THESIS_PRESETS = [
  DEFAULT_DEMO_THESIS,
  COMMERCIAL_SERVICES_THESIS,
  HEALTHCARE_TECH_THESIS,
] as const;
