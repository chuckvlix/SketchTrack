import React, { useRef, useEffect } from 'react';
import { Crosshair, Calendar, AlertOctagon, Snowflake, Plus } from 'lucide-react';
import { StageNodeData, CatchupInfo } from '../../types';
import { CompositeStageNode } from './CompositeStageNode';

interface CuttingMatCanvasProps {
  stages: StageNodeData[];
  catchupInfo?: CatchupInfo;
  onOpenPoW: (stage: StageNodeData) => void;
  onToggleCheckpoint: (stageId: string, resourceId: string, chkId: string) => Promise<void>;
  onResizeDuration: (stageId: string, newDays: number) => Promise<void>;
  onSyncCatchup: (stageId: string, shiftDays: number) => Promise<void>;
  onDeleteResource: (stageId: string, resourceId: string) => Promise<void>;
  onAddAuxResourceClick: (stageId: string) => void;
  onAddStage?: () => void;
  capacityError: { message: string } | null;
  onClearCapacityError: () => void;
  onSendToIceboxFromError: () => void;
}

export const CuttingMatCanvas: React.FC<CuttingMatCanvasProps> = ({
  stages,
  catchupInfo,
  onOpenPoW,
  onToggleCheckpoint,
  onResizeDuration,
  onSyncCatchup,
  onDeleteResource,
  onAddAuxResourceClick,
  onAddStage,
  capacityError,
  onClearCapacityError,
  onSendToIceboxFromError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  // Jump to Today action
  const jumpToToday = () => {
    if (todayRef.current && containerRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // Keyboard shortcut: 'T' jumps to today
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        jumpToToday();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ruler dates calculation (spanning 60 days around start)
  const todayDate = new Date();
  const rulerDays = Array.from({ length: 60 }).map((_, i) => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - 7 + i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isToday = d.toDateString() === todayDate.toDateString();
    return {
      date: d,
      dayNum: d.getDate(),
      month: d.toLocaleString('es-ES', { month: 'short' }),
      isWeekend,
      isToday,
      key: d.toISOString().split('T')[0],
    };
  });

  return (
    <div className="relative w-full h-[calc(100vh-68px)] overflow-hidden flex flex-col bg-st-mat-bg select-none">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-6 z-30 flex items-center space-x-3 pointer-events-auto">
        <button
          onClick={jumpToToday}
          className="px-3 py-1.5 bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary rounded-md font-sketch text-xs font-bold shadow-hard-sm hover:brightness-105 flex items-center space-x-1.5 active:translate-y-0.5"
          title="Atajo de teclado: T"
        >
          <Crosshair className="w-4 h-4 text-st-marker-primary" />
          <span>Jump to Today [T]</span>
        </button>

        {/* Legend pills */}
        <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-st-chalk-weekend bg-black/30 px-3 py-1 rounded-md border border-white/10">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 bg-st-chalk-weekend/40 border border-st-chalk-weekend rounded-sm inline-block" />
            <span>Weekend Buffer</span>
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-st-marker-primary inline-block" />
            <span>Línea Today</span>
          </span>
        </div>
      </div>

      {/* Capacity Violation Sticky Note Overlay */}
      {capacityError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-full p-4 bg-red-50 border-2 border-st-red-pencil rounded-md shadow-hard-lg animate-bounce">
          <div className="flex items-start space-x-3">
            <AlertOctagon className="w-6 h-6 text-st-red-pencil shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-sketch font-bold text-st-red-pencil text-sm">
                Exceso de Capacidad (Regla 1+2)
              </h4>
              <p className="text-xs text-st-ink-primary font-sans mt-1">
                {capacityError.message}
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={onSendToIceboxFromError}
                  className="px-3 py-1 bg-st-paper-aux border border-st-ink-primary text-xs font-sketch font-bold rounded flex items-center space-x-1 hover:bg-black/5"
                >
                  <Snowflake className="w-3.5 h-3.5 text-blue-600" />
                  <span>Enviar a Icebox</span>
                </button>
                <button
                  onClick={onClearCapacityError}
                  className="px-3 py-1 bg-white border border-st-ink-primary/40 text-xs font-sketch rounded text-st-ink-muted hover:text-st-ink-primary"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Canvas Stream */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-x-auto overflow-y-hidden cutting-mat-grid relative flex flex-col"
      >
        {/* Top Time Ruler */}
        <div className="h-10 border-b border-white/10 flex items-center text-xs font-mono text-st-chalk-weekend/80 shrink-0 sticky top-0 z-20 bg-st-mat-bg/85 backdrop-blur-sm">
          <div className="flex min-w-max">
            {rulerDays.map((rd) => (
              <div
                key={rd.key}
                style={{ width: '24px' }}
                className={`h-10 flex flex-col items-center justify-center border-r border-white/5 text-[10px] ${
                  rd.isWeekend ? 'bg-st-chalk-weekend/15' : ''
                } ${rd.isToday ? 'bg-st-marker-primary/20 text-st-marker-primary font-bold' : ''}`}
              >
                {rd.isToday && <span className="text-[8px] leading-none uppercase">HOY</span>}
                <span>{rd.dayNum}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stages Area */}
        <div className="flex-1 flex items-center px-12 space-x-8 min-w-max relative pb-10">
          {/* Vertical Today Line Marker */}
          <div
            ref={todayRef}
            style={{ left: `${7 * 24 + 12}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-st-marker-primary pointer-events-none z-10 flex flex-col items-center"
          >
            <div className="px-1.5 py-0.5 bg-st-marker-primary text-white text-[9px] font-mono font-bold rounded-b uppercase shadow-sm">
              Today
            </div>
          </div>

          {/* Magnetic Train of 1+2 Nodes */}
          {stages.map((stage, idx) => (
            <CompositeStageNode
              key={stage.id}
              stage={stage}
              isFirst={idx === 0}
              catchupInfo={idx === 0 ? catchupInfo : undefined}
              onOpenPoW={onOpenPoW}
              onToggleCheckpoint={onToggleCheckpoint}
              onResizeDuration={onResizeDuration}
              onSyncCatchup={onSyncCatchup}
              onDeleteResource={onDeleteResource}
              onAddAuxResourceClick={onAddAuxResourceClick}
            />
          ))}

          {/* Add Next Stage Interactive Button */}
          {onAddStage && (
            <button
              onClick={onAddStage}
              className="h-64 w-40 border-2 border-dashed border-st-chalk-weekend/40 hover:border-st-chalk-weekend rounded-lg flex flex-col items-center justify-center space-y-3 text-st-chalk-weekend hover:text-white transition-all bg-white/5 hover:bg-white/10 shrink-0 shadow-sm cursor-pointer group"
              title="Agregar siguiente etapa al cronograma"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-all group-hover:scale-110">
                <Plus className="w-6 h-6 text-st-marker-primary" />
              </div>
              <span className="font-sketch text-sm font-bold text-center px-2">
                + Agregar Etapa
              </span>
              <span className="text-[10px] font-mono text-st-chalk-weekend/80">
                Regla 1+2
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
