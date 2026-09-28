import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let detallesGlobal = [];
let detalleSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarDetalles();

  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarDetalles);
  document.getElementById('inputBuscador')?.addEventListener('input', filtrarDetalles);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarDetalles);

  const modalDetalle = document.getElementById('modalDetalle');

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalDetalle.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalDetalle.classList.add('hidden'));

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    detalleSeleccionadoId = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-plus-circle text-blue-500"></i> Registrar Detalle de Asiento`;
    document.getElementById('formDetalle').reset();
    modalDetalle.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!detalleSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un registro de la tabla para editar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Detalle de Asiento`;
    
    const obj = detallesGlobal.find(d => d.id === detalleSeleccionadoId);
    if (obj) {
      document.getElementById('detalleAsientoNum').value = obj.asiento || '';
      document.getElementById('detalleCuenta').value = obj.cuenta || '';
      document.getElementById('detalleTipo').value = obj.tipo || 'D';
      document.getElementById('detalleMontoUsd').value = obj.monto_usd || 0;
      document.getElementById('detalleMontoBs').value = obj.monto_bs || 0;
      document.getElementById('detalleObservacion').value = obj.observacion || '';
      document.getElementById('detalleEstatus').value = obj.estatus || '';
    }
    modalDetalle.classList.remove('hidden');
  });

  document.getElementById('formDetalle')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const asiento = document.getElementById('detalleAsientoNum').value.trim();
    const cuenta = document.getElementById('detalleCuenta').value.trim();
    const tipo = document.getElementById('detalleTipo').value;
    const monto_usd = parseFloat(document.getElementById('detalleMontoUsd').value) || 0;
    const monto_bs = parseFloat(document.getElementById('detalleMontoBs').value) || 0;
    const observacion = document.getElementById('detalleObservacion').value.trim().toUpperCase();
    const estatus = document.getElementById('detalleEstatus').value.trim();

    let res;
    if (modoEdicion) {
      res = await supabase.from('detalle_asientos').update({ asiento, cuenta, tipo, monto_usd, monto_bs, observacion, estatus }).eq('id', detalleSeleccionadoId);
    } else {
      res = await supabase.from('detalle_asientos').insert([{ asiento, cuenta, tipo, monto_usd, monto_bs, observacion, estatus }]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      return;
    }

    modalDetalle.classList.add('hidden');
    detalleSeleccionadoId = null;
    cargarDetalles();
  });

  document.getElementById('btnEliminarDetalle')?.addEventListener('click', async () => {
    if (!detalleSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un registro de la tabla para eliminar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const obj = detallesGlobal.find(d => d.id === detalleSeleccionadoId);
    const mensajeConfirm = `¿Seguro যে deseas eliminar el detalle ID: ${obj.id}?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('detalle_asientos').delete().eq('id', detalleSeleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        detalleSeleccionadoId = null;
        cargarDetalles();
      }
    }
  });

  document.getElementById('btnExportarCsv')?.addEventListener('click', async () => {
    if (detallesGlobal.length === 0) {
      await mostrarAlerta('No hay registros de detalles para exportar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const cabeceras = ['id', 'asiento', 'cuenta', 'tipo', 'monto_usd', 'monto_bs', 'observacion', 'estatus'];
    let csv = cabeceras.join(',') + '\n';
    detallesGlobal.forEach(item => {
      csv += `${item.id},"${item.asiento}","${item.cuenta}","${item.tipo}",${item.monto_usd},${item.monto_bs},"${item.observacion || ''}","${item.estatus || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `detalle_asientos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
});

async function cargarDetalles() {
  const tbody = document.getElementById('tablaDetalleBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando detalles...</td></tr>`;

  const { data, error } = await supabase.from('detalle_asientos').select('*').order('id', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400">Error al cargar detalles. Asegúrate de crear la tabla en Supabase.</td></tr>`;
    return;
  }
  detallesGlobal = data || [];
  renderizarDetalles(detallesGlobal);
}

function renderizarDetalles(lista) {
  const tbody = document.getElementById('tablaDetalleBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (contador) contador.textContent = `Detalles : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">No hay registros de detalles.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaDetalleBody tr').forEach(t => t.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      tr.classList.add('bg-blue-600/20', 'border-blue-500/40');
      detalleSeleccionadoId = item.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400 font-bold">${item.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-white">${item.asiento || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300">${item.cuenta || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono font-bold ${item.tipo === 'D' ? 'text-blue-400' : 'text-purple-400'}">${item.tipo || 'D'}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400">$${Number(item.monto_usd || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">Bs. ${Number(item.monto_bs || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-200">${item.observacion || '-'}</td>
      <td class="p-3.5 font-mono text-slate-400">${item.estatus || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarDetalles() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = detallesGlobal.filter(item => {
    if (!texto) return true;
    const val = String(item[campo] || '').toLowerCase();
    return val.includes(texto);
  });
  renderizarDetalles(filtrados);
}