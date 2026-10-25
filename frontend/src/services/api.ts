import {
  RoadmapData,
  IceboxItemData,
  WorkshopBadgeData,
  StageResourceData,
  ProofOfWorkData,
} from '../types';

const API_BASE = '/api';

export function getWorkspaceId(): string {
  let wsId = localStorage.getItem('sketchtrack_workspace_id');
  if (!wsId) {
    wsId = 'ws-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('sketchtrack_workspace_id', wsId);
  }
  return wsId;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Workspace-Id', getWorkspaceId());
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errData: any;
    try {
      errData = await response.json();
    } catch {
      errData = { message: response.statusText };
    }
    const message = errData.detail?.message || errData.detail || errData.message || 'Error en la petición';
    const error: any = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    error.code = errData.detail?.code;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const api = {
  // Roadmaps
  listRoadmaps: () => request<any[]>('/roadmaps'),
  getRoadmap: (id: string) => request<RoadmapData>(`/roadmaps/${id}`),
  createRoadmap: (data: { title: string; description?: string; weekly_hours?: number }) =>
    request<{ id: string; title: string }>('/roadmaps', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  seedDemoRoadmap: () =>
    request<{ message: string; roadmap_id: string }>('/roadmaps/seed-demo', {
      method: 'POST',
    }),
  addStage: (
    roadmapId: string,
    data?: {
      title?: string;
      start_date?: string;
      duration_days?: number;
      estimated_hours?: number;
    }
  ) =>
    request<{
      message: string;
      stage_id: string;
      position_index: number;
      title: string;
      start_date: string;
      duration_days: number;
      status: string;
    }>(`/roadmaps/${roadmapId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  updateStage: (
    roadmapId: string,
    stageId: string,
    data: {
      title?: string;
      start_date?: string;
      duration_days?: number;
      status?: string;
    }
  ) =>
    request<{ message: string; stage_id: string }>(`/roadmaps/${roadmapId}/stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addResource: (
    roadmapId: string,
    stageId: string,
    data: {
      slot_type: string;
      title: string;
      url: string;
      platform: string;
      estimated_hours?: number;
    }
  ) =>
    request<{ message: string; resource_id: string }>(
      `/roadmaps/${roadmapId}/stages/${stageId}/resources`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  updateResource: (
    roadmapId: string,
    stageId: string,
    resourceId: string,
    data: {
      title?: string;
      url?: string;
      checkpoints?: any[];
    }
  ) =>
    request<{ message: string }>(
      `/roadmaps/${roadmapId}/stages/${stageId}/resources/${resourceId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),
  deleteResource: (roadmapId: string, stageId: string, resourceId: string) =>
    request<{ message: string }>(`/roadmaps/${roadmapId}/stages/${stageId}/resources/${resourceId}`, {
      method: 'DELETE',
    }),

  // Proof of Work
  updateProofOfWork: (
    roadmapId: string,
    stageId: string,
    data: {
      selected_option_index?: number;
      evidence_url?: string;
      acceptance_criteria?: any[];
    }
  ) =>
    request<{ message: string }>(`/roadmaps/${roadmapId}/stages/${stageId}/proof-of-work`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  sealProofOfWork: (roadmapId: string, stageId: string, evidenceUrl: string) =>
    request<{
      message: string;
      stamped_at: string;
      next_stage_unlocked: string | null;
      unlocked_badges: string[];
    }>(`/roadmaps/${roadmapId}/stages/${stageId}/seal-pow`, {
      method: 'POST',
      body: JSON.stringify({ evidence_url: evidenceUrl }),
    }),

  // Catch-up Engine
  triggerCatchupSync: (roadmapId: string, stageId: string, shiftDays: number) =>
    request<{ message: string; new_start_date: string }>(
      `/roadmaps/${roadmapId}/stages/${stageId}/catchup-sync`,
      {
        method: 'POST',
        body: JSON.stringify({ shift_days: shiftDays }),
      }
    ),

  // Badges
  getBadges: () => request<WorkshopBadgeData[]>('/roadmaps/badges/list'),

  // Icebox
  listIcebox: () => request<IceboxItemData[]>('/icebox'),
  addIceboxItem: (data: { url: string; title?: string; notes?: string }) =>
    request<IceboxItemData>('/icebox', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteIceboxItem: (id: string) =>
    request<{ message: string }>(`/icebox/${id}`, {
      method: 'DELETE',
    }),
  promoteIceboxItem: (id: string, stageId: string, slotType: string = 'aux_1') =>
    request<{ message: string; resource_id: string }>(`/icebox/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stageId, slot_type: slotType }),
    }),

  // AI & Web Search
  searchWeb: (query: string, limit: number = 8) =>
    request<{ query: string; results: any[] }>('/ai/web-search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),
  getAIStatus: () =>
    request<{
      groq_configured: boolean;
      groq_model: string;
      rate_limit_per_hour: number;
      rate_limit_remaining: number;
      client_ip: string;
    }>('/ai/status'),
  runAICopilot: (data: {
    mode: 'architect' | 'scaffolding';
    goal?: string;
    weekly_hours?: number;
    course_title?: string;
    course_url?: string;
  }) =>
    request<any>('/ai/copilot', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  applyRoadmap: (data: any) =>
    request<{ message: string; roadmap_id: string }>('/ai/apply-roadmap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
