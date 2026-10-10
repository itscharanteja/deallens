'use client';
import { useState } from 'react';
import { Modal, Button, Progress } from '@mantine/core';
import { IconArrowRight, IconTarget, IconListSearch, IconFileSearch, IconDownload } from '@tabler/icons-react';
interface Props { opened: boolean; onClose: () => void; onAction: (step: number) => void; }
const steps = [
  { title: 'Start with your acquisition criteria', text: 'Tell DealLens which industry, geography, and business size matter to you. The demo has a complete set of criteria ready to explore.', action: 'Open acquisition criteria', icon: IconTarget },
  { title: 'Focus your research queue', text: 'Choose a priority card, search by company, or filter by fit, confidence, and evidence. Scores update automatically when your criteria change.', action: 'Explore the queue', icon: IconListSearch },
  { title: 'Check what supports the recommendation', text: 'Open a company to read source snippets, understand the scores, and review missing information. Demo snippets are illustrative; imported leads start unverified.', action: 'Open company evidence', icon: IconFileSearch },
  { title: 'Take the research with you', text: 'Copy or download a company brief with sources and open questions. In the queue, Export CSV lets you choose the current filtered view or every company.', action: 'Preview a research brief', icon: IconDownload },
];
export function DemoTourModal({ opened, onClose, onAction }: Props) {
  const [step, setStep] = useState(0);
  const current = steps[step]; const Icon = current.icon;
  return <Modal opened={opened} onClose={onClose} title="A quick guide to DealLens" size="md" padding="xl"><div className="space-y-6"><div className="flex items-center justify-between text-xs text-stone-500"><span>ABOUT ONE MINUTE</span><span>{step + 1} / {steps.length}</span></div><Progress value={(step + 1) / steps.length * 100} size={3} color="teal" /><div className="tour-icon"><Icon size={25} /></div><div><h2 className="text-xl font-semibold tracking-tight mt-0 mb-3">{current.title}</h2><p className="text-sm leading-relaxed text-stone-600">{current.text}</p></div><Button variant="light" fullWidth rightSection={<IconArrowRight size={16} />} onClick={() => onAction(step)}>{current.action}</Button><div className="flex items-center justify-between border-t border-stone-200 pt-4"><Button variant="subtle" color="gray" onClick={onClose}>Skip guide</Button><div className="flex gap-2"><Button variant="default" disabled={!step} onClick={() => setStep(step - 1)}>Back</Button><Button onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)}>{step === steps.length - 1 ? 'Finish' : 'Next'}</Button></div></div></div></Modal>;
}
