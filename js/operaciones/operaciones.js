import { supabase } from '../supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  cargarOperaciones();
});

async function cargarOperaciones() {
  const tbody = document.querySelector('tbody');
  if (!tbody) return;

  const { data, error } = await supabase
    .from('flota_activa')
    .select(`*, clientes ( nombre_razon_social ), equipos ( serial_imei )`);

  if (error) return console.error(error.message);
  tbody.innerHTML = '';

  data?.forEach((item) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors';
    
    const estadoColor = item.estado_vehiculo === 'En Ruta' ? 'bg-emerald-500' : 'bg-amber-500';

    row.innerHTML = `
      <td class="p-3 font-bold flex items-center gap-2 text-gray-900 dark:text-white">
        <span class="w-2 h-2 rounded-full ${estadoColor}"></span> ${item.placa_vehiculo}
      </td>
      <td class="p-3 text-gray-600 dark:text-slate-300">${item.clientes?.nombre_razon_social || 'N/A'}</td>
      <td class="p-3 text-gray-500 dark:text-slate-400 font-mono">${item.equipos?.serial_imei || 'Sin Asignar'}</td>
      <td class="p-3 text-gray-600 dark:text-slate-300">${item.tecnico || 'N/A'}</td>
      <td class="p-3 font-semibold text-blue-600 dark:text-blue-400">${item.velocidad_kmh} km/h</td>
      <td class="p-3 text-right">
        <button class="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"><i class="fa-solid fa-map-pin"></i></button>
      </td>
    `;
    tbody.appendChild(row);
  });
}