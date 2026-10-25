import React, { useState, useEffect } from 'react';

const MESSAGES = [
  'Calculando densidad del temario (1h video = 2.25h estudio)...',
  'Buscando tutoriales y cursos reales en YouTube y la Web...',
  'Filtrando documentación oficial y verificando enlaces...',
  'Estructurando Nodos Compuestos bajo la Regla 1+2...',
  'Bocetando 3 propuestas de Proof of Work con criterios de entrega...',
];

export const SketchLoadingPencil: React.FC<{ statusText?: string }> = ({ statusText }) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (statusText) return;
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [statusText]);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Animated Sketching Pencil Icon */}
        <svg
          className="w-12 h-12 text-st-marker-ai animate-bounce"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </div>
      <p className="font-sketch text-lg text-st-marker-ai font-medium animate-pulse">
        {statusText || MESSAGES[msgIndex]}
      </p>
      <span className="text-xs text-st-ink-muted font-mono">
        SketchTrack AI Copilot en acción
      </span>
    </div>
  );
};
