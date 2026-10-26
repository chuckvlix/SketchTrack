# SketchTrack 📐

> **Aplicación web de planificación y ejecución de estudio autodidacta anti-tutorial hell.**

SketchTrack combina una línea de tiempo elástica y continua con una restricción estricta de foco cognitivo (**Regla 1+2**: 1 curso troncal y máximo 2 recursos auxiliares por etapa), validación contractual mediante entregables prácticos (**Proof of Work**), un sistema de mantenimiento de hábitos sin culpa (**Catch-up Engine** con **Weekend Buffer**) y un **Copiloto Curricular con IA Híbrida** capaz de buscar tutoriales y documentación en internet en tiempo real para no alucinar enlaces rotos.

---

## 🎨 Sistema de Diseño: "Cutting Mat & Stationery"

* **Lienzo (Timeline Stream):** Emula una alfombrilla de corte (*self-healing cutting mat*) en azul petróleo mate (`#1B3644`) con cuadrícula de 24px (1 día = 24px) y divisores semanales.
* **Fichas 1+2:** Cartulina cálida (`#FAF6EE` y `#F0EAE1`) con sombras sólidas (*hard offset shadows* de `3px 3px 0px #0F2029`).
* **Sello de Goma:** Animación de sellado `[ENTREGADO]` en color verde sello (`#2A7B5C`) al verificar el 100% de los criterios y adjuntar la URL de evidencia.
* **Modo Móvil (`< 768px`):** Se transforma automáticamente en *"Modo Ejecución (Hoy)"* con tarjetas verticales táctiles (`>= 48px`).

---

## 🚀 Arquitectura y Stack Tecnológico

* **Frontend:** React 18, TypeScript, TailwindCSS, Rough.js (trazo orgánico con semillas deterministas), Radix UI y Lucide Icons.
* **Backend:** FastAPI, SQLite (`sketchtrack.db`), SQLModel / SQLAlchemy, `duckduckgo-search` (`ddgs`) para búsqueda web y YouTube en vivo sin API keys adicionales.
* **Copiloto de IA Híbrido (3 Modos):**
  1. **Demo Sandbox (Deploy Portafolio):** Conexión gestionada mediante Groq (`llama-3.3-70b-versatile`) con rate-limiting por IP para reclutadores.
  2. **Local LLM (Uso Personal):** Conexión directa desde el navegador a **LM Studio** (`http://localhost:1234`) u **Ollama** (`http://localhost:11434`), recibiendo primero del backend los enlaces verificados de YouTube y la Web.
  3. **BYOK (Bring Your Own Key):** Uso de clave personal almacenada localmente en el navegador.

---

## 🛠️ Instalación y Puesta en Marcha

### Requisitos Previos
* **Python 3.11+** y [`uv`](https://github.com/astral-sh/uv) (o `pip`)
* **Node.js 18+** y [`pnpm`](https://pnpm.io/) (v10+)

### 1. Iniciar el Backend (FastAPI + SQLite)
```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# (Opcional) Si vas a probar el modo Demo con Groq:
export GROQ_API_KEY="gsk_..."

uvicorn app.main:app --reload --port 8000
```
El backend estará disponible en `http://localhost:8000` con documentación interactiva en `http://localhost:8000/docs`.

### 2. Iniciar el Frontend (React + Vite + pnpm)
```bash
cd frontend
pnpm install
pnpm run dev
```
La aplicación abrirá en `http://localhost:5173`.

---

## 💡 Uso con LM Studio en Local

1. Abre **LM Studio**, carga tu modelo preferido (por ejemplo, `Qwen2.5-Coder` o `Llama-3.1-8B-Instruct`).
2. Ve a la pestaña **Developer / Local Server**.
3. Asegúrate de marcar la casilla **"Enable CORS"** y presiona **"Start Server"** (por defecto en `http://localhost:1234`).
4. En SketchTrack, abre **Copiloto IA** → **Configurar IA** → selecciona **Local LLM** y pulsa **Probar Ping**.
5. ¡Listo! Al pedir una ruta de estudio, SketchTrack buscará en YouTube y en la Web tutoriales reales y se los inyectará a tu modelo local en LM Studio.

---

## 🧪 Pruebas Automatizadas

```bash
# Tests unitarios y de integración de reglas (Backend)
cd backend && .venv/bin/pytest -v

# Typecheck y bundle de producción (Frontend)
cd frontend && pnpm run build
```
