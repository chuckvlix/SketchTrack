import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Sparkles,
  Settings,
  Cpu,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { AIProviderConfig } from '../../types';
import { getAIConfig, saveAIConfig, clearAIConfigKey, pingLocalLLM, routeArchitect } from '../../services/llmRouter';
import { SketchLoadingPencil } from '../sketch/SketchLoadingPencil';

interface AICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPlan: (plan: any) => Promise<void>;
}

export const AICopilotModal: React.FC<AICopilotModalProps> = ({
  isOpen,
  onClose,
  onApplyPlan,
}) => {
  const [activeTab, setActiveTab] = useState<'architect' | 'config'>('architect');
  const [config, setConfig] = useState<AIProviderConfig>(getAIConfig());
  const [goal, setGoal] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);

  // Local LLM Diagnostics
  const [pingStatus, setPingStatus] = useState<{ testing: boolean; ok?: boolean; message?: string }>({
    testing: false,
  });
  const [copiedCors, setCopiedCors] = useState(false);

  useEffect(() => {
    setConfig(getAIConfig());
  }, [isOpen]);

  const handleSaveConfig = () => {
    saveAIConfig(config);
    setPingStatus({ testing: false });
  };

  const handleTestLocalConnection = async () => {
    setPingStatus({ testing: true });
    const res = await pingLocalLLM(config.localUrl);
    setPingStatus({
      testing: false,
      ok: res.ok,
      message: res.ok
        ? '¡Conexión exitosa con el servidor LLM local!'
        : res.error || 'No se pudo conectar.',
    });
  };

  const handleCopyCorsCommand = () => {
    navigator.clipboard.writeText('OLLAMA_ORIGINS="http://localhost:5173,http://127.0.0.1:5173" ollama serve');
    setCopiedCors(true);
    setTimeout(() => setCopiedCors(false), 2500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setGeneratedPlan(null);

    try {
      const plan = await routeArchitect(goal.trim(), weeklyHours);
      setGeneratedPlan(plan);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al generar la ruta de estudio.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!generatedPlan) return;
    setIsLoading(true);
    try {
      await onApplyPlan(generatedPlan);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al persistir la ruta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-labelledby="ai-copilot-title"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-st-paper-card text-st-ink-primary border-2 border-st-ink-primary shadow-hard-lg rounded-lg p-6 z-50 max-h-[92vh] overflow-y-auto focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-st-ink-primary/20 pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-100 border border-purple-400 rounded-md">
                <Sparkles className="w-5 h-5 text-st-marker-ai" />
              </div>
              <div>
                <Dialog.Title
                  id="ai-copilot-title"
                  className="font-sketch text-2xl font-bold text-st-ink-primary"
                >
                  Copiloto Curricular & Búsqueda Real
                </Dialog.Title>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xs font-mono text-st-ink-muted">
                    Modo actual:
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-st-paper-aux border border-st-ink-primary/40 text-st-marker-ai">
                    {config.provider === 'demo' && 'Demo Sandbox (Groq + Web Real)'}
                    {config.provider === 'local' && 'LLM Local (LM Studio / Ollama + Web Real)'}
                    {config.provider === 'byok' && 'BYOK (API Key Propia)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab(activeTab === 'architect' ? 'config' : 'architect')}
                className={`p-2 rounded-md border font-sketch text-xs flex items-center space-x-1 transition-all ${
                  activeTab === 'config'
                    ? 'bg-st-paper-aux border-st-ink-primary shadow-hard-sm'
                    : 'bg-white border-st-ink-primary/30 hover:border-st-ink-primary'
                }`}
                title="Configuración de Proveedor de IA"
              >
                <Settings className="w-4 h-4 text-st-ink-primary" />
                <span>{activeTab === 'config' ? 'Volver a Rutas' : 'Configurar IA'}</span>
              </button>
              <Dialog.Close asChild>
                <button
                  className="p-1 rounded-md text-st-ink-muted hover:text-st-ink-primary hover:bg-black/5"
                  aria-label="Cerrar modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* TAB 1: Route Architect */}
          {activeTab === 'architect' && (
            <div>
              {!generatedPlan && !isLoading && (
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div>
                    <label className="block font-sketch text-base font-bold text-st-ink-primary mb-1">
                      ¿Qué quieres aprender y qué meta buscas alcanzar?
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="Ej: Quiero dominar React 19 con TypeScript y Arquitectura Limpia para crear aplicaciones frontend profesionales en 2 meses."
                      className="w-full px-3 py-2 text-sm bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none font-sans"
                    />
                    <p className="text-xs text-st-ink-muted mt-1">
                      El sistema buscará en tiempo real tutoriales en YouTube y documentación oficial verificada para no alucinar enlaces rotos.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-sketch text-sm font-bold text-st-ink-primary">
                        Disponibilidad de estudio:
                      </label>
                      <span className="font-mono text-sm font-bold text-st-marker-primary">
                        {weeklyHours} horas / semana
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
                    <div className="flex justify-between text-[11px] font-mono text-st-ink-muted mt-1">
                      <span>4h (Ritmo Suave)</span>
                      <span>10h-15h (Recomendado)</span>
                      <span>40h (Intensivo)</span>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-st-red-pencil rounded text-xs text-st-red-pencil font-mono">
                      {errorMsg}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-st-marker-ai text-white rounded font-sketch text-base font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Trazar Ruta con IA & Web Real</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Loading State */}
              {isLoading && <SketchLoadingPencil />}

              {/* Generated Plan Preview */}
              {generatedPlan && !isLoading && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50/70 border-2 border-st-marker-ai rounded-md">
                    <span className="text-xs font-mono uppercase text-st-marker-ai font-bold">
                      Ruta Estructurada (Regla 1+2)
                    </span>
                    <h3 className="font-sketch text-xl font-bold text-st-ink-primary mt-1">
                      {generatedPlan.roadmap_title || generatedPlan.title}
                    </h3>
                    <p className="text-xs text-st-ink-muted mt-1 leading-relaxed">
                      {generatedPlan.description}
                    </p>
                  </div>

                  {/* Stage List Preview */}
                  <div className="space-y-3">
                    <h4 className="font-sketch font-bold text-sm text-st-ink-primary">
                      Etapas Encadenadas en el Tren Magnético:
                    </h4>
                    {generatedPlan.stages?.map((stage: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-st-ink-primary rounded-md shadow-hard-sm"
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="font-sketch font-bold text-sm text-st-ink-primary">
                            {stage.title}
                          </h5>
                          <span className="font-mono text-xs px-2 py-0.5 bg-st-paper-aux border border-st-ink-primary/30 rounded font-semibold text-st-ink-muted">
                            {stage.duration_days} días ({stage.estimated_hours}h estimadas)
                          </span>
                        </div>

                        {/* 1+2 Resources Preview */}
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex items-start space-x-2">
                            <span className="font-mono font-bold text-st-marker-primary text-[11px] whitespace-nowrap">
                              [1] Principal:
                            </span>
                            <a
                              href={stage.primary_resource?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-st-ink-primary hover:underline font-sketch flex items-center space-x-1"
                            >
                              <span>{stage.primary_resource?.title}</span>
                              <ExternalLink className="w-3 h-3 text-st-ink-muted inline" />
                            </a>
                          </div>

                          {stage.auxiliary_resources?.map((aux: any, aIdx: number) => (
                            <div key={aIdx} className="flex items-start space-x-2">
                              <span className="font-mono text-st-ink-muted text-[11px] whitespace-nowrap">
                                [2.{aIdx + 1}] Auxiliar:
                              </span>
                              <a
                                href={aux.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-st-ink-muted hover:underline flex items-center space-x-1"
                              >
                                <span>{aux.title}</span>
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </div>
                          ))}
                        </div>

                        {/* PoW Preview */}
                        {stage.proof_of_work_options?.[0] && (
                          <div className="mt-2.5 pt-2 border-t border-st-ink-primary/10 flex items-center justify-between text-xs">
                            <span className="font-sketch font-bold text-st-stamp-pow">
                              PoW: {stage.proof_of_work_options[0].title}
                            </span>
                            <span className="font-mono text-[10px] text-st-ink-muted uppercase">
                              {stage.proof_of_work_options[0].difficulty}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t-2 border-st-ink-primary/20">
                    <button
                      type="button"
                      onClick={() => setGeneratedPlan(null)}
                      className="px-4 py-2 font-sketch text-sm rounded border border-st-ink-primary/40 hover:bg-black/5 text-st-ink-muted"
                    >
                      Bocetar de Nuevo
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="px-6 py-2.5 bg-st-stamp-pow text-white rounded font-sketch text-base font-bold shadow-hard-sm hover:brightness-110 flex items-center space-x-2"
                    >
                      <span>Aplicar Ruta al Canvas</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI Configuration (Hybrid Router) */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-sketch font-bold text-base text-st-ink-primary mb-3">
                  Selecciona el Proveedor de Inteligencia Artificial:
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  {/* Demo Sandbox Option */}
                  <label
                    onClick={() => setConfig({ ...config, provider: 'demo' })}
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      config.provider === 'demo'
                        ? 'bg-st-paper-aux border-st-marker-ai shadow-hard-sm'
                        : 'bg-white border-st-ink-primary/20 hover:border-st-ink-primary/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Globe className="w-5 h-5 text-st-marker-ai" />
                      <span className="font-sketch font-bold text-sm">Demo Sandbox</span>
                    </div>
                    <p className="text-xs text-st-ink-muted leading-relaxed">
                      Ideal para reclutadores. Conexión gestionada con Groq y búsqueda web sin configuración previa.
                    </p>
                  </label>

                  {/* Local LLM Option */}
                  <label
                    onClick={() => setConfig({ ...config, provider: 'local' })}
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      config.provider === 'local'
                        ? 'bg-st-paper-aux border-st-marker-ai shadow-hard-sm'
                        : 'bg-white border-st-ink-primary/20 hover:border-st-ink-primary/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Cpu className="w-5 h-5 text-st-marker-primary" />
                      <span className="font-sketch font-bold text-sm">Local LLM</span>
                    </div>
                    <p className="text-xs text-st-ink-muted leading-relaxed">
                      Para tu uso personal diario. Conecta con LM Studio o Ollama local manteniendo 100% privacidad.
                    </p>
                  </label>

                  {/* BYOK Option */}
                  <label
                    onClick={() => setConfig({ ...config, provider: 'byok' })}
                    className={`p-4 rounded-md border-2 cursor-pointer transition-all ${
                      config.provider === 'byok'
                        ? 'bg-st-paper-aux border-st-marker-ai shadow-hard-sm'
                        : 'bg-white border-st-ink-primary/20 hover:border-st-ink-primary/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Key className="w-5 h-5 text-amber-600" />
                      <span className="font-sketch font-bold text-sm">BYOK (API Key)</span>
                    </div>
                    <p className="text-xs text-st-ink-muted leading-relaxed">
                      Trae tu propia clave de Groq, OpenAI o Anthropic guardada localmente en tu navegador.
                    </p>
                  </label>
                </div>
              </div>

              {/* Local LLM Specific Settings & Diagnostics */}
              {config.provider === 'local' && (
                <div className="p-4 bg-white border border-st-ink-primary/30 rounded-lg space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-st-ink-muted mb-1">
                      URL del Servidor Local (LM Studio o Ollama):
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={config.localUrl}
                        onChange={(e) => setConfig({ ...config, localUrl: e.target.value })}
                        placeholder="http://localhost:1234 o http://localhost:11434"
                        className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleTestLocalConnection}
                        disabled={pingStatus.testing}
                        className="px-4 py-2 bg-st-paper-card border border-st-ink-primary rounded font-sketch text-xs font-bold hover:bg-black/5"
                      >
                        {pingStatus.testing ? 'Probando...' : 'Probar Ping'}
                      </button>
                    </div>
                  </div>

                  {/* Ping Status Message */}
                  {pingStatus.message && (
                    <div
                      className={`p-3 rounded border text-xs font-mono flex items-start space-x-2 ${
                        pingStatus.ok
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-red-50 border-st-red-pencil text-st-red-pencil'
                      }`}
                    >
                      {pingStatus.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-st-stamp-pow mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-st-red-pencil mt-0.5" />
                      )}
                      <span>{pingStatus.message}</span>
                    </div>
                  )}

                  {/* CORS Assistant Card */}
                  <div className="p-3 bg-amber-50/70 border border-amber-300 rounded text-xs">
                    <h5 className="font-sketch font-bold text-amber-900 mb-1">
                      💡 Asistente de CORS Local:
                    </h5>
                    <p className="text-amber-800 mb-2 leading-relaxed">
                      Si el ping falla, el navegador puede estar bloqueando la petición por CORS. Para habilitarlo:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-amber-800 font-sans">
                      <li>
                        <strong>En LM Studio:</strong> Ve a la pestaña Developer / Server y activa <em>"Enable CORS"</em>.
                      </li>
                      <li>
                        <strong>En Ollama:</strong> Inicia el servicio permitiendo el origen del frontend local ejecutando:
                      </li>
                    </ul>
                    <div className="mt-2 flex items-center justify-between bg-black/80 text-emerald-400 p-2 rounded font-mono text-[11px]">
                      <code>OLLAMA_ORIGINS="http://localhost:5173,http://127.0.0.1:5173" ollama serve</code>
                      <button
                        type="button"
                        onClick={handleCopyCorsCommand}
                        className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-white text-[10px] flex items-center space-x-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCors ? '¡Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* BYOK Settings */}
              {config.provider === 'byok' && (
                <div className="p-4 bg-white border border-st-ink-primary/30 rounded-lg space-y-3">
                  {/* Security Notice */}
                  <div className="p-2.5 bg-amber-50/80 border border-amber-300 rounded text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 font-sketch font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Advertencia de Seguridad (BYOK):</span>
                    </div>
                    <p className="text-amber-800 leading-relaxed font-sans text-[11px]">
                      Las API Keys almacenadas en el navegador pueden ser vulnerables si tu entorno no es de confianza. 
                      Utiliza claves con límites de facturación acotados o selecciona almacenamiento en sesión para borrarlas automáticamente al cerrar la pestaña.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-st-ink-muted mb-1">
                      API Key de Groq (o proveedor compatible OpenAI):
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        placeholder="gsk_..."
                        className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-st-ink-primary rounded focus:ring-2 focus:ring-st-marker-primary focus:outline-none"
                      />
                      {config.apiKey && (
                        <button
                          type="button"
                          onClick={() => {
                            clearAIConfigKey();
                            setConfig({ ...config, apiKey: '' });
                          }}
                          className="px-2.5 py-1 text-xs border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 rounded font-sans"
                          title="Borrar clave almacenada"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-st-ink-muted mb-1">
                      Modo de Almacenamiento:
                    </label>
                    <div className="flex items-center space-x-4 text-xs font-sans text-st-ink-primary">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="storageType"
                          value="local"
                          checked={config.storageType !== 'session'}
                          onChange={() => setConfig({ ...config, storageType: 'local' })}
                          className="text-st-marker-primary focus:ring-st-marker-primary"
                        />
                        <span>Local (Persistente)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="storageType"
                          value="session"
                          checked={config.storageType === 'session'}
                          onChange={() => setConfig({ ...config, storageType: 'session' })}
                          className="text-st-marker-primary focus:ring-st-marker-primary"
                        />
                        <span>Sesión Segura (Se borra al cerrar pestaña)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4 border-t border-st-ink-primary/20">
                <button
                  type="button"
                  onClick={() => {
                    handleSaveConfig();
                    setActiveTab('architect');
                  }}
                  className="px-6 py-2 bg-st-marker-primary text-white rounded font-sketch text-sm font-bold shadow-hard-sm hover:brightness-110"
                >
                  Guardar Configuración
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
