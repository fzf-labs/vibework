import { useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { Switch } from '../components/Switch';
import type { SettingsTabProps } from '../types';
import {
  isDesktopNotificationSupported,
  isElectronNotificationSupported,
  requestNotificationPermission,
} from '@/lib/notifications';

export function NotificationSettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { t } = useLanguage();
  const [isRequesting, setIsRequesting] = useState(false);

  const isElectronNotifications = isElectronNotificationSupported();
  const supported = isDesktopNotificationSupported();

  const handleToggle = async (
    key: 'taskCompleteNotificationsEnabled' | 'workNodeCompleteNotificationsEnabled',
    enabled: boolean
  ) => {
    if (!enabled) {
      onSettingsChange({ ...settings, [key]: false });
      return;
    }

    if (isElectronNotifications) {
      onSettingsChange({ ...settings, [key]: true });
      return;
    }

    setIsRequesting(true);
    const permission = await requestNotificationPermission();
    setIsRequesting(false);

    if (permission === 'granted') {
      onSettingsChange({ ...settings, [key]: true });
    } else {
      onSettingsChange({ ...settings, [key]: false });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t.settings?.notificationTaskTitle || 'Task completion notifications'}
            </p>
            <p className="text-muted-foreground text-xs">
              {t.settings?.notificationTaskDescription ||
                'Show a desktop notification when a task completes.'}
            </p>
          </div>
          <Switch
            checked={settings.taskCompleteNotificationsEnabled}
            onChange={(enabled) =>
              handleToggle('taskCompleteNotificationsEnabled', enabled)
            }
            disabled={!supported || isRequesting}
          />
        </div>
      </div>

      <div className="border-border rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t.settings?.notificationWorkNodeTitle ||
                'Work node completion notifications'}
            </p>
            <p className="text-muted-foreground text-xs">
              {t.settings?.notificationWorkNodeDescription ||
                'Show a desktop notification when a work node completes.'}
            </p>
          </div>
          <Switch
            checked={settings.workNodeCompleteNotificationsEnabled}
            onChange={(enabled) =>
              handleToggle('workNodeCompleteNotificationsEnabled', enabled)
            }
            disabled={!supported || isRequesting}
          />
        </div>
      </div>

      <div className="text-muted-foreground text-xs">
        {t.settings?.notificationLimitations ||
          'Notifications may be suppressed by focus modes or system policies.'}
      </div>
    </div>
  );
}
