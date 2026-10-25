import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Award, ShieldCheck, Flame, Zap } from 'lucide-react';
import { WorkshopBadgeData } from '../../types';

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: WorkshopBadgeData[];
}

export const BadgesModal: React.FC<BadgesModalProps> = ({ isOpen, onClose, badges }) => {
  const allPossibleBadges = [
    {
      key: 'first_pow_stamped',
      title: 'Primer PoW Sellado',
      description: 'Completaste y validaste tu primer proyecto práctico entregable con repositorio o deploy.',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-600" />,
      color: 'border-emerald-500 bg-emerald-50',
    },
    {
      key: 'triad_1_2_completed',
      title: 'Tríada 1+2 Completada',
      description: 'Llegaste al final de tu ruta de estudio cumpliendo el foco estricto sin tutorial hell.',
      icon: <Zap className="w-6 h-6 text-purple-600" />,
      color: 'border-purple-500 bg-purple-50',
    },
    {
      key: 'unstoppable_catchup',
      title: 'Retorno Imparable tras Catch-up',
      description: 'Sincronizaste tu cronograma tras una pausa y retomaste tu hábito de estudio sin culpa.',
      icon: <Flame className="w-6 h-6 text-amber-600" />,
      color: 'border-amber-500 bg-amber-50',
    },
  ];

  const unlockedKeys = new Set(badges.map((b) => b.badge_key));

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="badges-modal-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary shadow-hard-lg rounded-lg p-6 z-50 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <Award className="w-6 h-6 text-yellow-500" />
              <Dialog.Title id="badges-modal-title" className="font-sketch text-2xl font-bold text-st-ink-primary">
                Insignias de Taller
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <p className="text-xs text-st-ink-muted mb-4 font-sans leading-relaxed">
            Las insignias de SketchTrack se ganan <strong>únicamente construyendo y entregando software real</strong>, no acumulando horas pasivas de video.
          </p>

          <div className="space-y-3">
            {allPossibleBadges.map((badge) => {
              const isUnlocked = unlockedKeys.has(badge.key);
              return (
                <div
                  key={badge.key}
                  className={`p-4 rounded-md border-2 transition-all flex items-start space-x-3.5 ${
                    isUnlocked
                      ? `${badge.color} shadow-hard-sm`
                      : 'border-dashed border-gray-300 bg-gray-50/50 opacity-60'
                  }`}
                >
                  <div className="p-2 bg-white rounded-md border border-st-ink-primary/20 shrink-0">
                    {badge.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-sketch font-bold text-sm text-st-ink-primary">
                        {badge.title}
                      </h4>
                      <span className="font-mono text-[10px] uppercase font-bold text-st-ink-muted">
                        {isUnlocked ? 'Desbloqueada' : 'Bloqueada'}
                      </span>
                    </div>
                    <p className="text-xs text-st-ink-muted mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
