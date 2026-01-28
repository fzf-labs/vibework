/**
 * Setup Page - First-time dependency installation
 *
 * Checks if required CLI tools (Claude Code, Codex) are installed
 * and guides users through installation.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { saveSettingItem } from '@/data/settings';
import { useLanguage } from '@/providers/language-provider';
import { ArrowRight } from 'lucide-react';


interface SetupPageProps {
  /** Called when user skips setup (used by SetupGuard) */
  onSkip?: () => void;
}

export function SetupPage({ onSkip }: SetupPageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const handleContinue = async () => {
    // Mark setup as completed
    await saveSettingItem('setupCompleted', 'true');
    // Clear the dependency cache so SetupGuard will re-check

    // If called from SetupGuard, use callback
    if (onSkip) {
      onSkip();
      return;
    }

    // Otherwise navigate back
    const from = (location.state as { from?: Location })?.from;
    navigate(from?.pathname || '/', { replace: true });
  };

  return (
    <div className="bg-background flex min-h-svh items-center justify-center">
      {/* Main Container - Centered */}
      <div className="w-full max-w-2xl px-6">
        {/* Header */}
        <div className="border-border border-b py-6">
          <h1 className="text-foreground text-2xl font-semibold">
            {t.setup?.title || 'Welcome to vibework'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t.setup?.subtitle ||
              "Let's make sure you have all the required tools installed"}
          </p>
        </div>

        {/* Content */}
        <div className="py-6">
          <div className="border-border rounded-xl border p-6 text-center">
            <p className="text-muted-foreground">
              {t.setup?.noDeps || 'No dependencies to check'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border border-t py-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3">
              {/* Continue Button */}
              <button
                onClick={handleContinue}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                {t.setup?.continue || 'Continue'}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
