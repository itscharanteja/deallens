import { FastifyPluginAsync } from 'fastify';
import { CrmPushRequestSchema } from '@deallens/shared';
import { isSafeUrl } from '../services/crawler/ssrf';
import { safeRequest } from '../services/crawler/http';


export const integrationsRoutes: FastifyPluginAsync = async fastify => {
  fastify.post('/api/v1/integrations/crm-push', async (request, reply) => {
    const parseResult = CrmPushRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid CRM push payload schema.',
          details: parseResult.error.issues,
        },
      });
    }

    const { webhookUrl, stage, dealOwner, scope, companies } = parseResult.data;

    if (!companies.length) {
      return reply.status(400).send({
        error: {
          code: 'EMPTY_PAYLOAD',
          message: 'No companies provided to push to CRM.',
        },
      });
    }

    const batchId = `BATCH-CRM-${Date.now().toString(36).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const crmPayload = {
      batchId,
      dispatchedAt: timestamp,
      stage,
      dealOwner,
      scope,
      totalCount: companies.length,
      deals: companies.map(c => ({
        companyName: c.name,
        domain: c.domain,
        industry: c.industry,
        geography: c.location,
        revenueEstimate: c.revenue,
        headcountEstimate: c.employees,
        primaryContact: {
          name: c.contactName,
          title: c.contactTitle,
          email: c.contactEmail,
        },
        scores: {
          acquisitionFit: c.fitScore,
          ownerSignal: c.ownerSignalScore,
          evidenceConfidence: c.confidenceScore,
        },
        actionBucket: c.actionBucket,
        recommendedAction: c.recommendedAction,
        successionSignals: c.keySignals,
        sourceUrls: c.evidenceUrls,
        diligenceUnknowns: c.unknowns,
      })),
    };

    // If an external webhook is provided, dispatch safely
    if (webhookUrl && webhookUrl.trim() !== '') {
      const safetyCheck = isSafeUrl(webhookUrl);
      if (!safetyCheck.safe) {
        return reply.status(400).send({
          error: {
            code: 'SSRF_BLOCKED',
            message: `Webhook destination blocked: ${safetyCheck.reason}`,
          },
        });
      }

      try {
        const externalResponse = await safeRequest(webhookUrl, { method: 'POST', body: JSON.stringify(crmPayload), timeoutMs: 5000, maxBytes: 64 * 1024 });
        if (externalResponse.status < 200 || externalResponse.status >= 300) throw new Error('WEBHOOK_HTTP_ERROR');

        return reply.status(200).send({
          data: {
            success: true,
            mode: 'live_webhook',
            status: externalResponse.status,
            batchId,
            dispatched: companies.length,
            stage,
            timestamp,
          },
        });
      } catch {
        return reply.status(502).send({
          error: {
            code: 'WEBHOOK_DISPATCH_FAILED',
            message: 'The webhook did not accept the payload. Check the destination and retry.',
            details: { webhookUrl, batchId },
          },
        });
      }
    }

    // Default simulated CRM push (HubSpot / Salesforce pipeline simulator)
    return reply.status(200).send({
      data: {
        success: true,
        mode: 'simulated_crm',
        status: 200,
        batchId,
        dispatched: companies.length,
        stage,
        timestamp,
        preview: crmPayload,
      },
    });
  });
};
