import React from 'react';
import {
  CheckCircle2,
  Lock,
  ExternalLink,
  AlertTriangle,
  Snowflake,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { StageNodeData, CatchupInfo } from '../../types';
import { SketchStamp } from '../sketch/SketchStamp';

interface MobileTodayViewProps {
  activeStage: StageNodeData | null;
  catchupInfo?: CatchupInfo;
  onOpenPoW: (stage: StageNodeData) => void;
  onToggleCheckpoint: (stageId: string, resourceId: string, chkId: string) => Promise<void>;
  onSyncCatchup: (stageId: string, shiftDays: number) => Promise<void>;
  onOpenIcebox: () => void;
  onOpenCopilot: () => void;
}

export const MobileTodayView: React.FC<MobileTodayViewProps> = ({
  activeStage,
  catchupInfo,
  onOpenPoW,
  onToggleCheckpoint,
  onSyncCatchup,
  onOpenIcebox,
  onOpenCopilot,
}) => {
  if (!activeStage) {
    return (
      <div className="p-6 text-center text-st-chalk-weekend flex flex-col items-center justify-center min-h-[60vh]">
        <h3 className="font-sketch text-xl font-bold mb-2">No hay etapa activa</h3>
        <p className="text-xs font-sans max-w-xs mb-6">
          Abre el menú para cargar una ruta demo o generar una ruta con la IA.
        </p>
        <button
          onClick={onOpenCopilot}
          className="min-h-[48px] px-6 py-3 bg-st-marker-ai text-white rounded font-sketch font-bold flex items-center space-x-2"
        >
          <Sparkles className="w-5 h-5" />
          <span>Trazar Ruta con IA</span>
        </button>
      </div>
    );
  }

  const primaryResource = activeStage.resources?.find((r) => r.slot_type === 'primary');
  const auxResources = (activeStage.resources || []).filter((r) => r.slot_type !== 'primary');

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      {/* Mobile Top Header Indicator */}
      <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/10 text-white">
        <div>
          <span className="text-[10px] font-mono text-st-marker-primary uppercase tracking-wider block font-bold">
            Modo Ejecución (Hoy)
          </span>
          <h2 className="font-sketch text-base font-bold text-st-paper-card line-clamp-1">
            {activeStage.title}
          </h2>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={onOpenIcebox}
            className="min-w-[48px] min-h-[48px] p-2 bg-blue-100 text-blue-800 rounded-md border border-blue-400 flex items-center justify-center"
            title="Abrir Icebox"
          >
            <Snowflake className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenCopilot}
            className="min-w-[48px] min-h-[48px] p-2 bg-purple-100 text-st-marker-ai rounded-md border border-purple-400 flex items-center justify-center"
            title="Abrir Copiloto IA"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Catch-up Engine Warning (if behind) */}
      {catchupInfo?.needs_catchup && (
        <div className="p-4 bg-st-tape-catchup text-st-ink-primary rounded-lg border border-st-ink-primary shadow-hard-sm">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-st-red-pencil shrink-0" />
            <div>
              <h4 className="font-sketch font-bold text-sm">
                ¡Pausa de {catchupInfo.days_behind} días detectada!
              </h4>
              <p className="text-xs mt-1">
                Sincroniza tu cronograma hacia el presente sin culpas ni pérdidas de hábito.
              </p>
              <button
                onClick={() => onSyncCatchup(activeStage.id, catchupInfo.suggested_shift_days)}
                className="mt-3 min-h-[48px] w-full bg-black text-white rounded font-sketch text-sm font-bold flex items-center justify-center"
              >
                Sincronizar Línea de Tiempo (+{catchupInfo.suggested_shift_days} días)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Course Check-in Card */}
      <div className="stationery-card p-4">
        <span className="text-[10px] font-mono font-bold text-st-marker-primary uppercase">
          [1] Curso Principal
        </span>
        <h3 className="font-sketch text-base font-bold text-st-ink-primary mt-0.5 mb-2">
          {primaryResource?.title || 'Sin curso asignado'}
        </h3>

        {primaryResource?.url && (
          <a
            href={primaryResource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs text-st-marker-primary font-sketch hover:underline mb-3"
          >
            <span>Ver contenido en línea</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Big Touch Targets for Checkpoints */}
        <div className="space-y-2 pt-2 border-t border-st-ink-primary/10">
          {primaryResource?.checkpoints?.map((chk) => (
            <label
              key={chk.id}
              className="min-h-[48px] flex items-center space-x-3 p-2 bg-white/70 border border-st-ink-primary/20 rounded cursor-pointer active:bg-white"
            >
              <input
                type="checkbox"
                checked={chk.completed}
                onChange={() => primaryResource && onToggleCheckpoint(activeStage.id, primaryResource.id, chk.id)}
                className="w-5 h-5 rounded text-st-marker-primary border-st-ink-primary/50 focus:ring-st-marker-primary cursor-pointer"
              />
              <span
                className={`text-sm font-sans ${
                  chk.completed ? 'line-through text-st-ink-muted' : 'text-st-ink-primary'
                }`}
              >
                {chk.title}
              </span>
            </label>
          ))}
          {(!primaryResource?.checkpoints || primaryResource.checkpoints.length === 0) && (
            <p className="text-xs text-st-ink-muted py-2 italic font-sans">
              No hay checkpoints definidos para este recurso.
            </p>
          )}
        </div>
      </div>

      {/* Auxiliary Resources List */}
      {auxResources.length > 0 && (
        <div className="stationery-card-aux p-4">
          <span className="text-[10px] font-mono font-bold text-st-ink-muted uppercase">
            [2] Recursos Auxiliares ({auxResources.length}/2)
          </span>
          <div className="mt-2 space-y-2">
            {auxResources.map((aux) => (
              <a
                key={aux.id}
                href={aux.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] flex items-center justify-between p-3 bg-white/80 border border-st-ink-primary/20 rounded font-sketch text-xs text-st-ink-primary hover:text-st-marker-primary"
              >
                <span className="truncate pr-2">{aux.title}</span>
                <ExternalLink className="w-4 h-4 shrink-0 text-st-ink-muted" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Proof of Work Card */}
      <div
        onClick={() => onOpenPoW(activeStage)}
        className="min-h-[56px] stationery-card p-4 cursor-pointer hover:border-st-stamp-pow transition-colors flex items-center justify-between"
      >
        <div>
          <span className="text-[10px] font-mono text-st-stamp-pow uppercase font-bold block">
            Proof of Work Obligatorio
          </span>
          <h4 className="font-sketch font-bold text-sm text-st-ink-primary line-clamp-1">
            {activeStage.proof_of_work?.title || 'Definir Proyecto'}
          </h4>
        </div>

        {activeStage.status === 'completed' ? (
          <SketchStamp label="[ENTREGADO]" />
        ) : (
          <div className="min-w-[48px] min-h-[48px] flex items-center justify-center bg-gray-100 rounded-md border border-gray-300">
            <Lock className="w-5 h-5 text-st-ink-muted" />
          </div>
        )}
      </div>
    </div>
  );
};
