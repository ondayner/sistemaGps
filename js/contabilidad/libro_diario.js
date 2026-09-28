import { supabase } from '../supabaseClient.js';

let diarioGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const inputDesde = document.getElementById('filtroDesde');
  const inputHasta = document.getElementById('filtroHasta');
  
  if (inputDesde) inputDesde.value = inicioMes;
  if (inputHasta) inputHasta.value = hoy;

  cargarLibroDiario();

  document.getElementById('btnActualizarDiario')?.addEventListener('click', cargarLibroDiario);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarLibroDiario);
});

async function cargarLibroDiario() {
  const tbody = document.getElementById('tablaDiarioBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando libro diario...</td></tr>`;

  const { data, error } = await supabase.from('libro_diario').select('*').order('id', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al cargar libro diario. Asegúrate de crear la tabla en Supabase.</td></tr>`;
    return;
  }

  diarioGlobal = data || [];
  renderizarDiario(diarioGlobal);
}

function renderizarDiario(lista) {
  const tbody = document.getElementById('tablaDiarioBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">No hay movimientos en el libro diario.</td></tr>`;
    document.getElementById('lblTotalDebe').textContent = '0.00';
    document.getElementById('lblTotalHaber').textContent = '0.00';
    document.getElementById('lblDiferencia').textContent = '0';
    return;
  }

  let totalDebe = 0;
  let totalHaber = 0;

  lista.forEach(item => {
    totalDebe += Number(item.debe || 0);
    totalHaber += Number(item.haber || 0);

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${item.fecha || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${item.asiento || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-200">${item.detalle || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400">${item.cuenta || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300 font-bold">${item.nombre || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400">${Number(item.debe || 0).toFixed(2)}</td>
      <td class="p-3.5 font-mono text-amber-300">${Number(item.haber || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('lblTotalDebe').textContent = totalDebe.toFixed(2);
  document.getElementById('lblTotalHaber').textContent = totalHaber.toFixed(2);
  
  const diferencia = Math.abs(totalDebe - totalHaber);
  const diffEl = document.getElementById('lblDiferencia');
  diffEl.textContent = diferencia.toFixed(2);
  
  if (diferencia === 0) {
    diffEl.className = 'bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/20 font-bold';
  } else {
    diffEl.className = 'bg-rose-500/10 text-rose-400 px-3 py-1 rounded-lg border border-rose-500/20 font-bold';
  }
}