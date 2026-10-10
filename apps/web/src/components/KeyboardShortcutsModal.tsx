'use client';
import { Modal, Kbd, Badge } from '@mantine/core';
import { IconKeyboard } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ opened, onClose }: Props) {
  const shortcuts = [
    { key: '/', description: 'Focus search bar across deals', context: 'Deal Queue' },
    { key: '?', description: 'Open this keyboard shortcuts cheat sheet', context: 'Global' },
    { key: 'Esc', description: 'Close active drawer or modal dialog', context: 'Global' },
    { key: 'J / ↓', description: 'Navigate to next target company in drawer', context: 'Company Drawer' },
    { key: 'K / ↑', description: 'Navigate to previous target company in drawer', context: 'Company Drawer' },
    { key: 'C', description: 'Open CRM / Webhook push modal', context: 'Deal Queue' },
    { key: 'B', description: 'Open Acquisition Buy Box criteria', context: 'Deal Queue' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 font-semibold text-base text-stone-900">
          <IconKeyboard size={20} className="text-emerald-700" />
          Keyboard Shortcuts & Navigation
        </div>
      }
      centered
      size="520px"
      padding="xl"
    >
      <p className="text-xs text-stone-500 mt-0 mb-4">
        DealLens is optimized for high-speed deal evaluation. Use these hotkeys to accelerate your workflow.
      </p>

      <div className="divide-y divide-stone-200/80 border border-stone-200/80 rounded-lg overflow-hidden">
        {shortcuts.map(s => (
          <div key={s.key} className="flex items-center justify-between p-3 bg-white hover:bg-stone-50 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-800 font-medium">{s.description}</span>
              <Badge size="xs" variant="light" color="gray">
                {s.context}
              </Badge>
            </div>
            <Kbd size="xs" className="font-mono font-semibold px-2 py-0.5 shadow-xs">
              {s.key}
            </Kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
