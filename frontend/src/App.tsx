import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import {
  RoadmapData,
  StageNodeData,
  IceboxItemData,
  WorkshopBadgeData,
  AcceptanceCriterion,
  PlatformType,
} from './types';
import { Navbar } from './components/layout/Navbar';
import { CuttingMatCanvas } from './components/timeline/CuttingMatCanvas';
import { EmptyCanvasState } from './components/timeline/EmptyCanvasState';
import { ProofOfWorkModal } from './components/pow/ProofOfWorkModal';
import { IceboxDrawer } from './components/icebox/IceboxDrawer';
import { AICopilotModal } from './components/copilot/AICopilotModal';
import { BadgesModal } from './components/badges/BadgesModal';
import { NewRoadmapModal } from './components/roadmap/NewRoadmapModal';
import { AddResourceModal } from './components/timeline/AddResourceModal';
import { MobileTodayView } from './components/mobile/MobileTodayView';

export const App: React.FC = () => {
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [currentRoadmap, setCurrentRoadmap] = useState<RoadmapData | null>(null);
  const [iceboxItems, setIceboxItems] = useState<IceboxItemData[]>([]);
  const [badges, setBadges] = useState<WorkshopBadgeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isIceboxOpen, setIsIceboxOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isPoWOpen, setIsPoWOpen] = useState(false);
  const [isNewRoadmapOpen, setIsNewRoadmapOpen] = useState(false);
  const [isBadgesOpen, setIsBadgesOpen] = useState(false);
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);

  // Selected stage for detail/add
  const [selectedStage, setSelectedStage] = useState<StageNodeData | null>(null);
  const [capacityError, setCapacityError] = useState<{ message: string; stageId?: string } | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);

  // Responsive mobile detector (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global keyboard shortcuts (Cmd+K for Icebox)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsIceboxOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Data fetching
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rList, iceList, bList] = await Promise.all([
        api.listRoadmaps(),
        api.listIcebox(),
        api.getBadges(),
      ]);
      setRoadmaps(rList);
      setIceboxItems(iceList);
      setBadges(bList);

      if (rList.length > 0) {
        const fullRoadmap = await api.getRoadmap(rList[0].id);
        setCurrentRoadmap(fullRoadmap);
      } else {
        setCurrentRoadmap(null);
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const refreshCurrentRoadmap = async () => {
    if (!currentRoadmap) return;
    try {
      const updated = await api.getRoadmap(currentRoadmap.id);
      setCurrentRoadmap(updated);
      const bList = await api.getBadges();
      setBadges(bList);
    } catch (err) {
      console.error('Error refrescando roadmap:', err);
    }
  };

  const refreshIcebox = async () => {
    try {
      const iceList = await api.listIcebox();
      setIceboxItems(iceList);
    } catch (err) {
      console.error('Error refrescando icebox:', err);
    }
  };

  // Actions
  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      const res = await api.seedDemoRoadmap();
      const demoRoadmap = await api.getRoadmap(res.roadmap_id);
      setCurrentRoadmap(demoRoadmap);
      const rList = await api.listRoadmaps();
      setRoadmaps(rList);
    } catch (err) {
      console.error('Error cargando demo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoadmap = async (title: string, weeklyHours: number, description?: string) => {
    const res = await api.createRoadmap({ title, weekly_hours: weeklyHours, description });
    // Also create initial stage starting today
    const full = await api.getRoadmap(res.id);
    setCurrentRoadmap(full);
    const rList = await api.listRoadmaps();
    setRoadmaps(rList);
  };

  const handleAddStage = async (stageData?: { title?: string; duration_days?: number; estimated_hours?: number }) => {
    if (!currentRoadmap || isAddingStage) return;
    setIsAddingStage(true);
    try {
      await api.addStage(currentRoadmap.id, stageData);
      await refreshCurrentRoadmap();
      const rList = await api.listRoadmaps();
      setRoadmaps(rList);
    } catch (err) {
      console.error('Error agregando etapa:', err);
    } finally {
      setIsAddingStage(false);
    }
  };

  const handleAddManualStage = async () => {
    if (currentRoadmap) {
      await handleAddStage({
        title: `Etapa ${currentRoadmap.stages.length + 1}: Fundamentos`,
        duration_days: 14,
        estimated_hours: 20.0,
      });
    } else {
      setIsNewRoadmapOpen(true);
    }
  };

  const handleApplyAIRoadmap = async (plan: any) => {
    const res = await api.applyRoadmap(plan);
    const full = await api.getRoadmap(res.roadmap_id);
    setCurrentRoadmap(full);
    const rList = await api.listRoadmaps();
    setRoadmaps(rList);
  };

  const handleToggleCheckpoint = async (stageId: string, resourceId: string, chkId: string) => {
    if (!currentRoadmap) return;
    const stage = currentRoadmap.stages.find((s) => s.id === stageId);
    if (!stage) return;
    const resource = stage.resources.find((r) => r.id === resourceId);
    if (!resource) return;

    const updatedCheckpoints = (resource.checkpoints || []).map((c) =>
      c.id === chkId ? { ...c, completed: !c.completed } : c
    );

    await api.updateResource(currentRoadmap.id, stageId, resourceId, {
      checkpoints: updatedCheckpoints,
    });
    await refreshCurrentRoadmap();
  };

  const handleResizeDuration = async (stageId: string, newDays: number) => {
    if (!currentRoadmap) return;
    await api.updateStage(currentRoadmap.id, stageId, { duration_days: newDays });
    await refreshCurrentRoadmap();
  };

  const handleSyncCatchup = async (stageId: string, shiftDays: number) => {
    if (!currentRoadmap) return;
    await api.triggerCatchupSync(currentRoadmap.id, stageId, shiftDays);
    await refreshCurrentRoadmap();
  };

  const handleDeleteResource = async (stageId: string, resourceId: string) => {
    if (!currentRoadmap) return;
    await api.deleteResource(currentRoadmap.id, stageId, resourceId);
    await refreshCurrentRoadmap();
  };

  const handleAddResource = async (data: {
    slot_type: string;
    title: string;
    url: string;
    platform: PlatformType;
    estimated_hours?: number;
  }) => {
    if (!currentRoadmap || !selectedStage) return;
    try {
      await api.addResource(currentRoadmap.id, selectedStage.id, data);
      await refreshCurrentRoadmap();
    } catch (err: any) {
      if (err.code === 'CAPACITY_LIMIT_EXCEEDED') {
        setCapacityError({ message: err.message, stageId: selectedStage.id });
      }
      throw err;
    }
  };

  // Proof of work handlers
  const handleOpenPoW = (stage: StageNodeData) => {
    setSelectedStage(stage);
    setIsPoWOpen(true);
  };

  const handleUpdatePoWCriteria = async (criteria: AcceptanceCriterion[]) => {
    if (!currentRoadmap || !selectedStage) return;
    await api.updateProofOfWork(currentRoadmap.id, selectedStage.id, {
      acceptance_criteria: criteria,
    });
    await refreshCurrentRoadmap();
    // Update local selected stage state
    const updated = await api.getRoadmap(currentRoadmap.id);
    const updatedStage = updated.stages.find((s) => s.id === selectedStage.id);
    if (updatedStage) setSelectedStage(updatedStage);
  };

  const handleSelectPoWOption = async (optionIndex: number) => {
    if (!currentRoadmap || !selectedStage) return;
    await api.updateProofOfWork(currentRoadmap.id, selectedStage.id, {
      selected_option_index: optionIndex,
    });
    await refreshCurrentRoadmap();
    const updated = await api.getRoadmap(currentRoadmap.id);
    const updatedStage = updated.stages.find((s) => s.id === selectedStage.id);
    if (updatedStage) setSelectedStage(updatedStage);
  };

  const handleSealProofOfWork = async (evidenceUrl: string) => {
    if (!currentRoadmap || !selectedStage) return;
    await api.sealProofOfWork(currentRoadmap.id, selectedStage.id, evidenceUrl);
    await refreshCurrentRoadmap();
  };

  // Icebox handlers
  const handleAddIceboxItem = async (url: string, title?: string, notes?: string) => {
    await api.addIceboxItem({ url, title, notes });
    await refreshIcebox();
  };

  const handleDeleteIceboxItem = async (id: string) => {
    await api.deleteIceboxItem(id);
    await refreshIcebox();
  };

  const handlePromoteIceboxItem = async (itemId: string, stageId: string, slotType: string) => {
    try {
      await api.promoteIceboxItem(itemId, stageId, slotType);
      await refreshIcebox();
      await refreshCurrentRoadmap();
    } catch (err: any) {
      if (err.code === 'CAPACITY_LIMIT_EXCEEDED') {
        setCapacityError({ message: err.message, stageId });
      }
      throw err;
    }
  };

  const activeStage = currentRoadmap?.stages.find((s) => s.status === 'active') || null;

  return (
    <div className="w-screen h-screen flex flex-col bg-st-mat-bg text-st-ink-primary overflow-hidden">
      {/* Top Navbar */}
      <Navbar
        currentRoadmap={currentRoadmap}
        iceboxCount={iceboxItems.length}
        badges={badges}
        onOpenIcebox={() => setIsIceboxOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenNewRoadmap={() => setIsNewRoadmapOpen(true)}
        onShowBadges={() => setIsBadgesOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-st-paper-card font-sketch text-lg animate-pulse">
            Preparando mesa de corte...
          </div>
        ) : !currentRoadmap || currentRoadmap.stages.length === 0 ? (
          <EmptyCanvasState
            onLoadDemo={handleLoadDemo}
            onOpenAIArchitect={() => setIsCopilotOpen(true)}
            onAddManualStage={handleAddManualStage}
            isLoading={isLoading}
          />
        ) : isMobile ? (
          /* Mobile Viewport (< 768px): Modo Ejecución (Hoy) */
          <div className="h-full overflow-y-auto">
            <MobileTodayView
              activeStage={activeStage}
              catchupInfo={currentRoadmap.catchup}
              onOpenPoW={handleOpenPoW}
              onToggleCheckpoint={handleToggleCheckpoint}
              onSyncCatchup={handleSyncCatchup}
              onOpenIcebox={() => setIsIceboxOpen(true)}
              onOpenCopilot={() => setIsCopilotOpen(true)}
            />
          </div>
        ) : (
          /* Desktop Viewport (>= 768px): Timeline Stream en Alfombrilla de Corte */
          <CuttingMatCanvas
            stages={currentRoadmap.stages}
            catchupInfo={currentRoadmap.catchup}
            onOpenPoW={handleOpenPoW}
            onToggleCheckpoint={handleToggleCheckpoint}
            onResizeDuration={handleResizeDuration}
            onSyncCatchup={handleSyncCatchup}
            onDeleteResource={handleDeleteResource}
            onAddAuxResourceClick={(stageId) => {
              const stg = currentRoadmap.stages.find((s) => s.id === stageId);
              if (stg) {
                setSelectedStage(stg);
                setIsAddResourceOpen(true);
              }
            }}
            onAddStage={() => handleAddStage()}
            capacityError={capacityError}
            onClearCapacityError={() => setCapacityError(null)}
            onSendToIceboxFromError={() => {
              setCapacityError(null);
              setIsIceboxOpen(true);
            }}
          />
        )}
      </main>

      {/* Modals & Slide-over Drawers */}
      <ProofOfWorkModal
        isOpen={isPoWOpen}
        onClose={() => setIsPoWOpen(false)}
        pow={selectedStage?.proof_of_work || null}
        stageTitle={selectedStage?.title || ''}
        isStageCompleted={selectedStage?.status === 'completed'}
        onUpdateCriteria={handleUpdatePoWCriteria}
        onSelectOption={handleSelectPoWOption}
        onSealProofOfWork={handleSealProofOfWork}
      />

      <IceboxDrawer
        isOpen={isIceboxOpen}
        onClose={() => setIsIceboxOpen(false)}
        items={iceboxItems}
        stages={currentRoadmap?.stages || []}
        onAddItem={handleAddIceboxItem}
        onDeleteItem={handleDeleteIceboxItem}
        onPromoteItem={handlePromoteIceboxItem}
      />

      <AICopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        onApplyPlan={handleApplyAIRoadmap}
      />

      <BadgesModal
        isOpen={isBadgesOpen}
        onClose={() => setIsBadgesOpen(false)}
        badges={badges}
      />

      <NewRoadmapModal
        isOpen={isNewRoadmapOpen}
        onClose={() => setIsNewRoadmapOpen(false)}
        onCreate={handleCreateRoadmap}
      />

      {selectedStage && (
        <AddResourceModal
          isOpen={isAddResourceOpen}
          onClose={() => setIsAddResourceOpen(false)}
          stageId={selectedStage.id}
          onAdd={handleAddResource}
        />
      )}
    </div>
  );
};
