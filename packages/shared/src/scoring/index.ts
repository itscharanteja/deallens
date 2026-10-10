import {
  AcquisitionThesis,
  Company,
  CompanyAnalysis,
  Evidence,
  ActionBucket,
  FitComponents,
} from '../schemas/index';
import { ACTION_THRESHOLDS, FIT_WEIGHTS } from '../config/index';

export function normalizeDomain(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch { return ''; }
}

export function calculateFitScore(
  company: Company,
  thesis: AcquisitionThesis,
  evidence: Evidence[] = []
): { score: number; components: FitComponents } {
  // Check exclusions first
  const desc = (company.description || '').toLowerCase();
  const name = company.name.toLowerCase();
  const ind = company.industry.toLowerCase();
  for (const excl of thesis.exclusionKeywords) {
    const term = excl.toLowerCase();
    if (desc.includes(term) || name.includes(term) || ind.includes(term)) {
      return {
        score: 10,
        components: {
          industry: 0,
          geography: 0,
          revenue: 0,
          employees: 0,
          age: 0,
          founderLed: 0,
          independent: 0,
        },
      };
    }
  }

  // 1. Industry Match (Max 20)
  let industryScore = 0;
  const thesisInd = thesis.industry.toLowerCase();
  if (ind === thesisInd) {
    industryScore = FIT_WEIGHTS.industry;
  } else if (
    ind.includes(thesisInd) ||
    thesisInd.includes(ind) ||
    (thesisInd.includes('it') && (ind.includes('tech') || ind.includes('managed') || ind.includes('software') || ind.includes('cyber')))
  ) {
    industryScore = Math.round(FIT_WEIGHTS.industry * 0.8);
  } else {
    industryScore = Math.round(FIT_WEIGHTS.industry * 0.2); // adjacent
  }

  // 2. Geography Match (Max 15)
  let geoScore = 0;
  const compLoc = (company.location || '').toLowerCase();
  const knownLocation = compLoc !== '' && compLoc !== 'unknown';
  const thesisGeo = thesis.geography.toLowerCase();
  if (knownLocation && (compLoc.includes(thesisGeo) || thesisGeo.includes(compLoc))) {
    geoScore = FIT_WEIGHTS.geography;
  } else if (
    thesisGeo.includes('united states') &&
    /(?:\bunited states\b|\busa?\b|,\s*(?:ca|tx|fl|ny|oh|il|nc|wa|co|ga|va|az|nv|ma|mi|pa|mn|or|ut|tn|wi|mo|sc|al|ak|ar|ct|de|hi|ia|id|in|ks|ky|la|md|me|ms|mt|nd|ne|nh|nj|nm|ok|ri|sd|vt|wv|wy|dc)(?:,|$))/i.test(compLoc)
  ) {
    geoScore = FIT_WEIGHTS.geography;
  } else if (!knownLocation) {
    geoScore = Math.round(FIT_WEIGHTS.geography * 0.35); // Unknown
  } else {
    geoScore = 0; // Distinct mismatch
  }

  // 3. Revenue Range Match (Max 20)
  let revScore = 0;
  if (company.revenue != null && company.revenue > 0) {
    if (company.revenue >= thesis.minRevenue && company.revenue <= thesis.maxRevenue) {
      revScore = FIT_WEIGHTS.revenue;
    } else if (
      company.revenue >= thesis.minRevenue * 0.75 &&
      company.revenue <= thesis.maxRevenue * 1.3
    ) {
      revScore = Math.round(FIT_WEIGHTS.revenue * 0.6);
    } else {
      revScore = 0;
    }
  } else {
    // Unknown revenue: explicit partial score with uncertainty
    revScore = Math.round(FIT_WEIGHTS.revenue * 0.4);
  }

  // 4. Employee Range Match (Max 15)
  let empScore = 0;
  if (company.employees != null && company.employees > 0) {
    if (company.employees >= thesis.minEmployees && company.employees <= thesis.maxEmployees) {
      empScore = FIT_WEIGHTS.employees;
    } else if (
      company.employees >= thesis.minEmployees * 0.7 &&
      company.employees <= thesis.maxEmployees * 1.35
    ) {
      empScore = Math.round(FIT_WEIGHTS.employees * 0.6);
    } else {
      empScore = 0;
    }
  } else {
    // Unknown employees
    empScore = Math.round(FIT_WEIGHTS.employees * 0.4);
  }

  // 5. Business Age Match (Max 10)
  let ageScore = 0;
  const currentYear = new Date().getUTCFullYear();
  if (company.foundedYear != null && company.foundedYear > 1800) {
    const age = currentYear - company.foundedYear;
    if (age >= thesis.minBusinessAge) {
      ageScore = FIT_WEIGHTS.age;
    } else {
      ageScore = Math.max(2, Math.round((age / thesis.minBusinessAge) * FIT_WEIGHTS.age));
    }
  } else {
    ageScore = Math.round(FIT_WEIGHTS.age * 0.4); // Unknown
  }

  // 6. Founder-led Preference (Max 10)
  let founderScore = 0;
  const hasFounderEvidence = evidence.some(
    (e) => e.polarity !== 'conflicting' && e.confidence >= 0.75 && (e.type === 'FOUNDER_LED' || e.type === 'FAMILY_OWNED')
  );
  if (!thesis.preferFounderLed || hasFounderEvidence) {
    founderScore = FIT_WEIGHTS.founderLed;
  } else if (desc.includes('founder') || desc.includes('founded by')) {
    founderScore = Math.round(FIT_WEIGHTS.founderLed * 0.85);
  } else {
    founderScore = Math.round(FIT_WEIGHTS.founderLed * 0.3); // Unverified
  }

  // 7. Independent / Private Preference (Max 10)
  let indepScore = 0;
  const hasIndepEvidence = evidence.some((e) => e.type === 'INDEPENDENT' && e.polarity !== 'conflicting' && e.confidence >= 0.75);
  if (!thesis.preferIndependent || hasIndepEvidence) {
    indepScore = FIT_WEIGHTS.independent;
  } else if (!desc.includes('subsidiary') && !desc.includes('acquired by') && !desc.includes('venture')) {
    indepScore = Math.round(FIT_WEIGHTS.independent * 0.3); // Unknown ownership is partial credit, not verified private status
  } else {
    indepScore = 0;
  }

  const components: FitComponents = {
    industry: industryScore,
    geography: geoScore,
    revenue: revScore,
    employees: empScore,
    age: ageScore,
    founderLed: founderScore,
    independent: indepScore,
  };

  const total = Object.values(components).reduce((a, b) => a + b, 0);
  return { score: Math.min(100, Math.max(0, total)), components };
}

export function calculateOwnerSignalScore(
  company: Company,
  evidence: Evidence[] = []
): { score: number; keySignals: string[] } {
  let score = 0;
  const keySignals: string[] = [];

  const types = new Set(evidence.filter(e => e.polarity !== 'conflicting' && e.confidence >= 0.75).map((e) => e.type));

  if (types.has('FOUNDER_LED')) {
    score += 30;
    keySignals.push('Founder-Led Leadership');
  }
  if (types.has('FAMILY_OWNED')) {
    score += 25;
    keySignals.push('Family Owned / Legacy');
  }
  if (types.has('OWNER_OPERATED')) {
    score += 20;
    keySignals.push('Owner-Operated Structure');
  }
  if (types.has('OPERATING_HISTORY')) {
    score += 15;
    keySignals.push('15+ Year Business History');
  }
  if (types.has('INDEPENDENT')) {
    score += 15;
    keySignals.push('Privately Held / Bootstrapped');
  }
  if (types.has('LEADERSHIP')) {
    score += 10;
    keySignals.push('Lean Executive Suite');
  }

  // Cap at 100
  const finalScore = Math.min(100, Math.max(0, score));
  return { score: finalScore, keySignals };
}

export function calculateConfidenceScore(
  company: Company,
  evidence: Evidence[] = []
): number {
  const supporting = evidence.filter(e => e.polarity !== 'conflicting' && e.confidence >= 0.75);
  const sources = new Set(supporting.map(e => e.sourceUrl));
  const types = new Set(supporting.map(e => e.type));
  // Supplied firmographics are useful for fit, but are not independent verification.
  const reachable = ['SUCCESS', 'PARTIAL'].includes(company.crawlStatus) && company.crawledPagesCount > 0;
  let score = reachable ? 15 : 0;
  score += Math.min(20, company.crawledPagesCount * 5);
  score += Math.min(30, types.size * 8);
  score += Math.min(20, sources.size * 5);
  score += supporting.some(e => e.extractionMethod === 'structured_data') ? 5 : 0;
  score += supporting.length ? Math.round(10 * supporting.reduce((sum, e) => sum + e.confidence, 0) / supporting.length) : 0;
  if (sources.size === 0) score = Math.min(score, 20);
  if (sources.size === 1) score = Math.min(score, 50);
  if (evidence.some(e => e.polarity === 'conflicting')) score = Math.min(score, 40);
  if (['PENDING', 'TIMEOUT', 'FAILED', 'BLOCKED_OR_UNAVAILABLE'].includes(company.crawlStatus)) score = Math.min(score, 20);
  return Math.min(100, Math.max(0, score));
}

export function determineActionBucket(
  fitScore: number,
  ownerSignalScore: number,
  confidenceScore: number
): ActionBucket {
  if (
    fitScore >= ACTION_THRESHOLDS.pursueNow.minFit &&
    ownerSignalScore >= ACTION_THRESHOLDS.pursueNow.minOwnerSignal &&
    confidenceScore >= ACTION_THRESHOLDS.pursueNow.minConfidence
  ) {
    return 'PURSUE_NOW';
  }

  if (fitScore >= ACTION_THRESHOLDS.researchOwner.minFit) {
    return 'RESEARCH_OWNER';
  }

  if (fitScore >= ACTION_THRESHOLDS.monitor.minFit) {
    return 'MONITOR';
  }

  return 'SKIP';
}

export function generateIntelligenceInsights(
  company: Company,
  thesis: AcquisitionThesis,
  fitScore: number,
  ownerSignalScore: number,
  confidenceScore: number,
  bucket: ActionBucket,
  keySignals: string[],
  evidence: Evidence[]
): { summary: string; recommendedAction: string; unknowns: string[] } {
  const unknowns: string[] = [];

  if (company.revenue == null) {
    unknowns.push('Verified financial statements / accurate EBITDA margin');
  }
  if (!evidence.some((e) => e.type === 'FOUNDER_LED')) {
    unknowns.push('Current founder equity stake and day-to-day operational role');
  }
  if (!evidence.some((e) => e.type === 'INDEPENDENT' && e.polarity !== 'conflicting' && e.confidence >= 0.75)) {
    unknowns.push('External cap table capitalization or minority silent investors');
  }
  if (company.crawledPagesCount < 2) {
    unknowns.push('Direct executive team bios and succession transition plan');
  }
  unknowns.push('Reported firmographics require independent verification');
  unknowns.push('Customer concentration & top-10 client revenue retention');

  let summary = '';
  let recommendedAction = '';

  switch (bucket) {
    case 'PURSUE_NOW':
      summary = `A priority for further research against your ${thesis.industry} criteria. Ownership indicators (${keySignals.slice(0, 2).join(', ')}) are supported by the available snippets. Confirm the underlying claims before outreach.`;
      recommendedAction = company.contactName
        ? `Initiate discreet owner outreach to ${company.contactName} (${company.contactTitle || 'Principal'}).`
        : 'Verify current ownership and the founder’s role before considering discreet outreach.';
      break;

    case 'RESEARCH_OWNER':
      summary = `Strong operational fit (${fitScore}/100) within thesis parameters, but lacks verified ownership succession details (${ownerSignalScore}/100) or corroborated public leadership evidence.`;
      recommendedAction = 'Confirm current ownership, the founder’s operating role, and any external investors using public sources.';
      break;

    case 'MONITOR':
      summary = `Moderate buy-box alignment (${fitScore}/100). Characteristics warrant continued monitoring, but business size, geography, or commercial model does not justify immediate outreach.`;
      recommendedAction = 'Add to quarterly pipeline watch list; monitor for key executive transitions or geographic expansion.';
      break;

    case 'SKIP':
      summary = `Fails acquisition thesis criteria (fit score ${fitScore}/100). Industry mismatch, institutional ownership, or out-of-bounds firmographic parameters.`;
      recommendedAction = 'Archive target from active queue. Re-evaluate only upon structural divestiture or thesis expansion.';
      break;
  }

  return { summary, recommendedAction, unknowns };
}

export function analyzeCompany(
  company: Company,
  thesis: AcquisitionThesis,
  evidence: Evidence[] = []
): CompanyAnalysis {
  const { score: fitScore, components: fitComponents } = calculateFitScore(
    company,
    thesis,
    evidence
  );
  const { score: ownerSignalScore, keySignals } = calculateOwnerSignalScore(
    company,
    evidence
  );
  const confidenceScore = calculateConfidenceScore(company, evidence);
  const actionBucket = determineActionBucket(fitScore, ownerSignalScore, confidenceScore);
  const { summary, recommendedAction, unknowns } = generateIntelligenceInsights(
    company,
    thesis,
    fitScore,
    ownerSignalScore,
    confidenceScore,
    actionBucket,
    keySignals,
    evidence
  );

  return {
    id: `analysis-${company.id}-${Date.now()}`,
    companyId: company.id,
    thesisId: thesis.id,
    fitScore,
    fitComponents,
    ownerSignalScore,
    confidenceScore,
    actionBucket,
    summary,
    recommendedAction,
    unknowns,
    keySignals,
    evidence,
    analyzedAt: new Date().toISOString(),
  };
}
