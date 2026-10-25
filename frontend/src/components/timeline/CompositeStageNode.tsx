import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  AlertTriangle,
  MoveHorizontal,
  ChevronDown,
  ChevronUp,
  Snowflake,
} from 'lucide-react';
import { StageNodeData, StageResourceData, CatchupInfo } from '../../types';
import { SketchStamp } from '../sketch/SketchStamp';

interface CompositeStageNodeProps {
  stage: StageNodeData;
  isFirst: boolean;
  catchupInfo?: CatchupInfo;
  onOpenPoW: (stage: StageNodeData) => void;
  onToggleCheckpoint: (stageId: string, resourceId: string, chkId: string) => Promise<void>;
  onResizeDuration: (stageId: string, newDurationDays: number) => Promise<void>;
  onSyncCatchup: (stageId: string, shiftDays: number) => Promise<void>;
  onDeleteResource: (stageId: string, resourceId: string) => Promise<void>;
  onAddAuxResourceClick: (stageId: string) => void;
}

export const CompositeStageNode: React.FC<CompositeStageNodeProps> = ({
  stage,
  catchupInfo,
  onOpenPoW,
  onToggleCheckpoint,
  onResizeDuration,
  onSyncCatchup,
  onDeleteResource,
  onAddAuxResourceClick,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [auxExpanded, setAuxExpanded] = useState(true);

  const primaryResource = stage.resources.find((r) => r.slot_type === 'primary');
  const aux1Resource = stage.resources.find((r) => r.slot_type === 'aux_1');
  const aux2Resource = stage.resources.find((r) => r.slot_type === 'aux_2');

  const isCompleted = stage.status === 'completed';
  const isActive = stage.status === 'active';
  const isLocked = stage.status === 'locked';

  // Resize calculation
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const initialDays = stage.duration_days;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // 24px = 1 day
      const daysDelta = Math.round(deltaX / 24);
      const newDays = Math.max(7, initialDays + daysDelta);
      // Visual feedback via element width if needed
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);
      const deltaX = upEvent.clientX - startX;
      const daysDelta = Math.round(deltaX / 24);
      const finalDays = Math.max(7, initialDays + daysDelta);
      if (finalDays !== initialDays) {
        onResizeDuration(stage.id, finalDays);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Node width in pixels (minimum 360px or duration_days * 24px)
  const nodeWidth = Math.max(380, stage.duration_days * 24);

  return (
    <div
      style={{ width: `${nodeWidth}px` }}
      className={`relative select-none transition-shadow ${
        isActive ? 'stationery-card stationery-card-active' : 'stationery-card'
      } ${isLocked ? 'opacity-75 grayscale-[0.35]' : ''} p-5 flex flex-col justify-between shrink-0`}
    >
      {/* Catch-up Engine Masking Tape Banner (Active Stage Only) */}
      {isActive && catchupInfo?.needs_catchup && (
        <div className="absolute -top-3 left-6 right-6 z-20">
          <div className="masking-tape py-1 px-3 rounded text-xs font-sketch font-bold flex items-center justify-between shadow-hard-sm animate-pulse">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-st-red-pencil" />
              <span>Catch-up Engine: {catchupInfo.days_behind} días sin actividad</span>
            </div>
            <button
              onClick={() => onSyncCatchup(stage.id, catchupInfo.suggested_shift_days)}
              className="px-2 py-0.5 bg-black text-white text-[11px] font-mono rounded hover:bg-gray-800 transition-colors"
            >
              Sincronizar (+{catchupInfo.suggested_shift_days} días)
            </button>
          </div>
        </div>
      )}

      {/* Stage Header */}
      <div>
        <div className="flex items-center justify-between border-b border-st-ink-primary/20 pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                isCompleted
                  ? 'bg-emerald-100 text-st-stamp-pow border border-st-stamp-pow'
                  : isActive
                  ? 'bg-amber-100 text-st-marker-primary border border-st-marker-primary'
                  : 'bg-gray-200 text-st-ink-muted border border-gray-300'
              }`}
            >
              {isCompleted ? 'Completada' : isActive ? 'En Curso' : 'Bloqueada'}
            </span>
            <span className="text-xs font-mono text-st-ink-muted">
              {stage.start_date} • {stage.duration_days} días
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-st-stamp-pow" />
            ) : isLocked ? (
              <Lock className="w-4 h-4 text-st-ink-muted" />
            ) : (
              <Unlock className="w-4 h-4 text-st-marker-primary" />
            )}
          </div>
        </div>

        <h3 className="font-sketch text-lg font-bold text-st-ink-primary mb-3 line-clamp-2">
          {stage.title}
        </h3>

        {/* 1+2 Focus Grid */}
        <div className="space-y-3">
          {/* Slot 1: Primary Course (Required) */}
          <div className="p-3 bg-white/90 border border-st-ink-primary/40 rounded-md shadow-hard-sm">
            <div className="flex items-center justify-between text-xs font-mono text-st-marker-primary font-bold mb-1">
              <span className="flex items-center space-x-1">
                <span>[1] CURSO PRINCIPAL</span>
              </span>
              {primaryResource && (
                <span className="text-[11px] font-normal text-st-ink-muted">
                  ~{primaryResource.estimated_hours}h
                </span>
              )}
            </div>

            {primaryResource ? (
              <div>
                <div className="flex items-start justify-between">
                  <a
                    href={primaryResource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sketch text-sm font-semibold text-st-ink-primary hover:text-st-marker-primary flex items-center space-x-1 line-clamp-2"
                  >
                    <span>{primaryResource.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 inline text-st-ink-muted" />
                  </a>
                </div>

                {/* Checkpoints list */}
                {primaryResource.checkpoints && primaryResource.checkpoints.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {primaryResource.checkpoints.map((chk) => (
                      <label
                        key={chk.id}
                        className="flex items-center space-x-2 text-xs font-sans cursor-pointer hover:bg-black/5 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={chk.completed}
                          disabled={isLocked}
                          onChange={() =>
                            onToggleCheckpoint(stage.id, primaryResource.id, chk.id)
                          }
                          className="w-3.5 h-3.5 rounded text-st-marker-primary focus:ring-st-marker-primary cursor-pointer"
                        />
                        <span
                          className={
                            chk.completed ? 'line-through text-st-ink-muted' : 'text-st-ink-primary'
                          }
                        >
                          {chk.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-st-ink-muted italic py-1">
                Ningún curso asignado aún.
              </div>
            )}
          </div>

          {/* Slot 2: Auxiliary Resources (Up to 2) */}
          <div className="stationery-card-aux p-2.5">
            <div
              onClick={() => setAuxExpanded(!auxExpanded)}
              className="flex items-center justify-between text-xs font-mono text-st-ink-muted font-bold cursor-pointer"
            >
              <span>[2] RECURSOS AUXILIARES (MÁX. 2)</span>
              <div className="flex items-center space-x-1">
                <span className="text-[10px]">
                  {[aux1Resource, aux2Resource].filter(Boolean).length}/2
                </span>
                {auxExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </div>

            {auxExpanded && (
              <div className="mt-2 space-y-2">
                {[aux1Resource, aux2Resource].filter(Boolean).map((aux, idx) => (
                  <div
                    key={aux!.id}
                    className="p-2 bg-white/80 border border-st-ink-primary/20 rounded text-xs flex items-center justify-between"
                  >
                    <a
                      href={aux!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sketch font-medium text-st-ink-primary hover:text-st-marker-primary truncate max-w-[240px] flex items-center space-x-1"
                    >
                      <span>{aux!.title}</span>
                      <ExternalLink className="w-3 h-3 inline text-st-ink-muted shrink-0" />
                    </a>
                    {!isLocked && (
                      <button
                        onClick={() => onDeleteResource(stage.id, aux!.id)}
                        className="p-1 text-st-ink-muted hover:text-st-red-pencil"
                        title="Eliminar recurso auxiliar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {(!aux1Resource || !aux2Resource) && !isLocked && (
                  <button
                    onClick={() => onAddAuxResourceClick(stage.id)}
                    className="w-full py-1.5 border border-dashed border-st-ink-primary/40 rounded text-[11px] font-sketch text-st-ink-muted hover:text-st-ink-primary hover:bg-black/5 flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir Recurso Auxiliar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proof of Work Footer Lock / Stamp */}
      <div className="mt-4 pt-3 border-t-2 border-st-ink-primary/20">
        <div
          onClick={() => onOpenPoW(stage)}
          className={`p-3 rounded-md border-2 cursor-pointer transition-all flex items-center justify-between ${
            isCompleted
              ? 'bg-emerald-50 border-st-stamp-pow'
              : 'bg-white border-st-ink-primary/40 hover:border-st-ink-primary shadow-hard-sm'
          }`}
        >
          <div>
            <span className="text-[10px] font-mono uppercase text-st-ink-muted block font-semibold">
              Proof of Work Obligatorio
            </span>
            <span className="font-sketch font-bold text-sm text-st-ink-primary line-clamp-1">
              {stage.proof_of_work?.title || 'Definir Proyecto Entregable'}
            </span>
          </div>

          {isCompleted ? (
            <SketchStamp label="[ENTREGADO]" />
          ) : (
            <div className="p-1.5 rounded bg-gray-100 border border-gray-300 text-st-ink-muted">
              <Lock className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Right Edge Elastic Resize Handle */}
      {!isLocked && (
        <div
          onMouseDown={handleResizeStart}
          title="Arrastra para estirar duración (Auto-shift magnético de etapas posteriores)"
          className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-st-marker-primary/30 flex items-center justify-center transition-colors ${
            isResizing ? 'bg-st-marker-primary/50' : ''
          }`}
        >
          <div className="w-1 h-8 bg-st-ink-primary/40 rounded-full" />
        </div>
      )}
    </div>
  );
};
