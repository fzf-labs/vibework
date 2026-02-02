import type { PreviewStatus } from '@/hooks/useVitePreview';
import { ArtifactPreview, type Artifact } from '@/components/artifacts';
import { RightPanel } from '@/components/task';

interface RightPanelSectionProps {
  isVisible: boolean;
  workingDir: string | null;
  branchName: string | null;
  baseBranch: string | null;
  selectedArtifact: Artifact | null;
  artifacts: Artifact[];
  onSelectArtifact: (artifact: Artifact | null) => void;
  livePreviewUrl: string | null;
  livePreviewStatus: PreviewStatus;
  livePreviewError: string | null;
  onStartLivePreview?: () => void;
  onStopLivePreview: () => void;
  onClosePreview: () => void;
}

export function RightPanelSection({
  isVisible,
  workingDir,
  branchName,
  baseBranch,
  selectedArtifact,
  artifacts,
  onSelectArtifact,
  livePreviewUrl,
  livePreviewStatus,
  livePreviewError,
  onStartLivePreview,
  onStopLivePreview,
  onClosePreview,
}: RightPanelSectionProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-muted/10 flex min-w-0 flex-1 flex-col overflow-hidden">
      <RightPanel
        workingDir={workingDir}
        branchName={branchName}
        baseBranch={baseBranch}
        selectedArtifact={selectedArtifact}
        onSelectArtifact={onSelectArtifact}
        livePreviewUrl={livePreviewUrl}
        livePreviewStatus={livePreviewStatus}
        livePreviewError={livePreviewError}
        onStartLivePreview={onStartLivePreview}
        onStopLivePreview={onStopLivePreview}
        renderFilePreview={() => (
          <ArtifactPreview
            artifact={selectedArtifact}
            onClose={onClosePreview}
            allArtifacts={artifacts}
            livePreviewUrl={livePreviewUrl}
            livePreviewStatus={livePreviewStatus}
            livePreviewError={livePreviewError}
            onStartLivePreview={onStartLivePreview}
            onStopLivePreview={onStopLivePreview}
          />
        )}
      />
    </div>
  );
}
