import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  calculateFitScore,
  calculateOwnerSignalScore,
  calculateConfidenceScore,
  determineActionBucket,
  DEFAULT_DEMO_THESIS,
  Company,
  Evidence,
} from '@deallens/shared';

describe('Domain Canonicalization & Deduplication', () => {
  it('correctly canonicalizes URLs with protocols, trailing slashes, and paths', () => {
    expect(normalizeDomain('https://www.example.com/')).toBe('example.com');
    expect(normalizeDomain('http://example.com/about-us?ref=123')).toBe('example.com');
    expect(normalizeDomain('www.sub.example.com')).toBe('sub.example.com');
    expect(normalizeDomain('  HTTPS://EXAMPLE.COM  ')).toBe('example.com');
  });
});

describe('Deterministic Fit Scoring', () => {
  const baseCompany: Company = {
    id: 'test-1',
    name: 'Test Managed IT',
    domain: 'testit.com',
    website: 'https://testit.com',
    normalizedDomain: 'testit.com',
    industry: 'IT Services',
    location: 'Denver, CO, United States',
    revenue: 5000000,
    employees: 30,
    foundedYear: 2010,
    crawlStatus: 'SUCCESS',
    crawledPagesCount: 3,
  };

  it('awards full points for perfect thesis alignment', () => {
    const result = calculateFitScore(baseCompany, DEFAULT_DEMO_THESIS);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.components.industry).toBe(20);
    expect(result.components.geography).toBe(15);
    expect(result.components.revenue).toBe(20);
    expect(result.components.employees).toBe(15);
  });

  it('penalizes out-of-range revenue', () => {
    const hugeCompany: Company = {
      ...baseCompany,
      revenue: 80000000, // $80M > $15M max
    };
    const result = calculateFitScore(hugeCompany, DEFAULT_DEMO_THESIS);
    expect(result.components.revenue).toBe(0);
    expect(result.score).toBeLessThan(80);
  });

  it('penalizes exclusion keywords strictly', () => {
    const cryptoCompany: Company = {
      ...baseCompany,
      description: 'Crypto and blockchain cloud hosting services',
    };
    const result = calculateFitScore(cryptoCompany, DEFAULT_DEMO_THESIS);
    expect(result.score).toBe(10); // Heavy exclusion penalty
  });
});

describe('Owner Signal Detection', () => {
  const testCompany: Company = {
    id: 'test-2',
    name: 'Legacy IT Group',
    domain: 'legacyit.com',
    website: 'https://legacyit.com',
    normalizedDomain: 'legacyit.com',
    industry: 'IT Services',
    location: 'Dallas, TX',
    crawlStatus: 'SUCCESS',
    crawledPagesCount: 3,
  };

  it('computes high score when founder and family evidence exist', () => {
    const evidence: Evidence[] = [
      {
        id: 'ev-1',
        companyId: 'test-2',
        type: 'FOUNDER_LED',
        claim: 'Founder led',
        snippet: 'Founded by John Smith in 2004',
        sourceUrl: 'https://legacyit.com/about',
        confidence: 0.95,
        extractionMethod: 'rule',
      },
      {
        id: 'ev-2',
        companyId: 'test-2',
        type: 'FAMILY_OWNED',
        claim: 'Family legacy',
        snippet: 'Second generation family firm',
        sourceUrl: 'https://legacyit.com/about',
        confidence: 0.9,
        extractionMethod: 'rule',
      },
    ];

    const result = calculateOwnerSignalScore(testCompany, evidence);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.keySignals).toContain('Founder-Led Leadership');
    expect(result.keySignals).toContain('Family Owned / Legacy');
  });
});

describe('Action Bucket Classification', () => {
  it('classifies high-fit high-signal target as PURSUE_NOW', () => {
    const bucket = determineActionBucket(85, 75, 80);
    expect(bucket).toBe('PURSUE_NOW');
  });

  it('classifies solid fit but low owner signal as RESEARCH_OWNER', () => {
    const bucket = determineActionBucket(75, 40, 50);
    expect(bucket).toBe('RESEARCH_OWNER');
  });

  it('classifies marginal fit as MONITOR', () => {
    const bucket = determineActionBucket(50, 40, 40);
    expect(bucket).toBe('MONITOR');
  });

  it('classifies low fit as SKIP', () => {
    const bucket = determineActionBucket(30, 20, 30);
    expect(bucket).toBe('SKIP');
  });
});

 describe('Evidence confidence integrity', () => {
  const company: Company = { id: 'confidence', name: 'Test', domain: 'test.example', normalizedDomain: 'test.example', website: 'https://test.example', industry: 'IT Services', location: 'Unknown', crawlStatus: 'SUCCESS', crawledPagesCount: 4 };
  const evidence: Evidence[] = ['FOUNDER_LED', 'OWNER_OPERATED', 'INDEPENDENT', 'OPERATING_HISTORY'].map((type, i) => ({ id: `ev-${i}`, companyId: company.id, type: type as Evidence['type'], claim: 'Public wording', snippet: 'Supporting public wording.', sourceUrl: `https://test.example/page-${i}`, confidence: 0.9, extractionMethod: 'rule' }));
  it('does not count reported financial data as verification', () => {
    expect(calculateConfidenceScore({ ...company, revenue: 9000000, employees: 40 }, evidence)).toBe(calculateConfidenceScore(company, evidence));
  });
  it('caps pending, timeout, blocked and failed checks', () => {
    for (const crawlStatus of ['PENDING', 'TIMEOUT', 'FAILED', 'BLOCKED_OR_UNAVAILABLE'] as const) expect(calculateConfidenceScore({ ...company, crawlStatus }, evidence)).toBeLessThanOrEqual(20);
    expect(calculateConfidenceScore({ ...company, crawlStatus: 'PENDING', crawledPagesCount: 0 }, [])).toBe(0);
  });
  it('caps one source and conflicting ownership, and discounts weak evidence', () => {
    expect(calculateConfidenceScore(company, evidence.map(e => ({ ...e, sourceUrl: 'https://test.example/about' })))).toBeLessThanOrEqual(50);
    expect(calculateConfidenceScore(company, [...evidence, { ...evidence[0], polarity: 'conflicting' }])).toBeLessThanOrEqual(40);
    expect(calculateConfidenceScore(company, evidence.map(e => ({ ...e, confidence: 0.3 })))).toBeLessThan(calculateConfidenceScore(company, evidence));
  });
 });

describe('Geography and canonicalization boundaries', () => {
  it('normalizes credentials, ports and trailing DNS dots to a hostname', () => {
    expect(normalizeDomain('https://www.Example.com.:443/about')).toBe('example.com');
  });
  it('does not confuse Canada or unknown locations with US state abbreviations', () => {
    const base = { id: 'geo', name: 'Geo', domain: '', website: '', normalizedDomain: '', industry: 'IT Services', crawlStatus: 'PENDING' as const, crawledPagesCount: 0 };
    expect(calculateFitScore({ ...base, location: 'Toronto, Canada' }, DEFAULT_DEMO_THESIS).components.geography).toBe(0);
    expect(calculateFitScore({ ...base, location: 'Unknown' }, DEFAULT_DEMO_THESIS).components.geography).toBe(5);
    expect(calculateFitScore({ ...base, location: 'Austin, TX' }, DEFAULT_DEMO_THESIS).components.geography).toBe(15);
  });
});
