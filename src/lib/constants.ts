import type { ActionStatus } from './types';

export const STATUS_LABELS: Record<ActionStatus, string> = {
  nao_iniciada: 'Não iniciada',
  em_planejamento: 'Em planejamento',
  em_andamento: 'Em andamento',
  aguardando_terceiro: 'Aguardando terceiro',
  aguardando_aprovacao: 'Aguardando aprovação',
  com_impedimento: 'Com impedimento',
  atrasada: 'Atrasada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const STATUS_COLORS: Record<ActionStatus, { bg: string; text: string; border: string; dot: string }> = {
  nao_iniciada: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  em_planejamento: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  em_andamento: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  aguardando_terceiro: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  aguardando_aprovacao: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  com_impedimento: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  atrasada: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  concluida: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  cancelada: { bg: 'bg-zinc-200', text: 'text-zinc-600', border: 'border-zinc-300', dot: 'bg-zinc-500' },
};

export const KANBAN_COLUMNS: ActionStatus[] = [
  'nao_iniciada',
  'em_andamento',
  'aguardando_aprovacao',
  'atrasada',
  'concluida',
];

export const ROLE_LABELS: Record<string, string> = {
  sow_admin: 'Administrador Geral (SOW)',
  company_admin: 'Administrador da Empresa',
  area_manager: 'Gestor de Área',
  responsible: 'Responsável',
  viewer: 'Usuário de Consulta',
};

export const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
  { value: 'media', label: 'Média', color: 'bg-sky-100 text-sky-700' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-700' },
];

export const CAUSE_TYPES = [
  'problema',
  'risco',
  'oportunidade',
  'melhoria',
  'decisão estratégica',
  'não conformidade',
  'solicitação de cliente',
  'indicador abaixo da meta',
  'indicador acima da meta',
  'ação preventiva',
];

export const IMPACT_TYPES = [
  'impacto financeiro',
  'impacto comercial',
  'impacto operacional',
  'impacto no cliente',
  'impacto na qualidade',
  'impacto na produtividade',
  'impacto na imagem',
  'impacto estratégico',
];

export const IMPACT_LEVELS = [
  { value: 'baixo', label: 'Baixo' },
  { value: 'medio', label: 'Médio' },
  { value: 'alto', label: 'Alto' },
  { value: 'critico', label: 'Crítico' },
];

export const ACTION_CATEGORIES = [
  'comercial',
  'financeira',
  'operacional',
  'qualidade',
  'marketing',
  'recursos humanos',
  'logística',
  'estratégica',
  'ti',
  'outra',
];

export const PROGRESS_STEPS = [0, 10, 25, 50, 75, 90, 100];

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'daily', label: 'Diariamente' },
  { value: 'every_2_days', label: 'A cada 2 dias' },
  { value: 'every_3_days', label: 'A cada 3 dias' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'every_15_days', label: 'A cada 15 dias' },
  { value: 'monthly', label: 'Mensalmente' },
  { value: 'custom', label: 'Personalizada' },
];

export const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

export const DEADLINE_REMINDER_DAYS = [15, 7, 3, 1, 0];

export const PLAN_LABELS: Record<string, string> = {
  start: 'Start',
  professional: 'Professional',
  business: 'Business',
  enterprise: 'Enterprise',
};

export const PLAN_MAX_USERS: Record<string, number> = {
  start: 5,
  professional: 20,
  business: 50,
  enterprise: 999,
};

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trial: 'Em teste',
  suspended: 'Suspensa',
  inactive: 'Inativa',
};

export const COMPANY_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-sky-100 text-sky-700',
  suspended: 'bg-orange-100 text-orange-700',
  inactive: 'bg-slate-200 text-slate-600',
};

export const QUICK_DEADLINES = [
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
  { days: 45, label: '45 dias' },
  { days: 50, label: '50 dias' },
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
];

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'planning', label: 'Planejamento Estratégico', icon: 'Target' },
  { id: 'facts', label: 'Fatos e Causas', icon: 'Lightbulb' },
  { id: 'plans', label: 'Planos de Ação', icon: 'ClipboardList' },
  { id: 'tasks', label: 'Minhas Tarefas', icon: 'CheckSquare' },
  { id: 'teams', label: 'Equipes', icon: 'Users' },
  { id: 'indicators', label: 'Indicadores', icon: 'TrendingUp' },
  { id: 'calendar', label: 'Calendário', icon: 'Calendar' },
  { id: 'reports', label: 'Relatórios', icon: 'FileText' },
  { id: 'companies', label: 'Empresas', icon: 'Building2', adminOnly: true },
  { id: 'users', label: 'Usuários', icon: 'UserCog' },
  { id: 'permissions', label: 'Gestão de Permissões', icon: 'ShieldCheck', adminOnly: true },
  { id: 'settings', label: 'Configurações', icon: 'Settings' },
];
