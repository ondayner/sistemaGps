import { supabase } from '../supabaseClient.js';

let monitorGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarMonitorGPSWOX();

  document.getElementById('inputBuscadorMonitor')?.addEventListener('input', filtrarMonitor);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarMonitorGPSWOX);
});

async function cargarMonitorGPSWOX() {
  const tbody = document.getElementById('tablaMonitorBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando equipos en vivo desde GPSWOX...</td></tr>`;

  try {
    const response = await fetch('http://localhost:3000/api/monitor-gpswox');
    if (!response.ok) throw new Error('No se pudo conectar con el servidor backend.');

    const data = await response.json();
    monitorGlobal = Array.isArray(data) ? data : [];
    renderizarMonitor(monitorGlobal);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-rose-400 font-bold">Error al conectar con la API: ${error.message}</td></tr>`;
  }
}

function renderizarMonitor(lista) {
  const tbody = document.getElementById('tablaMonitorBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-500">No se encontraron dispositivos.</td></tr>`;
    return;
  }

  lista.forEach((item, index) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';

    const activoBadge = (item.active == 1 || item.estatus === 'ACTIVO') 
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">1 (Activo)</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">0 (Inactivo)</span>';

    row.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400 font-bold">${item.nu_secuencia || item.id || index + 1}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${item.name || 'N/A'}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-300">${item.imei || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${item.sim_number || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50">${item.device_model || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300 font-bold">${item.plate_number || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${item.object_owner || 'GALAX'}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-center">${activoBadge}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${item.protocol || 'GT06'}</td>
      <td class="p-3.5 text-slate-400">${item.comment || ''}</td>
    `;
    tbody.appendChild(row);
  });
}

function filtrarMonitor() {
  const texto = document.getElementById('inputBuscadorMonitor').value.toLowerCase().trim();

  const filtrados = monitorGlobal.filter(item => {
    if (!texto) return true;
    
    const nombre = String(item.name || '').toLowerCase();
    const imei = String(item.imei || '').toLowerCase();
    const placa = String(item.plate_number || '').toLowerCase();

    return nombre.includes(texto) || imei.includes(texto) || placa.includes(texto);
  });

  renderizarMonitor(filtrados);
}