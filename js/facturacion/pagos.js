import { supabase } from '../supabaseClient.js';

let pagosGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarPagos();
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarPagos);

  // Botón Exportar a Excel (CSV) en Pagos
  document.getElementById('btnExportarPagosCsv')?.addEventListener('click', () => {
    if (pagosGlobal.length === 0) {
      alert('No hay registros de pagos para exportar.');
      return;
    }

    const cabeceras = ['id', 'factura_id', 'cliente', 'monto_bs', 'ref_usd', 'referencia', 'tipo_pago', 'observacion', 'created_at'];
    let csvContenido = cabeceras.join(',') + '\n';

    pagosGlobal.forEach(pago => {
      const fila = cabeceras.map(cabecera => {
        let val = pago[cabecera] !== null && pago[cabecera] !== undefined ? String(pago[cabecera]) : '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContenido += fila.join(',') + '\n';
    });

    const blob = new Blob([csvContenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pagos_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
});

async function cargarPagos() {
  const tbody = document.getElementById('tablaPagosBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando pagos...</td></tr>`;

  const { data, error } = await supabase.from('pagos').select('*').order('id', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400">Error al cargar pagos.</td></tr>`;
    return;
  }

  pagosGlobal = data || [];
  renderizarPagos(pagosGlobal);
}

function renderizarPagos(lista) {
  const tbody = document.getElementById('tablaPagosBody');
  const contador = document.getElementById('contadorPagos');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500">No hay pagos registrados.</td></tr>`;
    return;
  }

  lista.forEach(pago => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${pago.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${pago.cliente || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${pago.factura_id || 'N/A'}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${pago.fecha_pago || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${pago.tipo_pago || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400 font-bold">${Number(pago.monto_bs || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300">${Number(pago.ref_usd || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${pago.referencia || ''}</td>
      <td class="p-3.5 text-slate-400">${pago.observacion || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}