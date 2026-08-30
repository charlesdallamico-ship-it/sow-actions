import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Target, Lightbulb, ClipboardList, CheckSquare, Users,
  TrendingUp, Calendar, FileText, Building2, UserCog, Settings, LogOut,
  Menu, X, Bell, ChevronDown, Building, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { ROLE_LABELS, MENU_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Target, Lightbulb, ClipboardList, CheckSquare, Users,
  TrendingUp, Calendar, FileText, Building2, UserCog, Settings,
};

interface Props {
  current: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
  alerts: { count: number; onOpen: () => void };
  notifications?: ReactNode;
}

export function AppShell({ current, onNavigate, children, alerts, notifications }: Props) {
  const { profile, signOut } = useAuth();
  const { company, companies, switchCompany, companyId } = useCompanyData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [companyMenu, setCompanyMenu] = useState(false);

  if (!profile) return null;
  const isAdmin = profile.role === 'sow_admin' || profile.is_primary_admin === true;
  const items = MENU_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-slate-100">

      {/* ── Sidebar ── */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200',
        'bg-dark-900 text-dark-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )} style={{ background: 'linear-gradient(180deg, #0d0d0d 0%, #111111 100%)' }}>

        {/* Logo */}
        <div className="shrink-0 flex flex-col items-center pt-6 pb-4 px-5 border-b border-white/5">
          <img
            src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png"
            alt="SOW Consultoria"
            className="w-20 h-20 object-contain drop-shadow-lg"
          />
          <div className="mt-3 text-center">
            <div className="text-white font-bold text-base tracking-wide leading-tight">SOW ACTION</div>
            {/* gold underline */}
            <div className="mt-1 h-0.5 w-16 mx-auto sow-gold-bar rounded-full" />
            <div className="mt-1.5 text-[11px] text-dark-400 tracking-widest uppercase">Gestão Estratégica</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = current === item.id;
            const locked = !companyId && item.id !== 'companies' && item.id !== 'settings' && item.id !== 'dashboard';
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                disabled={locked}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                  active
                    ? 'sow-nav-active text-white font-semibold'
                    : 'text-dark-300 hover:bg-white/8 hover:text-white',
                  locked && 'opacity-30 cursor-not-allowed hover:bg-transparent',
                )}
              >
                <Icon
                  size={17}
                  className={cn('shrink-0', active ? 'text-white' : 'text-dark-400')}
                />
                <span className="truncate">{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-white/5">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-dark-400 hover:bg-white/8 hover:text-white transition-all"
          >
            <LogOut size={17} />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-500 hover:text-slate-700 transition" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Company switcher (SOW admin) */}
            {isAdmin && companies.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setCompanyMenu(!companyMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-sow-500 hover:bg-sow-50 transition-all text-sm"
                >
                  <Building size={15} className="text-sow-600 shrink-0" />
                  <span className="font-medium text-slate-700 max-w-[180px] truncate">
                    {company?.name ?? 'Selecionar empresa'}
                  </span>
                  <ChevronDown size={13} className="text-slate-400 shrink-0" />
                </button>

                {companyMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCompanyMenu(false)} />
                    <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 max-h-80 overflow-y-auto animate-scale-in">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Empresas cadastradas
                      </div>
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { switchCompany(c.id); setCompanyMenu(false); }}
                          className={cn(
                            'w-full text-left px-3 py-2.5 text-sm hover:bg-sow-50 flex items-center gap-2.5 transition-colors',
                            companyId === c.id ? 'text-sow-700 font-semibold bg-sow-50' : 'text-slate-600',
                          )}
                        >
                          {c.logo_url
                            ? <img src={c.logo_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                            : (
                              <div
                                className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ background: c.primary_color ?? '#1a8f86' }}
                              >
                                {c.name.charAt(0)}
                              </div>
                            )
                          }
                          <span className="truncate">{c.name}</span>
                          {companyId === c.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sow-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Company name (non-admin) */}
            {!isAdmin && company && (
              <div className="hidden sm:flex items-center gap-2">
                {company.logo_url
                  ? <img src={company.logo_url} alt="" className="w-6 h-6 rounded object-cover" />
                  : (
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: company.primary_color ?? '#1a8f86' }}
                    >
                      {company.name.charAt(0)}
                    </div>
                  )
                }
                <span className="text-sm font-medium text-slate-700">{company.name}</span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notification center (bell) */}
            {notifications}

            {/* Alerts */}
            <button
              onClick={alerts.onOpen}
              className="relative p-2 text-slate-500 hover:text-sow-600 hover:bg-sow-50 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {alerts.count > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {alerts.count > 9 ? '9+' : alerts.count}
                </span>
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1a8f86, #157470)' }}
                >
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-slate-800 leading-tight max-w-[140px] truncate">
                    {profile.full_name}
                  </div>
                  <div className="text-[11px] text-slate-400">{ROLE_LABELS[profile.role]}</div>
                </div>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>

              {userMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-20 animate-scale-in">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="text-sm font-semibold text-slate-800 truncate">{profile.full_name}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">{profile.email}</div>
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-sow-700 bg-sow-50 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[profile.role]}
                      </div>
                    </div>
                    <button
                      onClick={() => { onNavigate('settings'); setUserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Configurações
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Sair do sistema
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
