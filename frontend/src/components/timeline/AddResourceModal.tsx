import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus } from 'lucide-react';
import { PlatformType, SlotType } from '../../types';

interface AddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  stageId: string;
  defaultSlotType?: SlotType;
  onAdd: (data: {
    slot_type: string;
    title: string;
    url: string;
    platform: PlatformType;
    estimated_hours?: number;
  }) => Promise<void>;
}

export const AddResourceModal: React.FC<AddResourceModalProps> = ({
  isOpen,
  onClose,
  stageId,
  defaultSlotType = 'aux_1',
  onAdd,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<PlatformType>('youtube');
  const [slotType, setSlotType] = useState<SlotType>(defaultSlotType);
  const [hours, setHours] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onAdd({
        slot_type: slotType,
        title: title.trim(),
        url: url.trim(),
        platform,
        estimated_hours: hours,
      });
      setUrl('');
      setTitle('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al añadir el recurso a la etapa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="add-resource-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary shadow-hard-lg rounded-lg p-6 z-50 focus:outline-none"
        >
          <div className="flex items-center justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <Dialog.Title id="add-resource-title" className="font-sketch text-xl font-bold text-st-ink-primary">
              Añadir Recurso de Estudio
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary">
                <X className="w-6 h-6" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-sketch text-xs font-bold text-st-ink-primary mb-1 uppercase">
                Slot de la Regla 1+2:
              </label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value as SlotType)}
                className="w-full px-3 py-2 text-xs border border-st-ink-primary rounded bg-white font-sketch"
              >
                <option value="aux_1">Recurso Auxiliar 1</option>
                <option value="aux_2">Recurso Auxiliar 2</option>
                <option value="primary">Curso Principal (1)</option>
              </select>
            </div>

            <div>
              <label className="block font-sketch text-xs font-bold text-st-ink-primary mb-1 uppercase">
                URL del Recurso:
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-sketch text-xs font-bold text-st-ink-primary mb-1 uppercase">
                Título del Curso / Documento:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: MDN Docs o Curso en Video"
                className="w-full px-3 py-2 text-xs font-sans bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-sketch text-xs font-bold text-st-ink-primary mb-1 uppercase">
                  Plataforma:
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as PlatformType)}
                  className="w-full px-3 py-2 text-xs border border-st-ink-primary rounded bg-white font-sketch"
                >
                  <option value="youtube">YouTube</option>
                  <option value="docs">Documentación Oficial</option>
                  <option value="course">Curso Online</option>
                  <option value="book">Libro</option>
                  <option value="article">Artículo / Tutorial</option>
                </select>
              </div>

              <div>
                <label className="block font-sketch text-xs font-bold text-st-ink-primary mb-1 uppercase">
                  Horas Estimadas:
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-st-red-pencil text-xs text-st-red-pencil rounded font-mono">
                {errorMsg}
              </div>
            )}

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
                className="px-5 py-2 bg-st-marker-primary text-white rounded font-sketch text-xs font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : 'Añadir Slot'}</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
