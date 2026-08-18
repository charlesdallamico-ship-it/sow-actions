export function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return daysBetween(new Date(dateStr), new Date());
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline || status === 'concluida' || status === 'cancelada') return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

export function weightedProgress(actions: { progress_percent: number; weight: number }[]): number {
  if (!actions.length) return 0;
  const totalWeight = actions.reduce((s, a) => s + (a.weight || 0), 0);
  if (totalWeight === 0) return 0;
  const sum = actions.reduce((s, a) => s + (a.progress_percent || 0) * (a.weight || 0), 0);
  return Math.round((sum / totalWeight) * 10) / 10;
}

export function simpleProgress(actions: { progress_percent: number }[]): number {
  if (!actions.length) return 0;
  const sum = actions.reduce((s, a) => s + (a.progress_percent || 0), 0);
  return Math.round((sum / actions.length) * 10) / 10;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function generateCode(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

export function priorityLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function priorityColor(p: string): string {
  const map: Record<string, string> = {
    baixa: 'bg-slate-100 text-slate-600',
    media: 'bg-sky-100 text-sky-700',
    alta: 'bg-orange-100 text-orange-700',
    critica: 'bg-red-100 text-red-700',
  };
  return map[p] || map.media;
}
