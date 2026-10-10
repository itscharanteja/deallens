'use client';
import { Button, Menu } from '@mantine/core';
import {
  IconArrowUpRight,
  IconHelpCircle,
  IconRotate,
  IconUpload,
  IconAperture,
  IconCloudUpload,
  IconKeyboard,
} from '@tabler/icons-react';

interface HeaderProps {
  onOpenUpload: () => void;
  onOpenTour: () => void;
  onReset: () => void;
  onOpenCrmPush?: () => void;
  onOpenShortcuts?: () => void;
}

export function Header({
  onOpenUpload,
  onOpenTour,
  onReset,
  onOpenCrmPush,
  onOpenShortcuts,
}: HeaderProps) {
  return (
    <header className="workspace-header">
      <a href="#main-content" className="skip-link">
        Skip to deal queue
      </a>
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 flex items-center justify-between gap-3 h-[76px]">
        <a href="/" className="brand-link" aria-label="DealLens home">
          <span className="brand-mark">
            <IconAperture size={25} stroke={1.7} />
          </span>
          <span>
            DealLens
            <span className="brand-divider" />
            <span className="hidden sm:inline text-sm font-normal text-stone-500">
              Research workspace
            </span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {onOpenCrmPush && (
            <Button
              variant="subtle"
              color="gray"
              className="hidden md:inline-flex"
              leftSection={<IconCloudUpload size={17} className="text-orange-600" />}
              onClick={onOpenCrmPush}
            >
              Push to CRM
            </Button>
          )}
          <Menu position="bottom-end" shadow="md" width={240}>
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconHelpCircle size={17} />}
                aria-label="Workspace help"
              >
                <span className="hidden sm:inline">Help</span>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Workspace guide</Menu.Label>
              <Menu.Item leftSection={<IconArrowUpRight size={16} />} onClick={onOpenTour}>
                Take a quick walkthrough
              </Menu.Item>
              {onOpenShortcuts && (
                <Menu.Item
                  leftSection={<IconKeyboard size={16} className="text-stone-600" />}
                  onClick={onOpenShortcuts}
                >
                  Keyboard shortcuts ( ? )
                </Menu.Item>
              )}
              {onOpenCrmPush && (
                <Menu.Item
                  leftSection={<IconCloudUpload size={16} className="text-orange-600" />}
                  onClick={onOpenCrmPush}
                >
                  Push deals to CRM / Webhook…
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item leftSection={<IconRotate size={16} />} onClick={onReset}>
                Reset demo workspace…
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="filled" leftSection={<IconUpload size={16} />} onClick={onOpenUpload}>
            Import CSV
          </Button>
        </div>
      </div>
    </header>
  );
}
