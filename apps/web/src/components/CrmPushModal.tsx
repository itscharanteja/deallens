'use client';
import { useState } from 'react';
import {
  Modal,
  Button,
  TextInput,
  Select,
  SegmentedControl,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSend,
  IconCheck,
  IconCloudUpload,
  IconWebhook,
  IconCode,
} from '@tabler/icons-react';
import { EnrichedCompanyResult, CrmPushResponseSchema } from '@deallens/shared';

interface Props {
  opened: boolean;
  onClose: () => void;
  allCompanies: EnrichedCompanyResult[];
  filteredCompanies: EnrichedCompanyResult[];
  selectedCompanies?: EnrichedCompanyResult[];
}

export function CrmPushModal({ opened, onClose, allCompanies, filteredCompanies, selectedCompanies = [] }: Props) {
  const pursueNowCompanies = allCompanies.filter(x => x.analysis.actionBucket === 'PURSUE_NOW');

  const [scope, setScope] = useState<'selected' | 'pursue_now' | 'filtered' | 'all'>(
    selectedCompanies.length > 0 ? 'selected' : 'pursue_now'
  );
  const [destination, setDestination] = useState<'simulated' | 'webhook'>('simulated');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [stage, setStage] = useState('Sourcing & Discovery Queue');
  const [dealOwner, setDealOwner] = useState('Lead Acquisition Analyst');
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetCompanies =
    scope === 'selected' && selectedCompanies.length > 0
      ? selectedCompanies
      : scope === 'pursue_now'
      ? pursueNowCompanies
      : scope === 'filtered'
      ? filteredCompanies
      : allCompanies;

  const sampleDeal = targetCompanies[0];

  const payloadPreview = {
    batchMetadata: {
      stage,
      dealOwner,
      dispatchedCount: targetCompanies.length,
      scope,
    },
    sampleLead: sampleDeal
      ? {
          companyName: sampleDeal.company.name,
          domain: sampleDeal.company.domain,
          industry: sampleDeal.company.industry,
          revenueEstimate: sampleDeal.company.revenue,
          headcount: sampleDeal.company.employees,
          primaryContact: {
            name: sampleDeal.company.contactName,
            title: sampleDeal.company.contactTitle,
            email: sampleDeal.company.contactEmail,
          },
          acquisitionScores: {
            fitScore: sampleDeal.analysis.fitScore,
            ownerSignalScore: sampleDeal.analysis.ownerSignalScore,
            confidenceScore: sampleDeal.analysis.confidenceScore,
          },
          actionBucket: sampleDeal.analysis.actionBucket,
          recommendedNextAction: sampleDeal.analysis.recommendedAction,
          keySuccessionSignals: sampleDeal.analysis.keySignals,
          diligenceUnknowns: sampleDeal.analysis.unknowns,
          evidenceCount: sampleDeal.analysis.evidence.length,
        }
      : null,
  };

  const handlePush = async () => {
    if (!targetCompanies.length) return;
    setError(null);
    setIsPushing(true);

    try {
      const payload = {
        webhookUrl: destination === 'webhook' ? webhookUrl : undefined,
        stage,
        dealOwner,
        scope,
        companies: targetCompanies.map(item => ({
          id: item.company.id,
          name: item.company.name,
          domain: item.company.domain,
          industry: item.company.industry,
          location: item.company.location,
          revenue: item.company.revenue,
          employees: item.company.employees,
          contactName: item.company.contactName,
          contactTitle: item.company.contactTitle,
          contactEmail: item.company.contactEmail,
          fitScore: item.analysis.fitScore,
          ownerSignalScore: item.analysis.ownerSignalScore,
          confidenceScore: item.analysis.confidenceScore,
          actionBucket: item.analysis.actionBucket,
          recommendedAction: item.analysis.recommendedAction,
          keySignals: item.analysis.keySignals,
          evidenceUrls: item.analysis.evidence.map(e => e.sourceUrl),
          unknowns: item.analysis.unknowns,
        })),
      };

      const res = await fetch('/api/v1/integrations/crm-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = CrmPushResponseSchema.parse(await res.json());

      if (!res.ok || 'error' in json) {
        throw new Error(('error' in json ? json.error.message : undefined) || 'Failed to dispatch to CRM integration.');
      }

      notifications.show({
        title: destination === 'webhook' ? 'Webhook dispatched' : 'CRM preview generated',
        message:
          destination === 'webhook'
            ? `Successfully delivered ${targetCompanies.length} deals to ${webhookUrl} (Batch ${json.data.batchId})`
            : `Simulated ${targetCompanies.length} deals in ${stage}. No CRM records were created.`,
        color: 'teal',
        icon: <IconCheck size={18} />,
      });

      onClose();
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : 'The request failed.') || 'An error occurred during dispatch.');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-semibold text-base text-stone-900">
          <IconCloudUpload size={20} className="text-orange-600" />
          Export deals · webhook or simulated CRM
        </div>
      }
      size="650px"
      closeButtonProps={{ 'aria-label': 'Close export options' }}
      centered
      padding="xl"
    >
      <div className="space-y-5">
        <p className="text-sm text-stone-600 leading-relaxed mt-0">
          Send screened opportunities to your own webhook, or preview a simulated CRM payload. The preview does not create records in HubSpot or Salesforce.
        </p>

        {/* Lead Scope Picker */}
        <div>
          <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-2">
            Target Leads
          </label>
          <SegmentedControl
            fullWidth
            size="sm"
            value={scope}
            onChange={v => setScope(v as 'selected' | 'pursue_now' | 'filtered' | 'all')}
            data={[
              ...(selectedCompanies.length > 0
                ? [
                    {
                      value: 'selected',
                      label: `Selected Leads (${selectedCompanies.length})`,
                    },
                  ]
                : []),
              {
                value: 'pursue_now',
                label: `Pursue Now (${pursueNowCompanies.length})`,
              },
              {
                value: 'filtered',
                label: `Current View (${filteredCompanies.length})`,
              },
              {
                value: 'all',
                label: `All Screened (${allCompanies.length})`,
              },
            ]}
          />
        </div>

        {/* Integration Destination */}
        <div>
          <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-2">
            Integration Destination
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              className={`p-3 rounded-lg border text-left transition-all ${
                destination === 'simulated'
                  ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500/30'
                  : 'border-stone-200 bg-white hover:bg-stone-50'
              }`}
              onClick={() => setDestination('simulated')}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-stone-900">
                <IconCloudUpload size={18} className="text-orange-600" />
                HubSpot / Salesforce
              </div>
              <p className="text-xs text-stone-500 mt-1 mb-0 leading-normal">
                Directly maps company firmographics, owner signals, and Tri-Scores to CRM deal objects.
              </p>
            </button>

            <button
              type="button"
              className={`p-3 rounded-lg border text-left transition-all ${
                destination === 'webhook'
                  ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600/30'
                  : 'border-stone-200 bg-white hover:bg-stone-50'
              }`}
              onClick={() => setDestination('webhook')}
            >
              <div className="flex items-center gap-2 font-medium text-sm text-stone-900">
                <IconWebhook size={18} className="text-emerald-700" />
                Live Webhook Endpoint
              </div>
              <p className="text-xs text-stone-500 mt-1 mb-0 leading-normal">
                Dispatches a structured JSON payload to Zapier, Make, Slack, or your internal API.
              </p>
            </button>
          </div>
        </div>

        {destination === 'webhook' && (
          <TextInput
            label="Webhook URL"
            required
            placeholder="https://webhook.site/... or https://hooks.zapier.com/..."
            description="SSRF-safe: Internal RFC1918 and loopback targets are automatically rejected."
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.currentTarget.value)}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Pipeline Stage"
            value={stage}
            onChange={v => setStage(v || 'Sourcing & Discovery Queue')}
            data={[
              'Sourcing & Discovery Queue',
              'Owner Outreach Pending',
              'Initial Conversation Booked',
              'Active Diligence Pipeline',
            ]}
          />
          <TextInput
            label="Assigned Deal Owner"
            value={dealOwner}
            onChange={e => setDealOwner(e.currentTarget.value)}
          />
        </div>

        {/* Live Payload Preview */}
        <div>
          <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <IconCode size={14} className="text-stone-500" />
            Payload Preview (Normalized Deal Structure)
          </span>
          <div className="max-h-40 overflow-y-auto rounded-md bg-stone-900 p-3 text-[11px] text-stone-200 font-mono">
            <pre className="m-0 whitespace-pre-wrap">
              {JSON.stringify(payloadPreview, null, 2)}
            </pre>
          </div>
        </div>

        {error && (
          <Alert color="red" role="alert" title="Dispatch Failed">
            {error}
          </Alert>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-stone-200">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="filled"
            color={destination === 'simulated' ? 'dark' : 'teal'}
            leftSection={<IconSend size={16} />}
            loading={isPushing}
            disabled={!targetCompanies.length || (destination === 'webhook' && !webhookUrl)}
            onClick={handlePush}
          >
            Push {targetCompanies.length} Deals to Pipeline
          </Button>
        </div>
      </div>
    </Modal>
  );
}
