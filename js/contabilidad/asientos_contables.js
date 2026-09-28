import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let asientosGlobal = [];
let asientoSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarAsientos();

  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarAsientos);
  document.getElementById('inputBuscador')?.addEventListener('input', filtrarAsientos);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarAsientos);

  const modalAsiento = document.getElementById('modalAsiento');

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalAsiento.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalAsiento.classList.add('hidden'));

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    asientoSeleccionadoId = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-plus-circle text-amber-500"></i> Registrar Asiento Contable`;
    document.getElementById('formAsiento').reset();
    document.getElementById('asientoFecha').value = new Date().toISOString().split('T')[0];
    modalAsiento.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!asientoSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un asiento de la tabla para editar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500"></i> Editar Asiento Contable`;
    
    const obj = asientosGlobal.find(a => a.id === asientoSeleccionadoId);
    if (obj) {
      document.getElementById('asientoCodigo').value = obj.codigo || '';
      document.getElementById('asientoFecha').value = obj.fecha || '';
      document.getElementById('asientoConcepto').value = obj.concepto || '';
      document.getElementById('asientoDebito').value = obj.debito || 0;
      document.getElementById('asientoCredito').value = obj.credito || 0;
      document.getElementById('asientoEstatus').value = obj.estatus || 'ACTIVO';
    }
    modalAsiento.classList.remove('hidden');
  });

  document.getElementById('formAsiento')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('asientoCodigo').value.trim();
    const fecha = document.getElementById('asientoFecha').value;
    const concepto = document.getElementById('asientoConcepto').value.trim().toUpperCase();
    const debito = parseFloat(document.getElementById('asientoDebito').value) || 0;
    const credito = parseFloat(document.getElementById('asientoCredito').value) || 0;
    const estatus = document.getElementById('asientoEstatus').value;

    let res;
    if (modoEdicion) {
      res = await supabase.from('asientos').update({ codigo, fecha, concepto, debito, credito, estatus }).eq('id', asientoSeleccionadoId);
    } else {
      res = await supabase.from('asientos').insert([{ codigo, fecha, concepto, debito, credito, estatus }]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      return;
    }

    modalAsiento.classList.add('hidden');
    asientoSeleccionadoId = null;
    cargarAsientos();
  });

  document.getElementById('btnEliminarAsiento')?.addEventListener('click', async () => {
    if (!asientoSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un asiento de la tabla para eliminar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const obj = asientosGlobal.find(a => a.id === asientoSeleccionadoId);
    const mensajeConfirm = `¿Seguro que deseas eliminar el asiento ID: ${obj.id} (${obj.concepto})?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('asientos').delete().eq('id', asientoSeleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        asientoSeleccionadoId = null;
        cargarAsientos();
      }
    }
  });

  document.getElementById('btnExportarCsv')?.addEventListener('click', async () => {
    if (asientosGlobal.length === 0) {
      await mostrarAlerta('No hay asientos contables para exportar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const cabeceras = ['id', 'codigo', 'fecha', 'concepto', 'debito', 'credito', 'estatus'];
    let csv = cabeceras.join(',') + '\n';
    asientosGlobal.forEach(item => {
      csv += `${item.id},"${item.codigo}","${item.fecha}","${item.concepto}",${item.debito},${item.credito},"${item.estatus}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `asientos_contables_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
});

async function cargarAsientos() {
  const tbody = document.getElementById('tablaAsientosBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando asientos...</td></tr>`;

  const { data, error } = await supabase.from('asientos').select('*').order('id', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400">Error al cargar asientos. Asegúrate de crear la tabla en Supabase.</td></tr>`;
    return;
  }
  asientosGlobal = data || [];
  renderizarAsientos(asientosGlobal);
}

function renderizarAsientos(lista) {
  const tbody = document.getElementById('tablaAsientosBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (contador) contador.textContent = `Asientos : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">No hay asientos registrados.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaAsientosBody tr').forEach(t => t.classList.remove('bg-amber-600/20', 'border-amber-500/40'));
      tr.classList.add('bg-amber-600/20', 'border-amber-500/40');
      asientoSeleccionadoId = item.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${item.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-white">${item.codigo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${item.fecha || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-200 font-bold">${item.concepto || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400">${Number(item.debito || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300">${Number(item.credito || 0).toFixed(2)}</td>
      <td class="p-3.5 font-mono text-slate-400">${item.estatus || 'ACTIVO'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarAsientos() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = asientosGlobal.filter(item => {
    if (!texto) return true;
    const val = String(item[campo] || '').toLowerCase();
    return val.includes(texto);
  });
  renderizarAsientos(filtrados);
}