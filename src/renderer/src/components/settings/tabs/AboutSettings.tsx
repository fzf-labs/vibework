import { useEffect, useState } from 'react';
import ImageLogo from '@/assets/logo.png';
import { useLanguage } from '@/providers/language-provider';
import { app, shell } from '@/lib/electron-api';
import {
  Download,
} from 'lucide-react';

// Helper function to open external URLs
const openExternalUrl = async (url: string) => {
  try {
    await shell.openUrl(url);
  } catch {
    window.open(url, '_blank');
  }
};

export function AboutSettings() {
  const { t } = useLanguage();
  const [version, setVersion] = useState('0.0.0');

  useEffect(() => {
    app.getVersion()
      .then(setVersion)
      .catch(() => setVersion('0.0.0'));
  }, []);

  return (
    <div className="space-y-4">
      {/* Product Info */}
      <div className="border-border bg-muted/20 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <img src={ImageLogo} alt="VibeWork" className="size-14 rounded-xl" />
          <div className="space-y-1">
            <h2 className="text-foreground text-lg font-semibold">VibeWork</h2>
            <p className="text-muted-foreground text-sm">
              {t.settings.aiPlatform}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="tracking-wider uppercase">
              {t.settings.version}
            </span>
            <span className="text-foreground font-semibold">
              {version}
            </span>
          </div>
          <button
            onClick={() =>
              openExternalUrl(
                'https://VibeWork.ai/download?utm_source=VibeWork_desktop'
              )
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Download className="size-4" />
            {t.settings.downloadNewVersion}
          </button>
        </div>
      </div>
    </div>
  );
}
