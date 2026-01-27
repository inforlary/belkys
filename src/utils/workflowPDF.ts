import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkflowProcess, WorkflowActor, WorkflowStep, STATUS_LABELS, STEP_TYPE_CONFIG } from '../types/workflow';

export function generateWorkflowPDF(
  workflow: WorkflowProcess,
  actors: WorkflowActor[],
  steps: WorkflowStep[]
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let yPos = 20;

  doc.setFontSize(18);
  doc.text('İş Akış Şeması', 105, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(14);
  doc.text(workflow.name, 105, yPos, { align: 'center' });
  yPos += 5;

  doc.setFontSize(10);
  doc.text(`Kod: ${workflow.code}`, 105, yPos, { align: 'center' });
  yPos += 3;
  doc.text(`Durum: ${STATUS_LABELS[workflow.status]}`, 105, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(12);
  doc.text('Süreç Bilgileri', 14, yPos);
  yPos += 5;

  const processInfo: any[] = [];
  if (workflow.main_process) processInfo.push(['Ana Süreç', workflow.main_process]);
  if (workflow.process) processInfo.push(['Süreç', workflow.process]);
  if (workflow.sub_process) processInfo.push(['Alt Süreç', workflow.sub_process]);
  if (workflow.description) processInfo.push(['Açıklama', workflow.description]);
  if (workflow.trigger_event) processInfo.push(['Başlatan Olay', workflow.trigger_event]);
  if (workflow.outputs) processInfo.push(['Çıktılar', workflow.outputs]);
  if (workflow.software_used) processInfo.push(['Kullanılan Yazılımlar', workflow.software_used]);
  if (workflow.legal_basis) processInfo.push(['Dayanak Mevzuat', workflow.legal_basis]);
  processInfo.push(['Versiyon', `v${workflow.version}`]);
  processInfo.push(['Oluşturma Tarihi', new Date(workflow.created_at).toLocaleDateString('tr-TR')]);

  autoTable(doc, {
    startY: yPos,
    head: [['Alan', 'Değer']],
    body: processInfo,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('Görevliler', 14, yPos);
  yPos += 5;

  const actorsData = actors.map((actor, index) => [
    (index + 1).toString(),
    actor.title,
    actor.department,
    actor.role
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Ünvan', 'Birim', 'Rol']],
    body: actorsData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('İş Adımları', 14, yPos);
  yPos += 5;

  const stepsData = steps.map((step, index) => {
    const actor = actors.find(a => a.id === step.actor_id);
    const typeConfig = STEP_TYPE_CONFIG[step.step_type];
    return [
      (index + 1).toString(),
      typeConfig.label,
      step.description,
      actor?.title || '-',
      step.is_sensitive ? 'Evet' : 'Hayır'
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Tür', 'Açıklama', 'Sorumlu', 'Hassas']],
    body: stepsData,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 30 },
      2: { cellWidth: 80 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20 }
    }
  });

  const sensitiveSteps = steps.filter(s => s.is_sensitive);
  if (sensitiveSteps.length > 0) {
    yPos = (doc as any).lastAutoTable.finalY + 10;

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(249, 115, 22);
    doc.text('Hassas Görevler', 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 5;

    const sensitiveData = sensitiveSteps.map((step, index) => [
      (index + 1).toString(),
      step.description,
      actors.find(a => a.id === step.actor_id)?.title || '-'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Açıklama', 'Sorumlu']],
      body: sensitiveData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [249, 115, 22] },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Sayfa ${i} / ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
    doc.text(
      `Oluşturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`,
      105,
      285,
      { align: 'center' }
    );
  }

  doc.save(`is-akis-semasi-${workflow.code}.pdf`);
}
