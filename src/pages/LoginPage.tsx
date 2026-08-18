import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { ArrowLeft, Mail } from 'lucide-react';

export function LoginPage() {
  const { signIn, signUp, loginBlockReason } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === 'reset') {
      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ email }),
        });
        setResetSent(true);
      } catch {
        setError('Não foi possível enviar o e-mail de recuperação.');
      }
      setBusy(false);
      return;
    }
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, name);
      if (error) setError(error);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left brand panel ── */}
      <div
        className="lg:w-1/2 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0d0d0d 0%, #111111 60%, #0c4543 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 20%, white 1px, transparent 1px), radial-gradient(circle at 75% 80%, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-0.5 sow-gold-bar" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 sow-gold-bar opacity-60" />

        <div className="relative">
          <div className="flex flex-col items-start gap-5 mb-12">
            <img
              src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png"
              alt="SOW Consultoria"
              className="w-24 h-24 object-contain drop-shadow-2xl"
            />
            <div>
              <div className="text-white font-bold text-2xl tracking-wide leading-tight">SOW ACTION</div>
              <div className="mt-1 h-0.5 w-20 sow-gold-bar rounded-full" />
              <div className="mt-2 text-sm text-dark-300 tracking-widest uppercase">Gestão Estratégica</div>
            </div>
          </div>

          <h1 className="text-3xl lg:text-[2.75rem] font-bold leading-tight mb-5">
            Transforme fatos em ações<br />
            e ações em <span className="text-gold-400">resultados.</span>
          </h1>

          <p className="text-dark-300 text-base lg:text-lg max-w-md leading-relaxed">
            Gestão de ações estratégicas para empresas.
            Do fato identificado ao resultado alcançado —
            com método, responsáveis e acompanhamento.
          </p>
        </div>

        <div className="relative mt-10 grid grid-cols-3 gap-3 max-w-md">
          {[
            { n: 'Fato', d: 'O que aconteceu', icon: '01' },
            { n: 'Causa', d: 'Por que importa', icon: '02' },
            { n: 'Ação', d: 'O que fazer', icon: '03' },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/[0.07] backdrop-blur p-4 border border-white/10 hover:border-sow-500/50 transition-colors"
            >
              <div className="text-sow-400 text-xs font-semibold mb-1.5 tracking-wider">{s.icon}</div>
              <div className="font-semibold text-sm text-white">{s.n}</div>
              <div className="text-xs text-dark-400 mt-0.5">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-slate-50">
        <div className="w-full max-w-sm">

          {/* Logo on mobile */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img
              src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png"
              alt="SOW Consultoria"
              className="w-16 h-16 object-contain"
            />
            <div className="mt-2 font-bold text-slate-900 text-lg tracking-wide">SOW ACTION</div>
            <div className="mt-1 h-0.5 w-16 sow-gold-bar rounded-full" />
          </div>

          {mode === 'reset' ? (
            <>
              <div className="mb-8">
                <button
                  onClick={() => { setMode('login'); setResetSent(false); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sow-600 transition mb-4"
                >
                  <ArrowLeft size={16} /> Voltar para login
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Recuperar senha</h2>
                <p className="text-sm text-slate-500">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              {resetSent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                  <Mail size={32} className="text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm text-emerald-800 font-medium mb-1">
                    E-mail enviado
                  </p>
                  <p className="text-xs text-emerald-600">
                    Se o e-mail estiver cadastrado, você receberá um link de recuperação válido por 1 hora.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <Input label="E-mail" value={email} onChange={setEmail} type="email" required placeholder="voce@empresa.com" />
                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? 'Aguarde...' : 'Enviar link de recuperação'}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  {mode === 'login' ? 'Acessar o sistema' : 'Criar conta'}
                </h2>
                <p className="text-sm text-slate-500">
                  {mode === 'login'
                    ? 'Entre com suas credenciais para continuar.'
                    : 'Comece a gerenciar ações estratégicas.'
                  }
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === 'signup' && (
                  <Input label="Nome completo" value={name} onChange={setName} required placeholder="Seu nome" />
                )}
                <Input label="E-mail" value={email} onChange={setEmail} type="email" required placeholder="voce@empresa.com" />
                <Input label="Senha" value={password} onChange={setPassword} type="password" required placeholder="••••••••" />

                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setMode('reset'); setError(null); setResetSent(false); }}
                      className="text-xs text-slate-500 hover:text-sow-600 transition"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
                {loginBlockReason && (
                  <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    {loginBlockReason}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                {mode === 'login' ? (
                  <>
                    Não tem conta?{' '}
                    <button
                      onClick={() => { setMode('signup'); setError(null); }}
                      className="text-sow-600 font-semibold hover:text-sow-700 hover:underline transition"
                    >
                      Criar agora
                    </button>
                  </>
                ) : (
                  <>
                    Já tem conta?{' '}
                    <button
                      onClick={() => { setMode('login'); setError(null); }}
                      className="text-sow-600 font-semibold hover:text-sow-700 hover:underline transition"
                    >
                      Entrar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
