import React, { useEffect } from 'react';
import { useStoryStore } from './store/useStoryStore';
import Header from './components/Header';
import LeftSidebar from './components/LeftSidebar';
import DatabaseWorkspace from './components/DatabaseWorkspace';
import MapView from './components/MapView';
import GraphCanvas from './components/GraphCanvas';
import NodeDrawer from './components/NodeDrawer';
import CharactersModal from './components/CharactersModal';
import WorldLoreModal from './components/WorldLoreModal';
import AiSettingsModal from './components/AiSettingsModal';
import ExportModal from './components/ExportModal';
import ProjectsModal from './components/ProjectsModal';
import { Loader2 } from 'lucide-react';

import { preloadGeoAssets } from './services/geoPreloader';

export default function App() {
  const loadProject = useStoryStore((s) => s.loadProject);
  const isLoading = useStoryStore((s) => s.isLoading);
  const activeWorkspace = useStoryStore((s) => s.activeWorkspace);

  useEffect(() => {
    loadProject();
    preloadGeoAssets();
  }, [loadProject]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium">正在加载本地故事工程与世界观数据...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <Header />

      {/* Main Workspace: Collapsible Sidebar + Dynamic Fullscreen Workspaces */}
      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar />
        <main className="flex-1 relative overflow-hidden bg-slate-950">
          <div
            className="w-full h-full"
            style={{ display: activeWorkspace === 'nodes' ? 'block' : 'none' }}
          >
            <GraphCanvas />
            <NodeDrawer />
          </div>

          <div
            className="w-full h-full"
            style={{ display: activeWorkspace === 'database' ? 'block' : 'none' }}
          >
            <DatabaseWorkspace />
          </div>

          <div
            className="w-full h-full"
            style={{ display: activeWorkspace === 'map' ? 'flex' : 'none' }}
          >
            <MapView isActive={activeWorkspace === 'map'} />
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <CharactersModal />
      <WorldLoreModal />
      <AiSettingsModal />
      <ExportModal />
      <ProjectsModal />
    </div>
  );
}

