import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Lock, CheckCircle2, ShieldCheck, ExternalLink, Award } from 'lucide-react';
import { ProofOfWorkData, AcceptanceCriterion } from '../../types';
import { SketchStamp } from '../sketch/SketchStamp';

interface ProofOfWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  pow: ProofOfWorkData | null;
  stageTitle: string;
  isStageCompleted: boolean;
  onUpdateCriteria: (criteria: AcceptanceCriterion[]) => Promise<void>;
  onSelectOption: (optionIndex: number) => Promise<void>;
  onSealProofOfWork: (evidenceUrl: string) => Promise<void>;
}

export const ProofOfWorkModal: React.FC<ProofOfWorkModalProps> = ({
  isOpen,
  onClose,
  pow,
  stageTitle,
  isStageCompleted,
  onUpdateCriteria,
  onSelectOption,
  onSealProofOfWork,
}) => {
  const [evidenceUrl, setEvidenceUrl] = useState(pow?.evidence_url || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!pow) return null;

  const criteria = pow.acceptance_criteria || [];
  const allCriteriaChecked = criteria.length > 0 && criteria.every((c) => c.completed);
  const hasValidUrl = evidenceUrl.trim().startsWith('http');
  const canSeal = allCriteriaChecked && hasValidUrl && !isStageCompleted;

  const handleToggleCriterion = async (critId: string) => {
    if (isStageCompleted) return;
    const updated = criteria.map((c) =>
      c.id === critId ? { ...c, completed: !c.completed } : c
    );
    await onUpdateCriteria(updated);
  };

  const handleSeal = async () => {
    if (!canSeal) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSealProofOfWork(evidenceUrl.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al sellar el Proof of Work.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyLabels: Record<string, { label: string; color: string }> = {
    base: { label: 'Nivel Base', color: 'bg-emerald-100 text-emerald-800 border-emerald-400' },
    challenge: { label: 'Nivel Reto', color: 'bg-amber-100 text-amber-800 border-amber-400' },
    portfolio: { label: 'Nivel Portafolio', color: 'bg-purple-100 text-purple-800 border-purple-400' },
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="pow-modal-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary shadow-hard-lg rounded-lg p-6 z-50 max-h-[90vh] overflow-y-auto focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-st-ink-muted uppercase tracking-wider">
                  {stageTitle}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-mono font-medium ${
                    difficultyLabels[pow.difficulty_level]?.color || 'bg-gray-100'
                  }`}
                >
                  {difficultyLabels[pow.difficulty_level]?.label || pow.difficulty_level}
                </span>
              </div>
              <Dialog.Title
                id="pow-modal-title"
                className="font-sketch text-2xl font-bold text-st-ink-primary mt-1"
              >
                {pow.title}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary hover:bg-black/5"
                aria-label="Cerrar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          {/* Stamped badge if already completed */}
          {isStageCompleted && (
            <div className="mb-6 p-4 bg-emerald-50 border-2 border-st-stamp-pow rounded-md flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-8 h-8 text-st-stamp-pow" />
                <div>
                  <h4 className="font-sketch font-bold text-st-stamp-pow text-lg">
                    Entrega Validada y Sellada
                  </h4>
                  <p className="text-xs text-st-ink-muted">
                    Siguiente etapa desbloqueada en el tren magnético.
                  </p>
                </div>
              </div>
              <SketchStamp label="[ENTREGADO]" />
            </div>
          )}

          {/* Switch Proposal Tabs (if options exist and not sealed yet) */}
          {pow.options && pow.options.length > 1 && !isStageCompleted && (
            <div className="mb-6">
              <label className="block text-xs font-mono text-st-ink-muted mb-2 uppercase">
                Opciones de Proyecto Propuestas por la IA:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {pow.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectOption(i)}
                    className={`p-2.5 text-left rounded border transition-all text-xs font-sketch ${
                      pow.selected_option_index === i
                        ? 'bg-st-paper-aux border-st-ink-primary shadow-hard-sm font-bold'
                        : 'bg-white/60 border-st-ink-primary/30 hover:border-st-ink-primary/60 text-st-ink-muted'
                    }`}
                  >
                    <span className="block font-mono text-[10px] text-st-marker-ai uppercase">
                      {opt.difficulty}
                    </span>
                    <span className="line-clamp-2">{opt.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Project Description */}
          <div className="mb-6 bg-white/70 p-4 rounded-md border border-st-ink-primary/20">
            <h4 className="text-xs font-mono uppercase text-st-ink-muted mb-1">
              Descripción del Entregable
            </h4>
            <p className="text-sm font-sans text-st-ink-primary leading-relaxed">
              {pow.description}
            </p>
          </div>

          {/* Acceptance Criteria Checklist */}
          <div className="mb-6">
            <h4 className="font-sketch text-base font-bold text-st-ink-primary mb-2 flex items-center justify-between">
              <span>Criterios Técnicos de Aceptación ({criteria.filter(c => c.completed).length}/{criteria.length})</span>
              <span className="text-xs font-mono font-normal text-st-ink-muted">
                100% requerido para sellar
              </span>
            </h4>
            <div className="space-y-2">
              {criteria.map((crit) => (
                <label
                  key={crit.id}
                  className={`flex items-start space-x-3 p-3 rounded-md border cursor-pointer transition-all ${
                    crit.completed
                      ? 'bg-emerald-50/60 border-emerald-400 text-st-ink-primary'
                      : 'bg-white/60 border-st-ink-primary/20 hover:border-st-ink-primary/40'
                  } ${isStageCompleted ? 'cursor-default' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={crit.completed}
                    disabled={isStageCompleted}
                    onChange={() => handleToggleCriterion(crit.id)}
                    className="mt-0.5 w-4 h-4 rounded text-st-stamp-pow focus:ring-st-stamp-pow border-st-ink-primary/40 cursor-pointer"
                  />
                  <span
                    className={`text-sm font-sans leading-snug ${
                      crit.completed ? 'line-through text-st-ink-muted' : 'text-st-ink-primary'
                    }`}
                  >
                    {crit.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence URL Input */}
          <div className="mb-6">
            <label className="block font-sketch text-sm font-bold text-st-ink-primary mb-1">
              URL de Evidencia Práctica (GitHub, Figma, Deploy en vivo):
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="url"
                value={evidenceUrl}
                disabled={isStageCompleted}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://github.com/tu-usuario/tu-proyecto"
                className="flex-1 px-3 py-2 text-sm bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-mono"
              />
              {pow.evidence_url && (
                <a
                  href={pow.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-st-ink-primary rounded bg-white hover:bg-black/5 text-st-ink-primary"
                  title="Abrir enlace de evidencia"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-st-red-pencil rounded text-xs text-st-red-pencil font-mono">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-st-ink-primary/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-sketch text-sm rounded border border-st-ink-primary/40 hover:bg-black/5 text-st-ink-muted"
            >
              Cerrar
            </button>

            {!isStageCompleted && (
              <button
                type="button"
                onClick={handleSeal}
                disabled={!canSeal || isSubmitting}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-md font-sketch text-base font-bold transition-all shadow-hard-sm ${
                  canSeal
                    ? 'bg-st-stamp-pow text-white hover:brightness-110 active:translate-y-0.5'
                    : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                }`}
              >
                {canSeal ? (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Sellar Entrega [ENTREGADO]</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Requisitos Pendientes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
