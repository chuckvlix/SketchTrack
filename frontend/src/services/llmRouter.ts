import { AIProviderConfig } from '../types';
import { api } from './api';

const DEFAULT_CONFIG: AIProviderConfig = {
  provider: 'demo',
  localUrl: 'http://localhost:1234', // LM Studio default, or http://localhost:11434 for Ollama
  apiKey: '',
  byokProvider: 'groq',
  storageType: 'local',
};

/**
 * Sanitizes an API key by stripping leading/trailing whitespace,
 * control characters, newlines, tabs, and null bytes.
 * Prevents HTTP header injection and corrupted tokens.
 */
export function sanitizeApiKey(key: string | undefined | null): string {
  if (!key) return '';
  return key.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

/**
 * Emits an explicit audit warning regarding Web Storage risks for API keys.
 * API keys stored in localStorage or sessionStorage are accessible to client-side scripts.
 */
export function logStorageSecurityWarning(): void {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      '[SketchTrack Security] ADVERTENCIA: Las API Keys se almacenan en el Web Storage del navegador. ' +
      'Esto puede ser vulnerable ante ataques XSS en entornos no confiables. ' +
      'Recomendación: usa claves de API con cuotas estrictas y permisos limitados, o utiliza la opción Local LLM (Ollama/LM Studio).'
    );
  }
}

export function getAIConfig(): AIProviderConfig {
  try {
    // Check sessionStorage first (secure session-only storage)
    const sessionSaved = sessionStorage.getItem('sketchtrack_ai_config');
    if (sessionSaved) {
      const parsed = JSON.parse(sessionSaved);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiKey: sanitizeApiKey(parsed.apiKey),
        storageType: 'session',
      };
    }

    const localSaved = localStorage.getItem('sketchtrack_ai_config');
    if (localSaved) {
      const parsed = JSON.parse(localSaved);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiKey: sanitizeApiKey(parsed.apiKey),
        storageType: parsed.storageType || 'local',
      };
    }
  } catch {
    return DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIProviderConfig) {
  const sanitizedKey = sanitizeApiKey(config.apiKey);
  const targetStorageType = config.storageType || 'local';

  const configToSave: AIProviderConfig = {
    ...config,
    apiKey: sanitizedKey,
    storageType: targetStorageType,
    localUrl: config.localUrl ? config.localUrl.trim() : DEFAULT_CONFIG.localUrl,
  };

  if (sanitizedKey) {
    logStorageSecurityWarning();
  }

  try {
    if (targetStorageType === 'session') {
      sessionStorage.setItem('sketchtrack_ai_config', JSON.stringify(configToSave));
      localStorage.removeItem('sketchtrack_ai_config');
    } else {
      localStorage.setItem('sketchtrack_ai_config', JSON.stringify(configToSave));
      sessionStorage.removeItem('sketchtrack_ai_config');
    }
  } catch (err) {
    console.error('[SketchTrack] Error guardando configuración de IA:', err);
  }
}

export function clearAIConfigKey(): void {
  try {
    const current = getAIConfig();
    saveAIConfig({ ...current, apiKey: '' });
  } catch (err) {
    console.error('[SketchTrack] Error limpiando configuración de IA:', err);
  }
}

export async function pingLocalLLM(url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    // Test OpenAI-compatible endpoint
    const res = await fetch(`${cleanUrl}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `El servidor respondió con código ${res.status}` };
  } catch (err: any) {
    return {
      ok: false,
      error:
        err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
          ? 'Error de conexión o bloqueo de CORS. Asegúrate de que LM Studio o Ollama esté corriendo con orígenes permitidos.'
          : err.message,
    };
  }
}

function findJsonSubstring(text: string): string | null {
  for (let i = 0; i < text.length; i++) {
    const startChar = text[i];
    if (startChar === '{' || startChar === '[') {
      const endChar = startChar === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < text.length; j++) {
        const c = text[j];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (c === '\\') {
            escape = true;
          } else if (c === '"') {
            inString = false;
          }
        } else {
          if (c === '"') {
            inString = true;
          } else if (c === startChar) {
            depth++;
          } else if (c === endChar) {
            depth--;
            if (depth === 0) {
              const candidate = text.slice(i, j + 1).trim();
              try {
                JSON.parse(candidate);
                return candidate;
              } catch {}
              break;
            }
          }
        }
      }
    }
  }
  return null;
}

export function extractJsonFromResponse(content: string): string {
  // 1. Try explicit ```json ... ``` blocks first
  const jsonBlocks = [...content.matchAll(/```json\s*([\s\S]*?)\s*```/gi)];
  for (const match of jsonBlocks) {
    const candidate = match[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  // 2. Try generic code blocks ``` ... ```
  const genericBlocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of genericBlocks) {
    const candidate = match[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  // 3. Search for balanced JSON object {...} or array [...] in conversational text
  const balanced = findJsonSubstring(content);
  if (balanced) {
    return balanced;
  }

  // 4. Fallback to standard regex match if none parsed cleanly
  const fallback = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fallback && fallback[1]) {
    return fallback[1].trim();
  }

  return content.trim();
}

export async function routeArchitect(goal: string, weeklyHours: number): Promise<any> {
  const config = getAIConfig();

  // Mode 1: Demo Sandbox (Groq via FastAPI proxy)
  if (config.provider === 'demo') {
    const res = await api.runAICopilot({
      mode: 'architect',
      goal,
      weekly_hours: weeklyHours,
    });
    return res.plan;
  }

  // Real Web Search Step: First get live YouTube and web results
  const searchResp = await api.searchWeb(goal, 8);
  const searchResults = searchResp.results;

  const systemPrompt = `Eres el Arquitecto Curricular de SketchTrack, plataforma de estudio autodidacta anti-tutorial hell.
Diseñas rutas de aprendizaje bajo la REGLA 1+2 (1 Curso Principal y máximo 2 Recursos Auxiliares por etapa).
REGLAS OBLIGATORIAS:
1. Utiliza EXCLUSIVAMENTE las URLs verificadas provistas en los resultados de búsqueda. NO inventes URLs ni dominios 404.
2. Cada etapa debe durar semanas realistas (1h video = 2.25h estudio con práctica) según las horas disponibles del estudiante.
3. Para cada etapa define 3 opciones de Proof of Work (Nivel Base, Nivel Reto, Nivel Portafolio) con 3 a 5 criterios técnicos cada uno.
4. Responde ÚNICAMENTE en JSON válido con el esquema:
{
  "roadmap_title": "...",
  "description": "...",
  "weekly_hours": ${weeklyHours},
  "stages": [
    {
      "title": "...",
      "duration_days": 14,
      "estimated_hours": 20,
      "primary_resource": { "title": "...", "url": "...", "platform": "youtube", "estimated_hours": 12, "checkpoints": ["..."] },
      "auxiliary_resources": [{ "title": "...", "url": "...", "platform": "docs", "estimated_hours": 5, "checkpoints": ["..."] }],
      "proof_of_work_options": [{ "title": "...", "difficulty": "base", "description": "...", "criteria": ["..."] }]
    }
  ]
}`;

  const userPrompt = `Objetivo de estudio: ${goal}\nHoras semanales: ${weeklyHours}\nRecursos reales encontrados en internet:\n${JSON.stringify(searchResults, null, 2)}\n\nGenera la ruta JSON completa.`;

  // Mode 2: Local LLM (LM Studio / Ollama directly from browser)
  if (config.provider === 'local') {
    const cleanUrl = config.localUrl.replace(/\/+$/, '');
    const ping = await pingLocalLLM(cleanUrl);
    if (!ping.ok) {
      throw new Error(ping.error || 'No se pudo conectar con el LLM local.');
    }

    const res = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error en LLM Local (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    const cleanJson = extractJsonFromResponse(content);
    return JSON.parse(cleanJson);
  }

  // Mode 3: BYOK (Groq direct with user key)
  if (config.provider === 'byok') {
    const cleanApiKey = sanitizeApiKey(config.apiKey);
    if (!cleanApiKey) throw new Error('Por favor ingresa tu API Key en la configuración.');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`Error de API (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    const cleanJson = extractJsonFromResponse(content);
    return JSON.parse(cleanJson);
  }

  throw new Error('Proveedor de IA no reconocido.');
}

export async function routeScaffolding(courseTitle: string, courseUrl: string, weeklyHours: number): Promise<any> {
  const config = getAIConfig();

  // Mode 1: Demo Sandbox (Groq via FastAPI proxy)
  if (config.provider === 'demo') {
    const res = await api.runAICopilot({
      mode: 'scaffolding',
      course_title: courseTitle,
      course_url: courseUrl,
      weekly_hours: weeklyHours,
    });
    return res.scaffolding;
  }

  const systemPrompt = `Eres el Especialista en Proof of Work de SketchTrack.
Dado un curso principal, diseña 3 opciones de proyectos prácticos (Nivel Base, Nivel Reto, Nivel Portafolio) con 3 a 5 criterios técnicos de aceptación rigurosos y medibles cada uno.
Devuelve EXCLUSIVAMENTE un JSON válido con la clave 'options' (array con title, difficulty ['base'|'challenge'|'portfolio'], description, criteria [strings]).`;

  const userPrompt = `Curso principal: ${courseTitle} (${courseUrl})\nDisponibilidad del estudiante: ${weeklyHours}h/semana.`;

  // Mode 2: Local LLM (LM Studio / Ollama directly from browser)
  if (config.provider === 'local') {
    const cleanUrl = config.localUrl.replace(/\/+$/, '');
    const ping = await pingLocalLLM(cleanUrl);
    if (!ping.ok) {
      throw new Error(ping.error || 'No se pudo conectar con el LLM local.');
    }

    const res = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`Error en LLM Local (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    const cleanJson = extractJsonFromResponse(content);
    const parsed = JSON.parse(cleanJson);
    const options = Array.isArray(parsed) ? parsed : (parsed.options || []);
    return {
      course_title: parsed.course_title || courseTitle,
      options,
    };
  }

  // Mode 3: BYOK (Groq direct with user key)
  if (config.provider === 'byok') {
    const cleanApiKey = sanitizeApiKey(config.apiKey);
    if (!cleanApiKey) throw new Error('Por favor ingresa tu API Key en la configuración.');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`Error de API (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    const cleanJson = extractJsonFromResponse(content);
    const parsed = JSON.parse(cleanJson);
    const options = Array.isArray(parsed) ? parsed : (parsed.options || []);
    return {
      course_title: parsed.course_title || courseTitle,
      options,
    };
  }

  throw new Error('Proveedor de IA no reconocido.');
}
