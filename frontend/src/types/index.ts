export type Skill =
  | 'communication'
  | 'leadership'
  | 'self_organization'
  | 'empathy'
  | 'critical_thinking';

export const SKILL_LABELS: Record<Skill, string> = {
  communication: 'Коммуникация',
  leadership: 'Лидерство',
  self_organization: 'Самоорганизация',
  empathy: 'Эмпатия',
  critical_thinking: 'Критическое мышление',
};

export const SKILL_ICONS: Record<Skill, string> = {
  communication: '💬',
  leadership: '🎯',
  self_organization: '⚡',
  empathy: '🤝',
  critical_thinking: '🧠',
};

export interface User {
  id: string;
  email: string;
  name?: string;
  has_paid: boolean;
  avatar?: string | null;
  created_at?: string;
}

export interface Question {
  id: string;
  text: string;
  skill: Skill;
  options: string[];
  order: number;
}

export interface SkillScore {
  id: string;
  skill: Skill;
  score: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  skill: Skill;
  difficulty: number;
  is_free: boolean;
}

export type ExerciseStatus = 'not_started' | 'in_progress' | 'completed';

export interface ProgramExercise {
  id: string;
  exercise: Exercise;
  status: ExerciseStatus;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface DevelopmentProgram {
  id: string;
  created_at: string;
  exercises: ProgramExercise[];
}

export type ResourceType = 'book' | 'article' | 'video' | 'course';

export interface Resource {
  id: string;
  title: string;
  author: string;
  description: string;
  type: ResourceType;
  skill: Skill;
  file_url: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  label: string;
  created_at: string;
}
