import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getSignupLinkInfo, redeemSignupLink, type SignupLinkInfo } from '@/lib/signupLinks';
import { ROLE_LABELS } from '@/lib/constants';
import { Button, Input } from '@/lib/ui';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';

export function SignupPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [info, setInfo] = useState<SignupLinkInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const finishSignup = async (name: string) => {
    if (!token) return false;
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;
    if (!currentUser) return false;
    if (!currentUser.email_confirmed_at) { setNeedsEmailConfirm(true); return false; }
    if (info?.role && currentUser.email?.toLowerCase() !== email.toLowerCase()) return false;
    await redeemSignupLink(token, name || (currentUser.user_metadata?.full_name as string) || currentUser.email || 'Usuário');
    navigate('/dashboard', { replace: true });
    return true;
  };

  useEffect(() => {
    if (!token) return;
    getSignupLinkInfo(token)
      .then(setInfo)
      .catch(() => setInfo({ company_name: null, role: null, department_name: null, is_valid: false, message: 'Link inválido.' }))
      .finally(() => setChecking(false));
  }, [token]);

  useEffect(() => {
    if (!token || !info?.is_valid) return;
    let cancelled = false;
    const completeConfirmedSignup = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.user) return;
      const pending = localStorage.getItem(`signup:${token}`);
      if (!pending) return;
      let pendingData: { email: string; fullName: string };
      try { pendingData = JSON.parse(pending) as { email: string; fullName: string }; } catch { return; }
      if (data.session.user.email?.toLowerCase() !== pendingData.email.toLowerCase()) return;
      try {
        await redeemSignupLink(token, pendingData.fullName || (data.session.user.user_metadata?.full_name as string) || data.session.user.email || 'Usuário');
        localStorage.removeItem(`signup:${token}`);
        if (!cancelled) navigate('/dashboard', { replace: true });
      } catch { /* Mantém a tela para que o usuário veja o erro no fluxo normal. */ }
    };
    completeConfirmedSignup();
    return () => { cancelled = true; };
  }, [token, info?.is_valid, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      localStorage.setItem(`signup:${token}`, JSON.stringify({ email, fullName }));
      const { data: existingSession } = await supabase.auth.getSession();
      if (existingSession.session?.user) {
        if (existingSession.session.user.email?.toLowerCase() !== email.toLowerCase()) {
          throw new Error('O email informado é diferente da conta atualmente conectada. Saia e entre com o email convidado.');
        }
        if (!existingSession.session.user.email_confirmed_at) {
          setNeedsEmailConfirm(true);
          setBusy(false);
          return;
        }
        await finishSignup(fullName);
        localStorage.removeItem(`signup:${token}`);
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/signup/${token}` },
      });
      if (signUpError) throw new Error(signUpError.message);
      if (!data.session) {
        setNeedsEmailConfirm(true);
        setBusy(false);
        return;
      }
      await finishSignup(fullName);
      localStorage.removeItem(`signup:${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400">Verificando link...</div>
      </div>
    );
  }

  if (!info?.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
          <XCircle size={32} className="text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900 mb-1">Link inválido</h1>
          <p className="text-sm text-slate-500">{info?.message ?? 'Este link de cadastro não é válido.'}</p>
        </div>
      </div>
    );
  }

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900 mb-1">Confirme seu e-mail</h1>
          <p className="text-sm text-slate-500">Enviamos um link de confirmação para {email}. Depois de confirmar, faça login para concluir seu acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-1 text-sow-700">
            <Building2 size={18} />
            <span className="text-sm font-semibold">{info.company_name}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">Criar sua conta</h1>
          <p className="text-sm text-slate-500 mb-6">
            Você foi convidado como <strong>{info.role ? ROLE_LABELS[info.role] : ''}</strong>
            {info.department_name ? <> no departamento <strong>{info.department_name}</strong></> : null}.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Input label="Nome completo" value={fullName} onChange={setFullName} required placeholder="Seu nome" />
            <Input label="E-mail" type="email" value={email} onChange={setEmail} required placeholder="voce@empresa.com" />
            <Input label="Senha" type="password" value={password} onChange={setPassword} required placeholder="••••••••" />
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Aguarde...' : 'Criar conta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
