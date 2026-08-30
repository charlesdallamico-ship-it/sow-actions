import { useEffect, useState, useMemo } from 'react';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCompanyData } from '@/lib/useCompanyData';
import { Card, Button, Select, Badge, ProgressBar } from '@/lib/ui';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { formatDate, isOverdue, weightedProgress, cn } from '@/lib/utils';
import type { Fact, Action } from '@/lib/types';

export function ReportsPage() {
  const { company, companyId, users, departments } = useCompanyData();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [reportType, setReportType] = useState('all');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data: f } = await supabase.from('facts').select('*').eq('company_id', companyId);
      const { data: a } = await supabase.from('actions').select('*').eq('company_id', companyId);
      setFacts((f as Fact[] | undefined) ?? []);
      setActions((a as Action[] | undefined) ?? []);
    })();
  }, [companyId]);

  const factMap = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  const reportRows = useMemo(() => {
    let rows = actions.map((a) => {
      const f = factMap.get(a.fact_id);
      const resp = users.find((u) => u.id === a.responsible_id);
      const dept = departments.find((d) => d.id === f?.department_id);
      return { action: a, fact: f, responsible: resp?.full_name ?? '-', department: dept?.name ?? '-' };
    });
    if (filterDept) rows = rows.filter((r) => r.fact?.department_id === filterDept);
    if (reportType === 'overdue') rows = rows.filter((r) => isOverdue(r.action.deadline, r.action.status));
    if (reportType === 'concluded') rows = rows.filter((r) => r.action.status === 'concluida');
    if (reportType === 'pending') rows = rows.filter((r) => r.action.status !== 'concluida' && r.action.status !== 'cancelada');
    return rows;
  }, [actions, factMap, users, departments, filterDept, reportType]);

  const stats = useMemo(() => ({
    total: reportRows.length,
    concluded: reportRows.filter((r) => r.action.status === 'concluida').length,
    overdue: reportRows.filter((r) => isOverdue(r.action.deadline, r.action.status)).length,
    avgProgress: reportRows.length ? Math.round(reportRows.reduce((s, r) => s + r.action.progress_percent, 0) / reportRows.length) : 0,
  }), [reportRows]);

  const exportPDF = () => {
    const doc = new jsPDF('l', 'pt', 'a4');
    doc.setFontSize(16);
    doc.text(`SOW Action — Relatório de Ações`, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Empresa: ${company?.name ?? '-'}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, 58);
    autoTable(doc, {
      startY: 75,
      head: [['Código', 'Fato', 'Ação', 'Responsável', 'Departamento', 'Status', 'Prazo', 'Progresso']],
      body: reportRows.map((r) => [
        r.fact?.code ?? '-',
        (r.fact?.fato ?? '-').substring(0, 50),
        r.action.description.substring(0, 50),
        r.responsible,
        r.department,
        STATUS_LABELS[r.action.status],
        formatDate(r.action.deadline),
        `${r.action.progress_percent}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    doc.save(`sow-action-relatorio-${Date.now()}.pdf`);
  };

  const exportExcel = () => {
    const data = reportRows.map((r) => ({
      'Código': r.fact?.code ?? '-',
      'Fato': r.fact?.fato ?? '-',
      'Causa': r.fact?.causa ?? '-',
      'Ação': r.action.description,
      'Responsável': r.responsible,
      'Departamento': r.department,
      'Status': STATUS_LABELS[r.action.status],
      'Prioridade': r.fact?.priority ?? '-',
      'Prazo': formatDate(r.action.deadline),
      'Progresso %': r.action.progress_percent,
      'Peso %': r.action.weight,
      'Indicador': r.action.indicator_of_success ?? '-',
      'Meta': r.action.target ?? '-',
      'Aprovação': r.action.approval_status ?? '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ações');
    XLSX.writeFile(wb, `sow-action-relatorio-${Date.now()}.xlsx`);
  };

  const exportExecutive = () => {
    const doc = new jsPDF('p', 'pt', 'a4');
    let y = 40;
    doc.setFontSize(18); doc.text('Relatório Executivo SOW Action', 40, y); y += 24;
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Empresa: ${company?.name ?? '-'}`, 40, y); y += 16;
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 40, y); y += 24;

    for (const f of facts) {
      if (filterDept && f.department_id !== filterDept) continue;
      const fActions = actions.filter((a) => a.fact_id === f.id);
      if (reportType === 'concluded' && !fActions.some((a) => a.status === 'concluida')) continue;
      if (reportType === 'overdue' && !fActions.some((a) => isOverdue(a.deadline, a.status))) continue;

      doc.setTextColor(15, 118, 110); doc.setFontSize(12);
      doc.text(`${f.code} — ${f.fato.substring(0, 60)}`, 40, y); y += 16;
      doc.setTextColor(60); doc.setFontSize(9);
      const causa = doc.splitTextToSize(`Causa: ${f.causa}`, 515); doc.text(causa, 40, y); y += causa.length * 11;
      if (f.impact_level) { doc.text(`Impacto: ${f.impact_level}`, 40, y); y += 12; }
      if (f.expected_result) { const er = doc.splitTextToSize(`Resultado esperado: ${f.expected_result}`, 515); doc.text(er, 40, y); y += er.length * 11; }
      y += 6;
      for (const a of fActions) {
        const resp = users.find((u) => u.id === a.responsible_id);
        doc.setFontSize(9); doc.setTextColor(40);
        const desc = doc.splitTextToSize(`• ${a.description} [${STATUS_LABELS[a.status]}] — ${resp?.full_name ?? '-'} — Prazo: ${formatDate(a.deadline)} — ${a.progress_percent}%`, 500);
        doc.text(desc, 45, y); y += desc.length * 11;
      }
      y += 14;
      if (y > 740) { doc.addPage(); y = 40; }
    }
    doc.save(`sow-action-executivo-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500 mt-0.5">Exportação em PDF e Excel</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Select label="Tipo de relatório" value={reportType} onChange={setReportType} options={[
            { value: 'all', label: 'Todas as ações' },
            { value: 'concluded', label: 'Ações concluídas' },
            { value: 'overdue', label: 'Ações atrasadas' },
            { value: 'pending', label: 'Ações pendentes' },
          ]} />
          <Select label="Departamento" value={filterDept} onChange={setFilterDept} placeholder="Todos" options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          <div className="flex items-end gap-2">
            <Button onClick={exportPDF}><FileText size={16} /> PDF</Button>
            <Button variant="secondary" onClick={exportExcel}><FileSpreadsheet size={16} /> Excel</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportExecutive}><Download size={16} /> Relatório executivo (PDF)</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Concluídas', value: stats.concluded },
          { label: 'Atrasadas', value: stats.overdue },
          { label: 'Execução média', value: `${stats.avgProgress}%` },
        ].map((s, i) => (
          <Card key={i} className="p-4"><div className="text-xs text-slate-500">{s.label}</div><div className="text-2xl font-bold text-slate-900 mt-1">{s.value}</div></Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-medium">Código</th><th className="px-4 py-3 font-medium">Ação</th><th className="px-4 py-3 font-medium">Responsável</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Prazo</th><th className="px-4 py-3 font-medium">Progresso</th>
          </tr></thead>
          <tbody>
            {reportRows.map((r) => (
              <tr key={r.action.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{r.fact?.code}</td>
                <td className="px-4 py-3 max-w-xs"><div className="font-medium text-slate-700 truncate">{r.action.description}</div><div className="text-xs text-slate-400 truncate">{r.fact?.fato}</div></td>
                <td className="px-4 py-3 text-slate-600">{r.responsible}</td>
                <td className="px-4 py-3"><Badge className={cn(STATUS_COLORS[r.action.status].bg, STATUS_COLORS[r.action.status].text)}>{STATUS_LABELS[r.action.status]}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(r.action.deadline)}</td>
                <td className="px-4 py-3 w-32"><div className="flex items-center gap-2"><ProgressBar value={r.action.progress_percent} /><span className="text-xs text-slate-500">{r.action.progress_percent}%</span></div></td>
              </tr>
            ))}
            {reportRows.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">Nenhuma ação encontrada.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
