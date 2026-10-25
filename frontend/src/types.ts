export type PlatformType = 'youtube' | 'docs' | 'course' | 'book' | 'article';

export type SlotType = 'primary' | 'aux_1' | 'aux_2';

export interface CheckpointItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  completed: boolean;
}

export interface ProofOfWorkOption {
  index: number;
  title: string;
  difficulty: 'base' | 'challenge' | 'portfolio';
  description: string;
  criteria: AcceptanceCriterion[];
}

export interface ProofOfWorkData {
  id: string;
  selected_option_index: number;
  title: string;
  description: string;
  difficulty_level: 'base' | 'challenge' | 'portfolio';
  acceptance_criteria: AcceptanceCriterion[];
  options: ProofOfWorkOption[];
  evidence_url: string | null;
  stamped_at: string | null;
}

export interface StageResourceData {
  id: string;
  slot_type: SlotType;
  title: string;
  url: string;
  platform: PlatformType;
  estimated_hours: number;
  checkpoints: CheckpointItem[];
}

export interface StageNodeData {
  id: string;
  position_index: number;
  title: string;
  start_date: string; // YYYY-MM-DD
  duration_days: number;
  estimated_hours: number;
  status: 'locked' | 'active' | 'completed';
  paused_days_offset: number;
  seed: number;
  resources: StageResourceData[];
  proof_of_work: ProofOfWorkData | null;
}

export interface CatchupInfo {
  needs_catchup: boolean;
  days_behind?: number;
  business_days_missed?: number;
  suggested_shift_days: number;
}

export interface RoadmapData {
  id: string;
  title: string;
  description: string | null;
  weekly_hours: number;
  weekend_days: number[];
  streak_days: number;
  last_check_in_date: string | null;
  stages: StageNodeData[];
  catchup: CatchupInfo;
}

export interface IceboxItemData {
  id: string;
  workspace_id: string;
  title: string;
  url: string;
  platform: PlatformType;
  notes: string | null;
  created_at: string;
}

export interface WorkshopBadgeData {
  id: string;
  workspace_id: string;
  badge_key: string;
  title: string;
  description: string;
  unlocked_at: string;
}

export interface AIProviderConfig {
  provider: 'demo' | 'local' | 'byok';
  localUrl: string; // http://localhost:1234 or http://localhost:11434
  apiKey: string;
  byokProvider: 'groq' | 'openai' | 'anthropic' | 'gemini';
  storageType?: 'local' | 'session';
}
