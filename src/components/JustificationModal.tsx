import { useState } from 'react';
import { Modal, Button, Textarea } from '@/lib/ui';

export function JustificationModal({
  open,
  onClose,
  onConfirm,
  title = 'Motivo da alteração',
  fieldLabel = 'Campo alterado',
  fieldName,
  oldValue,
  newValue,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title?: string;
  fieldLabel?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Esta alteração exige um motivo obrigatório. O registro será incluído no histórico de auditoria.
        </div>
        {fieldName && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{fieldLabel}</span><span className="font-medium text-slate-700">{fieldName}</span></div>
            {oldValue !== undefined && <div className="flex justify-between"><span className="text-slate-500">Valor anterior</span><span className="font-medium text-slate-700">{oldValue || '-'}</span></div>}
            {newValue !== undefined && <div className="flex justify-between"><span className="text-slate-500">Novo valor</span><span className="font-medium text-slate-700">{newValue || '-'}</span></div>}
          </div>
        )}
        <Textarea
          label="Motivo da alteração"
          value={reason}
          onChange={setReason}
          required
          rows={3}
          placeholder="Descreva o motivo desta alteração..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>Confirmar alteração</Button>
        </div>
      </div>
    </Modal>
  );
}
