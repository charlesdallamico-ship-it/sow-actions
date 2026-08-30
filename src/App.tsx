import { useEffect, useState } from 'react';
import {
  Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { supabase } from '@/lib/supabase';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
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

function LoadingScreen() {
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

function LoginRoute() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (profile) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function AcceptInviteRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  if (!token) return <Navigate to="/login" replace />;
  return <AcceptInvitePage token={token} onSuccess={() => navigate('/dashboard', { replace: true })} />;
}

function AcceptResetRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  if (!token) return <Navigate to="/login" replace />;
  return <AcceptResetPage token={token} onSuccess={() => navigate('/dashboard', { replace: true })} />;
}

function RootRedirect() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const legacyPage = params.get('page');
  if (token && legacyPage === 'accept-invite') return <Navigate to={`/accept-invite?token=${token}`} replace />;
  if (token && legacyPage === 'accept-reset') return <Navigate to={`/accept-reset?token=${token}`} replace />;
  return <Navigate to="/dashboard" replace />;
}

function FactDetailRoute() {
  const { factId } = useParams();
  const navigate = useNavigate();
  if (!factId) return <Navigate to="/facts" replace />;
  return <FactDetailPage factId={factId} onBack={() => navigate('/facts')} />;
}

function ProtectedApp() {
  const { profile, loading } = useAuth();
  const { companyId } = useCompanyData();
  const navigate = useNavigate();
  const location = useLocation();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const page = location.pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('user_id', profile.user_id).eq('read', false);
      setAlertCount(count ?? 0);
    })();
  }, [profile, page]);

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;

  const goTo = (id: string, fid?: string) => {
    if (id === 'facts') { navigate(fid ? `/facts/${fid}` : '/facts'); return; }
    navigate(`/${id}`);
  };
  const openFact = (id: string) => navigate(`/facts/${id}`);

  const needsCompanySelector = profile.role === 'sow_admin' && !companyId && page !== 'companies' && page !== 'settings';

  return (
    <>
      <AppShell
        current={page}
        onNavigate={goTo}
        alerts={{ count: alertCount, onOpen: () => setAlertsOpen(true) }}
        notifications={<NotificationCenter onNavigate={goTo} />}
      >
        {needsCompanySelector ? <CompanySelectorPrompt /> : (
          <Routes>
            <Route path="/dashboard" element={<DashboardPage onNavigate={goTo} />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/facts" element={<FactsPage onOpenFact={openFact} />} />
            <Route path="/facts/:factId" element={<FactDetailRoute />} />
            <Route path="/plans" element={<PlansPage onOpenFact={openFact} />} />
            <Route path="/tasks" element={<TasksPage onOpenFact={openFact} />} />
            <Route path="/calendar" element={<CalendarPage onOpenFact={openFact} />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/indicators" element={<IndicatorsPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </AppShell>
      <AlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/signup/:token" element={<SignupPage />} />
      <Route path="/accept-invite" element={<AcceptInviteRoute />} />
      <Route path="/accept-reset" element={<AcceptResetRoute />} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
