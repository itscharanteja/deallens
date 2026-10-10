import { z } from 'zod';
import { config } from '../../lib/config';
import { Evidence, Company } from '@deallens/shared';

export const StructuredAiSignalSchema = z.object({
  type: z.enum([
    'FOUNDER_LED',
    'FAMILY_OWNED',
    'OWNER_OPERATED',
    'OPERATING_HISTORY',
    'INDEPENDENT',
    'LEADERSHIP',
    'LOCATION',
    'INDUSTRY',
    'OTHER',
  ]),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

export const StructuredAiAnalysisResponseSchema = z.object({
  founderLed: z.boolean(),
  familyOwned: z.boolean(),
  ownerSignalStrength: z.number().min(0).max(1),
  signals: z.array(StructuredAiSignalSchema),
  summary: z.string(),
  unknowns: z.array(z.string()),
});
export type StructuredAiAnalysisResponse = z.infer<
  typeof StructuredAiAnalysisResponseSchema
>;

/**
 * Analyzes unstructured company website text with structured schema guarantees.
 * Strictly falls back to deterministic rule analysis if LLM is unavailable or fails.
 */
export async function analyzeCompanyTextWithAi(
  company: Company,
  pageTexts: string[],
  existingEvidence: Evidence[]
): Promise<StructuredAiAnalysisResponse> {
  const apiKey = config.LLM_API_KEY;

  // If no LLM key provided or empty, use deterministic rule-based structured synthesis
  if (!apiKey) {
    return generateDeterministicStructuredAnalysis(company, existingEvidence);
  }

  try {
    const prompt = `Analyze the following company website snippets for acquisition intelligence.
Company Name: ${company.name}
Domain: ${company.domain}
Snippets:
${pageTexts.slice(0, 3).map(text => text.slice(0, 6000)).join('\n---\n')}

Extract whether the company exhibits founder-led or family-owned characteristics, summarize why this company fits, and list 3-5 diligent unknowns.
CRITICAL GUARDRAIL: Never infer or claim that the owner wants to sell. Never invent financial numbers.
Respond ONLY in valid JSON matching this schema:
{
  "founderLed": boolean,
  "familyOwned": boolean,
  "ownerSignalStrength": number (0 to 1),
  "signals": [
    { "type": "FOUNDER_LED" | "FAMILY_OWNED" | "OWNER_OPERATED" | "OPERATING_HISTORY" | "INDEPENDENT", "evidence": "quote", "confidence": number }
  ],
  "summary": "string",
  "unknowns": ["string"]
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.LLM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM provider error: status ${res.status}`);
    }

    const data = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().max(16000) }) })) }).parse(await res.json());
    const rawContent = data.choices[0]?.message.content;
    const parsedJson = JSON.parse(rawContent ?? '');

    // Validate structured output through Zod
    const validated = StructuredAiAnalysisResponseSchema.parse(parsedJson);
    if (validated.signals.some(signal => !pageTexts.some(text => text.includes(signal.evidence)))) throw new Error('UNGROUNDED_AI_OUTPUT');
    return validated;
  } catch {
    // Graceful fallback to deterministic analysis
    return generateDeterministicStructuredAnalysis(company, existingEvidence);
  }
}

function generateDeterministicStructuredAnalysis(
  company: Company,
  evidence: Evidence[]
): StructuredAiAnalysisResponse {
  const isFounderLed = evidence.some((e) => e.type === 'FOUNDER_LED');
  const isFamilyOwned = evidence.some((e) => e.type === 'FAMILY_OWNED');

  let strength = 0.5;
  if (isFounderLed) strength += 0.25;
  if (isFamilyOwned) strength += 0.2;

  const signals = evidence.map((e) => ({
    type: e.type,
    evidence: e.snippet,
    confidence: e.confidence,
  }));

  const unknowns = [
    'Current equity capitalization and shareholder breakdown',
    'Audited EBITDA margin and revenue recurring percentage',
    'Customer concentration and retention rate',
  ];

  if (!company.revenue) {
    unknowns.unshift('Verified trailing twelve months (TTM) gross revenue');
  }

  const summary = `${company.name} operates in ${company.industry} with an estimated ${company.employees || 'undisclosed number of'} employees. ${
    isFounderLed
      ? 'Exhibits strong founder-operator stewardship.'
      : isFamilyOwned
      ? 'Contains family-ownership wording requiring verification.'
      : 'Requires manual primary research into ownership structure.'
  }`;

  return {
    founderLed: isFounderLed,
    familyOwned: isFamilyOwned,
    ownerSignalStrength: Math.min(1, strength),
    signals,
    summary,
    unknowns,
  };
}
