import { ArtifactPreview, type Artifact } from '@/components/artifacts';
import { RightPanel } from '@/components/task';

interface RightPanelSectionProps {
  isVisible: boolean;
  taskId: string | null;
  workingDir: string | null;
  branchName: string | null;
  baseBranch: string | null;
  selectedArtifact: Artifact | null;
  artifacts: Artifact[];
  onSelectArtifact: (artifact: Artifact | null) => void;
  workspaceRefreshToken?: number;
  onClosePreview: () => void;
}

export function RightPanelSection({
  isVisible,
  taskId,
  workingDir,
  branchName,
  baseBranch,
  selectedArtifact,
  artifacts,
  onSelectArtifact,
  workspaceRefreshToken,
  onClosePreview,
}: RightPanelSectionProps) {
  if (!isVisible) return null;

  return (
    <div className="bg-muted/10 flex min-w-0 flex-1 flex-col overflow-hidden">
      <RightPanel
        taskId={taskId}
        workingDir={workingDir}
        branchName={branchName}
        baseBranch={baseBranch}
        selectedArtifact={selectedArtifact}
        onSelectArtifact={onSelectArtifact}
        workspaceRefreshToken={workspaceRefreshToken}
        renderFilePreview={() => (
          <ArtifactPreview
            artifact={selectedArtifact}
            onClose={onClosePreview}
            allArtifacts={artifacts}
          />
        )}
      />
    </div>
  );
}
