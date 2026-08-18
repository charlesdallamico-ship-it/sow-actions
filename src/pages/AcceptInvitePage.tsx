import { useState } from 'react';
import { Button, Input } from '@/lib/ui';
import { CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

interface Props {
  token: string;
  onSuccess: () => void;
}

export function AcceptInvitePage({ token, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setBusy(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao ativar acesso.'); setBusy(false); return; }
      setDone(true);
      setTimeout(() => onSuccess(), 2000);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/ChatGPT_Image_5_de_ago._de_2026,_10_46_39.png" alt="SOW" className="w-16 h-16 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900">SOW ACTION</h1>
          <div className="mt-1 h-0.5 w-16 sow-gold-bar rounded-full mx-auto" />
        </div>

        {done ? (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
            <CheckCircle2 size={48} className="text-emerald-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Acesso ativado!</h2>
            <p className="text-sm text-slate-500">Sua senha foi criada com sucesso. Redirecionando para o login...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-sow-50 flex items-center justify-center">
                <KeyRound size={20} className="text-sow-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Criar sua senha</h2>
                <p className="text-xs text-slate-500">Ative seu acesso ao SOW ACTION</p>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Input label="Nova senha" type="password" value={password} onChange={setPassword} required placeholder="••••••••" />
              <Input label="Confirmar senha" type="password" value={confirm} onChange={setConfirm} required placeholder="••••••••" />
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Ativando...' : 'Ativar meu acesso'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
