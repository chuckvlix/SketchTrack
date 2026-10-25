import React from 'react';
import {
  Compass,
  Flame,
  Snowflake,
  Sparkles,
  Award,
  Plus,
  Coffee,
} from 'lucide-react';
import { RoadmapData, WorkshopBadgeData } from '../../types';

interface NavbarProps {
  currentRoadmap: RoadmapData | null;
  iceboxCount: number;
  badges: WorkshopBadgeData[];
  onOpenIcebox: () => void;
  onOpenCopilot: () => void;
  onOpenNewRoadmap: () => void;
  onShowBadges: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoadmap,
  iceboxCount,
  badges,
  onOpenIcebox,
  onOpenCopilot,
  onOpenNewRoadmap,
  onShowBadges,
}) => {
  return (
    <header className="h-[68px] bg-[#142833] border-b border-white/10 px-6 flex items-center justify-between select-none shrink-0 z-30">
      {/* Brand & Roadmap Info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-md bg-st-marker-primary border border-white/30 flex items-center justify-center text-white font-sketch font-bold text-xl shadow-hard-sm">
            S
          </div>
          <div>
            <h1 className="font-sketch text-lg font-bold text-white tracking-wide leading-none">
              SketchTrack
            </h1>
            <span className="text-[10px] font-mono text-st-chalk-weekend uppercase">
              Taller de Estudio 1+2
            </span>
          </div>
        </div>

        {currentRoadmap && (
          <div className="hidden lg:flex items-center space-x-2 pl-4 border-l border-white/15">
            <span className="font-sketch font-bold text-sm text-st-paper-card">
              {currentRoadmap.title}
            </span>
            <span className="text-xs font-mono text-st-chalk-weekend bg-black/30 px-2 py-0.5 rounded border border-white/10">
              {currentRoadmap.weekly_hours}h/sem
            </span>
          </div>
        )}
      </div>

      {/* Center Habits / Badges */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Streak Counter */}
        {currentRoadmap && (
          <div
            className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-md text-amber-300 font-mono text-xs font-semibold"
            title="Días consecutivos de actividad (protegido por Weekend Buffer)"
          >
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>{currentRoadmap.streak_days} días de racha</span>
          </div>
        )}

        {/* Weekend Buffer Indicator */}
        <div
          className="flex items-center space-x-1.5 px-3 py-1 bg-st-chalk-weekend/15 border border-st-chalk-weekend/30 rounded-md text-st-chalk-weekend font-mono text-xs"
          title="Los fines de semana no rompen tu racha de estudio"
        >
          <Coffee className="w-3.5 h-3.5" />
          <span>Weekend Buffer Activo</span>
        </div>

        {/* Badges Button */}
        <button
          onClick={onShowBadges}
          className="flex items-center space-x-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/15 rounded-md text-white font-sketch text-xs transition-colors"
        >
          <Award className="w-4 h-4 text-yellow-400" />
          <span>Insignias ({badges.length})</span>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-3">
        {/* Icebox Toggle */}
        <button
          onClick={onOpenIcebox}
          className="px-3 py-1.5 bg-st-paper-aux text-st-ink-primary border border-st-ink-primary rounded-md font-sketch text-xs font-bold shadow-hard-sm hover:brightness-105 flex items-center space-x-1.5 active:translate-y-0.5"
          title="Atajo de teclado: Cmd/Ctrl + K"
        >
          <Snowflake className="w-4 h-4 text-blue-700" />
          <span>Icebox</span>
          {iceboxCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">
              {iceboxCount}
            </span>
          )}
        </button>

        {/* AI Copilot Toggle */}
        <button
          onClick={onOpenCopilot}
          className="px-3.5 py-1.5 bg-st-marker-ai text-white border border-purple-400 rounded-md font-sketch text-xs font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-1.5 active:translate-y-0.5"
        >
          <Sparkles className="w-4 h-4" />
          <span>Copiloto IA</span>
        </button>

        {/* New Roadmap Button */}
        <button
          onClick={onOpenNewRoadmap}
          className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-white"
          title="Crear Nueva Ruta"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
