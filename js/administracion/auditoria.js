import { supabase } from '../supabaseClient.js';

let auditoriaGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarAuditoria();
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarAuditoria);
  document.getElementById('btnFiltrar')?.addEventListener('click', filtrarAuditoria);
});

async function cargarAuditoria() {
  const tbody = document.getElementById('tablaAuditoriaBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando auditoría...</td></tr>`;

  const { data, error } = await supabase.from('auditoria').select('*').order('id', { ascending: false });
  
  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400">Error al conectar con la base de datos: ${error.message}</td></tr>`;
    return;
  }

  auditoriaGlobal = data || [];
  renderizar(auditoriaGlobal);
}

function renderizar(lista) {
  const tbody = document.getElementById('tablaAuditoriaBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500">No hay registros de auditoría disponibles.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    
    const colorAccion = item.accion === 'I' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400 font-bold">${item.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400">${item.registro || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${item.hora || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${item.concepto || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${colorAccion}">${item.accion || ''}</span></td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${item.programa || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400">${item.tabla || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-semibold text-slate-200">${item.usuario || ''}</td>
      <td class="p-3.5 text-slate-400">${item.equipo || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarAuditoria() {
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();
  const desde = document.getElementById('filtroDesde').value;
  const hasta = document.getElementById('filtroHasta').value;

  const filtrados = auditoriaGlobal.filter(item => {
    const coincideTexto = !texto || 
      (item.concepto && item.concepto.toLowerCase().includes(texto)) ||
      (item.usuario && item.usuario.toLowerCase().includes(texto)) ||
      (item.programa && item.programa.toLowerCase().includes(texto));

    const coincideDesde = !desde || (item.registro && item.registro >= desde);
    const coincideHasta = !hasta || (item.registro && item.registro <= hasta);

    return coincideTexto && coincideDesde && coincideHasta;
  });

  renderizar(filtrados);
}