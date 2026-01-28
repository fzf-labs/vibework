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
    <div className="space-y-6">
      {/* Product Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={ImageLogo} alt="VibeWork" className="size-16 rounded-xl" />
          <div>
            <h2 className="text-foreground text-xl font-bold">VibeWork</h2>
            <p className="text-muted-foreground text-sm">
              {t.settings.aiPlatform}
            </p>
          </div>
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

      {/* Version Info */}
      <div className="border-border bg-muted/20 rounded-lg border p-4">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">
          {t.settings.version}
        </p>
        <p className="text-foreground mt-1 text-lg font-semibold">
          {version}
        </p>
      </div>
    </div>
  );
}
