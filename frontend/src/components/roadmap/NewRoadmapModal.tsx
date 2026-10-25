import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Calendar } from 'lucide-react';

interface NewRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, weeklyHours: number, description?: string) => Promise<void>;
}

export const NewRoadmapModal: React.FC<NewRoadmapModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(title.trim(), weeklyHours, description.trim() || undefined);
      setTitle('');
      setDescription('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="new-roadmap-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary shadow-hard-lg rounded-lg p-6 z-50 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <Dialog.Title id="new-roadmap-title" className="font-sketch text-xl font-bold text-st-ink-primary">
              Crear Nueva Ruta de Estudio
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-sketch text-sm font-bold text-st-ink-primary mb-1">
                Título del Roadmap:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Fundamentos de Arquitectura de Software"
                className="w-full px-3 py-2 text-sm bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-sans"
              />
            </div>

            <div>
              <label className="block font-sketch text-sm font-bold text-st-ink-primary mb-1">
                Descripción (opcional):
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objetivo principal del plan..."
                className="w-full px-3 py-2 text-sm bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-sans"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-sketch text-sm font-bold text-st-ink-primary">
                  Horas semanales disponibles:
                </label>
                <span className="font-mono text-sm font-bold text-st-marker-primary">
                  {weeklyHours}h / semana
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={40}
                step={2}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full h-2 bg-st-paper-aux rounded-lg appearance-none cursor-pointer accent-st-marker-primary"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-st-ink-primary/20">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-sketch text-xs rounded border border-st-ink-primary/30 text-st-ink-muted hover:text-st-ink-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-st-marker-primary text-white rounded font-sketch text-sm font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Creando...' : 'Crear Ruta'}</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
