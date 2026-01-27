import { createContext, useContext } from 'react';

// Context for tool selection - allows child components to select tools
export interface ToolSelectionContextType {
  selectedToolIndex: number | null;
  setSelectedToolIndex: (index: number | null) => void;
  showComputer: () => void;
}

export const ToolSelectionContext =
  createContext<ToolSelectionContextType | null>(null);

export function useToolSelection() {
  const context = useContext(ToolSelectionContext);
  if (!context) {
    throw new Error(
      'useToolSelection must be used within ToolSelectionContext'
    );
  }
  return context;
}
