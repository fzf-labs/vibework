import { useLanguage } from '@/providers/language-provider';

import type { SettingsTabProps } from '../types';

export function AccountSettings({
  settings,
  onSettingsChange,
}: SettingsTabProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          {t.settings.manageProfile}
        </p>
      </div>

      {/* Nickname */}
      <div className="flex flex-col gap-2">
        <label className="text-foreground block text-sm font-medium">
          {t.settings.nickname}
        </label>
        <input
          type="text"
          value={settings.profile.nickname}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              profile: {
                ...settings.profile,
                nickname: e.target.value,
              },
            })
          }
          placeholder={t.settings.enterNickname}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring block h-10 w-full max-w-sm rounded-lg border px-3 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
        />
      </div>
    </div>
  );
}
