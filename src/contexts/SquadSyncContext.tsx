import React, { createContext, useContext, useState, useCallback } from 'react';

interface SquadSyncState {
  isSyncing: boolean;
  currentAgent: string | null;
  step: string | null;
  message: string | null;
  logs: string[];
  brainId: string | null;
  progress: number;
}

interface SquadSyncContextType extends SquadSyncState {
  startSync: (brainId: string) => void;
  updateSync: (update: Partial<SquadSyncState>) => void;
  endSync: () => void;
  addLog: (log: string) => void;
}

const SquadSyncContext = createContext<SquadSyncContextType | undefined>(undefined);

export function SquadSyncProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SquadSyncState>({
    isSyncing: false,
    currentAgent: null,
    step: null,
    message: null,
    logs: [],
    brainId: null,
    progress: 0,
  });

  const startSync = useCallback((brainId: string) => {
    setState({
      isSyncing: true,
      currentAgent: "Controlador",
      step: "init",
      message: "Iniciando linha de produção...",
      logs: [`[${new Date().toLocaleTimeString()}] Sistema de Produção Ativado`],
      brainId,
      progress: 0,
    });
  }, []);

  const updateSync = useCallback((update: Partial<SquadSyncState>) => {
    setState(prev => {
      const newState = { ...prev, ...update };
      // Auto-calculate progress based on agent
      const agents = ["Controlador", "RAG", "Analista", "Psicanalista", "Linguista", "Estrategista", "Verificador", "Pesquisador", "Prompter"];
      if (update.currentAgent) {
        const idx = agents.indexOf(update.currentAgent);
        if (idx !== -1) newState.progress = ((idx + 1) / agents.length) * 100;
      }
      return newState;
    });
  }, []);

  const addLog = useCallback((log: string) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${log}`]
    }));
  }, []);

  const endSync = useCallback(() => {
    setState(prev => ({
      ...prev,
      isSyncing: false,
      message: "Produção Concluída",
      progress: 100,
    }));
    // Reset after some time?
    setTimeout(() => {
      setState(prev => prev.isSyncing ? prev : { ...prev, progress: 0, currentAgent: null });
    }, 5000);
  }, []);

  return (
    <SquadSyncContext.Provider value={{ ...state, startSync, updateSync, endSync, addLog }}>
      {children}
    </SquadSyncContext.Provider>
  );
}

export function useSquadSync() {
  const context = useContext(SquadSyncContext);
  if (!context) {
    throw new Error('useSquadSync must be used within a SquadSyncProvider');
  }
  return context;
}
