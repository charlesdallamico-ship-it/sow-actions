import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { supabase } from '@/lib/supabase';
import { LoginPage } from '@/pages/LoginPage';
import { AppShell } from '@/components/AppShell';
import { AlertsDrawer } from '@/components/AlertsDrawer';
import { NotificationCenter } from '@/components/NotificationCenter';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlanningPage } from '@/pages/PlanningPage';
import { FactsPage } from '@/pages/FactsPage';
import { FactDetailPage } from '@/pages/FactDetailPage';
import { PlansPage } from '@/pages/PlansPage';
import { TasksPage } from '@/pages/TasksPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CompaniesPage } from '@/pages/CompaniesPage';
import { UsersPage } from '@/pages/UsersPage';
import { TeamsPage } from '@/pages/TeamsPage';
import { IndicatorsPage } from '@/pages/IndicatorsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { AcceptResetPage } from '@/pages/AcceptResetPage';
import { Building2, ArrowRight } from 'lucide-react';

function CompanySelectorPrompt() {
  const { companies, switchCompany } = useCompanyData();
  return (
    <div className="flex items-center justify-center min-h-screen p-6" style={{ background: 'linear-gradient(160deg, #f0faf9 0%, #f1f5f9 100%)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png"
            alt="SOW Consultoria"
            className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-lg"
          />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">SOW ACTION</h1>
          <div className="mx-auto mt-1 h-0.5 w-16 sow-gold-bar rounded-full mb-2" />
          <p className="text-sm text-slate-500">Selecione uma empresa para começar a trabalhar.</p>
        </div>
        <div className="space-y-2">
          {companies.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-4">Nenhuma empresa cadastrada ainda.</p>
              <p className="text-sm text-slate-400">Vá em Empresas para cadastrar a primeira.</p>
            </div>
          ) : companies.map((c) => (
            <button
              key={c.id}
              onClick={() => switchCompany(c.id)}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-sow-500 hover:shadow-md transition-all group"
            >
              {c.logo_url ? <img src={c.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: c.primary_color ?? '#1a8f86' }}>{c.name.charAt(0)}</div>}
              <div className="flex-1 text-left"><div className="font-medium text-slate-900">{c.name}</div><div className="text-xs text-slate-500">{c.segment ?? 'Sem segmento'}</div></div>
              <ArrowRight size={18} className="text-slate-300 group-hover:text-sow-600 transition" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { profile, loading } = useAuth();
  const { companyId } = useCompanyData();
  const [page, setPage] = useState('dashboard');
  const [factId, setFactId] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Handle accept-invite and accept-reset URL params
  const urlParams = new URLSearchParams(window.location.search);
  const inviteToken = urlParams.get('token');
  const isAcceptInvite = page === 'accept-invite' || urlParams.get('page') === 'accept-invite';
  const isAcceptReset = page === 'accept-reset' || urlParams.get('page') === 'accept-reset';

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', profile.user_id).eq('read', false);
      setAlertCount(count ?? 0);
    })();
  }, [profile, page]);

  const navigate = (id: string, fid?: string) => {
    if (id === 'facts') { setFactId(fid ?? null); setPage('facts'); return; }
    if (id === 'accept-invite') { setPage('accept-invite'); return; }
    if (id === 'accept-reset') { setPage('accept-reset'); return; }
    setPage(id);
  };

  const openFact = (id: string) => { setFactId(id); setPage('facts'); };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <img
          src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png"
          alt="SOW"
          className="w-12 h-12 object-contain opacity-90"
        />
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sow-500 border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  // Accept-invite page (no auth required)
  if (isAcceptInvite && inviteToken) {
    return <AcceptInvitePage token={inviteToken} onSuccess={() => { window.location.href = '/'; }} />;
  }

  // Accept-reset page (no auth required)
  if (isAcceptReset && inviteToken) {
    return <AcceptResetPage token={inviteToken} onSuccess={() => { window.location.href = '/'; }} />;
  }

  if (!profile) return <LoginPage />;

  // SOW admin without a selected company
  const needsCompanySelector = profile.role === 'sow_admin' && !companyId && page !== 'companies' && page !== 'settings';

  const render = () => {
    if (needsCompanySelector) return <CompanySelectorPrompt />;
    if (page === 'facts' && factId) return <FactDetailPage factId={factId} onBack={() => setFactId(null)} />;
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={navigate} />;
      case 'planning': return <PlanningPage />;
      case 'facts': return <FactsPage onOpenFact={openFact} />;
      case 'plans': return <PlansPage onOpenFact={openFact} />;
      case 'tasks': return <TasksPage onOpenFact={openFact} />;
      case 'calendar': return <CalendarPage onOpenFact={openFact} />;
      case 'reports': return <ReportsPage />;
      case 'companies': return <CompaniesPage />;
      case 'users': return <UsersPage />;
      case 'teams': return <TeamsPage />;
      case 'indicators': return <IndicatorsPage />;
      case 'permissions': return <PermissionsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <>
      <AppShell
        current={page}
        onNavigate={navigate}
        alerts={{ count: alertCount, onOpen: () => setAlertsOpen(true) }}
        notifications={<NotificationCenter onNavigate={navigate} />}
      >
        {render()}
      </AppShell>
      <AlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
