'use client';
import { useState } from 'react';
import { Drawer, Button, TextInput, NumberInput, Switch, TagsInput, Textarea, Alert } from '@mantine/core';
import { IconCheck, IconRotate, IconSparkles } from '@tabler/icons-react';
import {
  AcquisitionThesis,
  AcquisitionThesisSchema,
  DEFAULT_DEMO_THESIS,
  COMMERCIAL_SERVICES_THESIS,
  HEALTHCARE_TECH_THESIS,
  } from '@deallens/shared';

interface Props {
  opened: boolean;
  onClose: () => void;
  thesis: AcquisitionThesis;
  onSaveThesis: (thesis: AcquisitionThesis) => void;
  companyCount: number;
}

export function ThesisDrawer({ opened, onClose, thesis, onSaveThesis, companyCount }: Props) {
  const [form, setForm] = useState(thesis);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (patch: Partial<AcquisitionThesis>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setErrors({});
  };

  const applyPreset = (preset: AcquisitionThesis) => {
    setForm(preset);
    setErrors({});
  };

  const save = () => {
    const parsed = AcquisitionThesisSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(e => [String(e.path[0]), e.message])));
      return;
    }
    onSaveThesis(parsed.data);
    onClose();
  };

  return (
    <Drawer closeButtonProps={{ 'aria-label': 'Close acquisition criteria' }} opened={opened} onClose={onClose} position="right" size="560px" title="Acquisition criteria" padding="xl">
      <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-6">
        <p className="text-sm text-stone-600 leading-relaxed mt-0">
          Define the businesses you want to research. Applying changes immediately updates the scores and priorities of all {companyCount} companies.
        </p>

        {/* 1-Click Industry Presets */}
        <div className="p-3.5 bg-stone-50 border border-stone-200/90 rounded-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <IconSparkles size={14} className="text-amber-600" />
              Sourcing Strategy Presets
            </span>
            <span className="text-[11px] text-stone-500">1-click buy box template</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              className={`text-left p-2 rounded-md border text-xs transition-all ${
                form.id === DEFAULT_DEMO_THESIS.id
                  ? 'border-emerald-600 bg-emerald-50/60 font-semibold text-emerald-950 ring-1 ring-emerald-600/30'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
              }`}
              onClick={() => applyPreset(DEFAULT_DEMO_THESIS)}
            >
              <div className="font-medium text-stone-900">B2B IT Services</div>
              <div className="text-[10px] text-stone-500 mt-0.5">$2M–$15M · US</div>
            </button>
            <button
              type="button"
              className={`text-left p-2 rounded-md border text-xs transition-all ${
                form.id === COMMERCIAL_SERVICES_THESIS.id
                  ? 'border-emerald-600 bg-emerald-50/60 font-semibold text-emerald-950 ring-1 ring-emerald-600/30'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
              }`}
              onClick={() => applyPreset(COMMERCIAL_SERVICES_THESIS)}
            >
              <div className="font-medium text-stone-900">Commercial Svcs</div>
              <div className="text-[10px] text-stone-500 mt-0.5">$3M–$20M · US</div>
            </button>
            <button
              type="button"
              className={`text-left p-2 rounded-md border text-xs transition-all ${
                form.id === HEALTHCARE_TECH_THESIS.id
                  ? 'border-emerald-600 bg-emerald-50/60 font-semibold text-emerald-950 ring-1 ring-emerald-600/30'
                  : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
              }`}
              onClick={() => applyPreset(HEALTHCARE_TECH_THESIS)}
            >
              <div className="font-medium text-stone-900">Healthcare IT</div>
              <div className="text-[10px] text-stone-500 mt-0.5">$2M–$12M · US</div>
            </button>
          </div>
        </div>

        <TextInput
          label="Criteria name"
          required
          value={form.name}
          error={errors.name}
          onChange={e => update({ name: e.currentTarget.value })}
        />

        <section>
          <h3 className="section-title">Market</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Industry"
              required
              value={form.industry}
              error={errors.industry}
              onChange={e => update({ industry: e.currentTarget.value })}
            />
            <TextInput
              label="Geography"
              required
              value={form.geography}
              error={errors.geography}
              onChange={e => update({ geography: e.currentTarget.value })}
            />
          </div>
        </section>

        <section>
          <h3 className="section-title">Business size</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberInput
              label="Minimum revenue (USD)"
              min={0}
              thousandSeparator=","
              value={form.minRevenue}
              onChange={v => update({ minRevenue: Number(v) })}
            />
            <NumberInput
              label="Maximum revenue (USD)"
              min={0}
              thousandSeparator=","
              value={form.maxRevenue}
              error={errors.maxRevenue}
              onChange={v => update({ maxRevenue: Number(v) })}
            />
            <NumberInput
              label="Minimum employees"
              min={0}
              allowDecimal={false}
              value={form.minEmployees}
              onChange={v => update({ minEmployees: Number(v) })}
            />
            <NumberInput
              label="Maximum employees"
              min={0}
              allowDecimal={false}
              value={form.maxEmployees}
              error={errors.maxEmployees}
              onChange={v => update({ maxEmployees: Number(v) })}
            />
          </div>
          <NumberInput
            mt="md"
            label="Minimum business age"
            description="Years the business has operated"
            min={0}
            allowDecimal={false}
            suffix=" years"
            value={form.minBusinessAge}
            onChange={v => update({ minBusinessAge: Number(v) })}
          />
        </section>

        <section className="space-y-4">
          <h3 className="section-title">Ownership preferences</h3>
          <Switch
            label="Prefer founder-led businesses"
            description="Use founder or family ownership evidence when assessing fit."
            checked={form.preferFounderLed}
            onChange={e => update({ preferFounderLed: e.currentTarget.checked })}
          />
          <Switch
            label="Prefer independently owned businesses"
            description="Use evidence of independent ownership when assessing fit."
            checked={form.preferIndependent}
            onChange={e => update({ preferIndependent: e.currentTarget.checked })}
          />
        </section>

        <TagsInput
          label="Exclude companies mentioning"
          description="Matching terms in company name, industry, or description reduce fit to 10/100."
          value={form.exclusionKeywords}
          onChange={v => update({ exclusionKeywords: v.filter(x => x.trim()) })}
        />

        <Textarea
          label="Research notes"
          description="For your reference; notes do not affect scoring."
          value={form.notes || ''}
          onChange={e => update({ notes: e.currentTarget.value })}
          rows={3}
        />

        {Object.keys(errors).length > 0 && (
          <Alert color="red" role="alert">Check the highlighted fields before applying your criteria.</Alert>
        )}

        <div className="flex flex-wrap gap-3 justify-between pt-4 border-t border-stone-200">
          <Button
            variant="subtle"
            color="gray"
            type="button"
            leftSection={<IconRotate size={16} />}
            onClick={() => applyPreset(DEFAULT_DEMO_THESIS)}
          >
            Reset to default
          </Button>
          <Button type="submit" leftSection={<IconCheck size={16} />}>
            Apply & rescore
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
