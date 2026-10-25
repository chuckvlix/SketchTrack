import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2, ArrowRight, ExternalLink, Snowflake, BookOpen, Video, FileText, Compass } from 'lucide-react';
import { IceboxItemData, StageNodeData } from '../../types';

interface IceboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: IceboxItemData[];
  stages: StageNodeData[];
  onAddItem: (url: string, title?: string, notes?: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onPromoteItem: (itemId: string, stageId: string, slotType: string) => Promise<void>;
}

export const IceboxDrawer: React.FC<IceboxDrawerProps> = ({
  isOpen,
  onClose,
  items,
  stages,
  onAddItem,
  onDeleteItem,
  onPromoteItem,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedItemForPromote, setSelectedItemForPromote] = useState<IceboxItemData | null>(null);
  const [targetStageId, setTargetStageId] = useState(stages[0]?.id || '');
  const [targetSlot, setTargetSlot] = useState('aux_1');
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setIsAdding(true);
    try {
      await onAddItem(urlInput.trim(), titleInput.trim() || undefined);
      setUrlInput('');
      setTitleInput('');
    } finally {
      setIsAdding(false);
    }
  };

  const handlePromoteConfirm = async () => {
    if (!selectedItemForPromote || !targetStageId) return;
    setPromoteError(null);
    try {
      await onPromoteItem(selectedItemForPromote.id, targetStageId, targetSlot);
      setSelectedItemForPromote(null);
    } catch (err: any) {
      setPromoteError(err.message || 'Error al mover el recurso. Revisa la Regla 1+2.');
    }
  };

  const platformIcons: Record<string, React.ReactNode> = {
    youtube: <Video className="w-3.5 h-3.5 text-red-600" />,
    docs: <FileText className="w-3.5 h-3.5 text-blue-600" />,
    course: <Compass className="w-3.5 h-3.5 text-amber-600" />,
    book: <BookOpen className="w-3.5 h-3.5 text-emerald-600" />,
    article: <FileText className="w-3.5 h-3.5 text-gray-600" />,
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="icebox-drawer-title"
          className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-st-paper-aux text-st-ink-primary border-l-2 border-st-ink-primary shadow-hard-lg z-50 flex flex-col p-6 focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-blue-100 border border-blue-400 rounded">
                <Snowflake className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <Dialog.Title
                  id="icebox-drawer-title"
                  className="font-sketch text-xl font-bold text-st-ink-primary"
                >
                  Bandeja Icebox
                </Dialog.Title>
                <p className="text-xs text-st-ink-muted">
                  Captura recursos sin romper el foco de la etapa activa (Cmd+K)
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary hover:bg-black/5"
                aria-label="Cerrar Icebox"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Quick Capture Input */}
          <form onSubmit={handleAdd} className="mb-4 space-y-2 bg-white/70 p-3 rounded-md border border-st-ink-primary/20">
            <span className="text-xs font-mono text-st-ink-muted uppercase">Captura Rápida de Enlace</span>
            <input
              type="text"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Pega una URL (YouTube, Docs, Curso)..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-mono"
            />
            <div className="flex space-x-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Título opcional (o se extraerá automáticamente)"
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-st-ink-primary/60 rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-sans"
              />
              <button
                type="submit"
                disabled={isAdding}
                className="px-3 py-1.5 bg-st-marker-primary text-white rounded font-sketch text-xs font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Guardando...' : 'Congelar'}</span>
              </button>
            </div>
          </form>

          {/* Item List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-st-ink-muted p-4">
                <Snowflake className="w-8 h-8 text-blue-300 mb-2" />
                <p className="font-sketch text-sm">Tu Icebox está vacía.</p>
                <p className="text-xs text-st-ink-muted mt-1">
                  Pega enlaces interesantes aquí para revisarlos o asignarlos a etapas futuras sin sobrecargar tu sprint actual.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-white border border-st-ink-primary/30 rounded-md shadow-hard-sm hover:border-st-ink-primary transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5 text-xs font-mono text-st-ink-muted mb-1">
                      {platformIcons[item.platform] || platformIcons.article}
                      <span className="uppercase text-[10px]">{item.platform}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-st-ink-muted hover:text-st-ink-primary"
                        title="Abrir recurso"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1 text-st-ink-muted hover:text-st-red-pencil"
                        title="Eliminar de Icebox"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-sketch text-sm font-semibold text-st-ink-primary line-clamp-2">
                    {item.title}
                  </h4>

                  <div className="mt-2 pt-2 border-t border-st-ink-primary/10 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedItemForPromote(item);
                        setPromoteError(null);
                      }}
                      className="px-2 py-1 bg-st-paper-card border border-st-ink-primary text-xs font-sketch rounded hover:bg-black/5 flex items-center space-x-1 text-st-ink-primary"
                    >
                      <span>Mover a Etapa</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Promote Dialog / Drawer Overlay */}
          {selectedItemForPromote && (
            <div className="mt-4 p-4 bg-white border-2 border-st-marker-primary rounded-lg shadow-hard-md">
              <h5 className="font-sketch font-bold text-sm text-st-ink-primary mb-2">
                Asignar "{selectedItemForPromote.title}" al Timeline
              </h5>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-[11px] font-mono text-st-ink-muted mb-1 uppercase">
                    Etapa Destino:
                  </label>
                  <select
                    value={targetStageId}
                    onChange={(e) => setTargetStageId(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-st-ink-primary rounded bg-white font-sketch"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.status === 'active' ? 'Activa' : s.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-st-ink-muted mb-1 uppercase">
                    Slot de la Regla 1+2:
                  </label>
                  <select
                    value={targetSlot}
                    onChange={(e) => setTargetSlot(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-st-ink-primary rounded bg-white font-sketch"
                  >
                    <option value="aux_1">Recurso Auxiliar 1</option>
                    <option value="aux_2">Recurso Auxiliar 2</option>
                    <option value="primary">Curso Principal (1)</option>
                  </select>
                </div>
              </div>

              {promoteError && (
                <div className="mb-2 p-2 bg-red-50 border border-st-red-pencil text-[11px] text-st-red-pencil rounded font-mono">
                  {promoteError}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForPromote(null)}
                  className="px-2 py-1 text-xs font-sketch text-st-ink-muted hover:text-st-ink-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePromoteConfirm}
                  className="px-3 py-1 bg-st-stamp-pow text-white text-xs font-sketch font-bold rounded shadow-hard-sm hover:brightness-110"
                >
                  Confirmar Slot
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
