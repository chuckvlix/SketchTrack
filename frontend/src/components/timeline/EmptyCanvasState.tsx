import React from 'react';
import { Sparkles, Plus, FlaskConical, ArrowRight } from 'lucide-react';

interface EmptyCanvasStateProps {
  onLoadDemo: () => void;
  onOpenAIArchitect: () => void;
  onAddManualStage: () => void;
  isLoading?: boolean;
}

export const EmptyCanvasState: React.FC<EmptyCanvasStateProps> = ({
  onLoadDemo,
  onOpenAIArchitect,
  onAddManualStage,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 max-w-4xl mx-auto text-center z-10">
      <div className="mb-6">
        <h2 className="font-sketch text-3xl font-bold text-st-paper-card tracking-wide drop-shadow-md">
          Tu Mesa de Trabajo está Limpia
        </h2>
        <p className="font-sans text-sm text-st-chalk-weekend max-w-lg mx-auto mt-2 leading-relaxed">
          SketchTrack erradica el <em>tutorial hell</em> aplicando la Regla 1+2 y entregables prácticos obligatorios. Elige cómo quieres iniciar tu próxima ruta de estudio:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: Demo Roadmap */}
        <div
          onClick={onLoadDemo}
          className="stationery-card p-6 flex flex-col justify-between text-left cursor-pointer group hover:scale-[1.02] transition-all bg-st-paper-card border-2 border-st-ink-primary"
        >
          <div>
            <div className="w-10 h-10 rounded-md bg-blue-100 border border-blue-400 flex items-center justify-center text-blue-700 mb-4 shadow-hard-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-st-marker-primary uppercase font-bold tracking-wider">
              1 Clic • Sin Esperas
            </span>
            <h3 className="font-sketch text-lg font-bold text-st-ink-primary mt-1 mb-2">
              Explorar Ruta Demo (Fullstack Career Path)
            </h3>
            <p className="text-xs text-st-ink-muted leading-relaxed font-sans">
              Carga instantáneamente una ruta real de 3 etapas con JavaScript, React, FastAPI, Proof of Work y Catch-up Engine listos para probar.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-st-ink-primary/20 flex items-center justify-between text-xs font-sketch font-bold text-st-ink-primary group-hover:text-st-marker-primary">
            <span>{isLoading ? 'Cargando Demo...' : 'Explorar Demo'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 2: AI Route Architect */}
        <div
          onClick={onOpenAIArchitect}
          className="stationery-card p-6 flex flex-col justify-between text-left cursor-pointer group hover:scale-[1.02] transition-all bg-st-paper-card border-2 border-st-ink-primary relative overflow-hidden"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 bg-st-marker-ai/10 rounded-full pointer-events-none" />
          <div>
            <div className="w-10 h-10 rounded-md bg-purple-100 border border-purple-400 flex items-center justify-center text-st-marker-ai mb-4 shadow-hard-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-st-marker-ai uppercase font-bold tracking-wider">
              Copiloto con Búsqueda Real
            </span>
            <h3 className="font-sketch text-lg font-bold text-st-ink-primary mt-1 mb-2">
              Trazar Ruta con Arquitecto IA
            </h3>
            <p className="text-xs text-st-ink-muted leading-relaxed font-sans">
              Dile qué quieres aprender y tu disponibilidad semanal. La IA buscará recursos reales en YouTube y la Web y dimensionará tu cronograma.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-st-ink-primary/20 flex items-center justify-between text-xs font-sketch font-bold text-st-marker-ai">
            <span>Bocetar Ruta IA</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Card 3: Manual Stage */}
        <div
          onClick={onAddManualStage}
          className="stationery-card p-6 flex flex-col justify-between text-left cursor-pointer group hover:scale-[1.02] transition-all bg-st-paper-card border-2 border-st-ink-primary"
        >
          <div>
            <div className="w-10 h-10 rounded-md bg-amber-100 border border-amber-400 flex items-center justify-center text-amber-800 mb-4 shadow-hard-sm">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-st-ink-muted uppercase font-bold tracking-wider">
              Control Total
            </span>
            <h3 className="font-sketch text-lg font-bold text-st-ink-primary mt-1 mb-2">
              Colocar mi Primer Bloque 1+2
            </h3>
            <p className="text-xs text-st-ink-muted leading-relaxed font-sans">
              Crea una etapa manual vacía comenzando hoy para pegar tus propios enlaces de estudio y definir tus criterios técnicos.
            </p>
          </div>
          <div className="mt-6 pt-3 border-t border-st-ink-primary/20 flex items-center justify-between text-xs font-sketch font-bold text-st-ink-primary group-hover:text-amber-700">
            <span>Crear Bloque Manual</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
