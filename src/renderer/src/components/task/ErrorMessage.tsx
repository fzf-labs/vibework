import { useState } from 'react';
import { useLanguage } from '@/providers/language-provider';
import { SettingsModal } from '@/components/settings';

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  const { t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Check if this is a Claude Code not found error
  if (message === '__CLAUDE_CODE_NOT_FOUND__') {
    return (
      <>
        <div className="flex items-start gap-3 py-2">
          <WarningIcon className="text-amber-500" />
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">
              {t.common.errors.claudeCodeNotFound}
            </p>
            <SettingsButton onClick={() => setSettingsOpen(true)}>
              {t.common.errors.configureModel}
            </SettingsButton>
          </div>
        </div>
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialCategory="model"
        />
      </>
    );
  }

  // Check if this is an API key error
  if (message === '__API_KEY_ERROR__') {
    return (
      <>
        <div className="flex items-start gap-3 py-2">
          <WarningIcon className="text-amber-500" />
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">
              {t.common.errors.apiKeyError}
            </p>
            <SettingsButton onClick={() => setSettingsOpen(true)}>
              {t.common.errors.configureApiKey}
            </SettingsButton>
          </div>
        </div>
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialCategory="model"
        />
      </>
    );
  }

  // Check if this is an internal error
  const isInternalError = message.startsWith('__INTERNAL_ERROR__|');
  if (isInternalError) {
    const logPath = message.split('|')[1] || '~/.VibeWork/logs/VibeWork.log';
    const errorMessage = (
      t.common.errors.internalError ||
      'Internal server error. Please check log file: {logPath}'
    ).replace('{logPath}', logPath);

    return (
      <div className="flex items-start gap-3 py-2">
        <WarningIcon className="text-destructive" />
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
      </div>
    );
  }

  // Check if error text contains API key related keywords
  const isApiKeyError =
    /invalid api key|api key|authentication|unauthorized|please run \/login/i.test(
      message
    );

  if (isApiKeyError) {
    return (
      <>
        <div className="flex items-start gap-3 py-2">
          <WarningIcon className="text-amber-500" />
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-sm">
              {t.common.errors.apiKeyError}
            </p>
            <SettingsButton onClick={() => setSettingsOpen(true)}>
              {t.common.errors.configureApiKey}
            </SettingsButton>
          </div>
        </div>
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialCategory="model"
        />
      </>
    );
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <WarningIcon className="text-destructive" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

// Helper components
function WarningIcon({ className }: { className?: string }) {
  return (
    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
      <svg viewBox="0 0 16 16" className={`size-4 ${className}`} fill="currentColor">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4.5a1 1 0 112 0v3a1 1 0 11-2 0v-3zm1 7a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    </div>
  );
}

function SettingsButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-primary hover:text-primary/80 cursor-pointer text-left text-sm underline underline-offset-2"
    >
      {children}
    </button>
  );
}
