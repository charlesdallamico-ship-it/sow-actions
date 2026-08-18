import { useState } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Modal, Button, Input, Textarea } from '@/lib/ui';
import { formatDate } from '@/lib/utils';
import type { Action } from '@/lib/types';

export function DeadlineRequestModal({
  open,
  onClose,
  action,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  action: Action | null;
  companyId: string;
}) {
  const { profile } = useAuth();
  const [requestedDeadline, setRequestedDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);

  if (!action) return null;

  const submit = async () => {
    if (!requestedDeadline || !reason.trim() || !profile) return;
    setSaving(true);
    const { error } = await supabase.from('deadline_requests').insert({
      action_id: action.id,
      company_id: companyId,
      requested_by: profile.user_id,
      current_deadline: action.deadline,
      requested_deadline: requestedDeadline,
      reason: reason.trim(),
      observation: observation.trim() || null,
      status: 'pending',
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setRequestedDeadline('');
    setReason('');
    setObservation('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Solicitar alteração de prazo" size="md">
      <div className="space-y-4">
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-center gap-2 text-sm text-sky-800">
          <Clock size={18} /> Sua solicitação será enviada para aprovação do administrador.
        </div>
        <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Ação</span><span className="font-medium text-slate-700 text-right">{action.description}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Prazo atual</span><span className="font-medium text-slate-700">{formatDate(action.deadline)}</span></div>
        </div>
        <Input label="Novo prazo solicitado" type="date" value={requestedDeadline} onChange={setRequestedDeadline} required />
        <Textarea label="Motivo da alteração" value={reason} onChange={setReason} required rows={2} placeholder="Ex: Aguardando contratação de novo representante." />
        <Textarea label="Observação (opcional)" value={observation} onChange={setObservation} rows={2} placeholder="Informações adicionais..." />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!requestedDeadline || !reason.trim() || saving}>
            {saving ? 'Enviando...' : 'Enviar solicitação'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
