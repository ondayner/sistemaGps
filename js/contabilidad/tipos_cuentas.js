import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let tiposGlobal = [];
let tipoSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarTiposCuenta();

  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarTiposCuenta);
  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTipos);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTipos);

  const modalTipo = document.getElementById('modalTipo');

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalTipo.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalTipo.classList.add('hidden'));

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    tipoSeleccionadoId = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-plus-circle text-purple-400"></i> Registrar Tipo de Cuenta`;
    document.getElementById('formTipo').reset();
    modalTipo.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!tipoSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un tipo de cuenta de la tabla para editar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-purple-400"></i> Editar Tipo de Cuenta`;
    
    const obj = tiposGlobal.find(t => t.id === tipoSeleccionadoId);
    if (obj) {
      document.getElementById('tipoCodigo').value = obj.codigo || '';
      document.getElementById('tipoNombre').value = obj.tipo_cuenta || '';
      document.getElementById('tipoNaturaleza').value = obj.naturaleza || 'D';
    }
    modalTipo.classList.remove('hidden');
  });

  document.getElementById('formTipo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('tipoCodigo').value.trim().toUpperCase();
    const tipo_cuenta = document.getElementById('tipoNombre').value.trim().toUpperCase();
    const naturaleza = document.getElementById('tipoNaturaleza').value;

    let res;
    if (modoEdicion) {
      res = await supabase.from('tipos_cuenta').update({ codigo, tipo_cuenta, naturaleza }).eq('id', tipoSeleccionadoId);
    } else {
      res = await supabase.from('tipos_cuenta').insert([{ codigo, tipo_cuenta, naturaleza }]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      return;
    }

    modalTipo.classList.add('hidden');
    tipoSeleccionadoId = null;
    cargarTiposCuenta();
  });

  document.getElementById('btnEliminarTipo')?.addEventListener('click', async () => {
    if (!tipoSeleccionadoId) {
      await mostrarAlerta('Debe seleccionar un tipo de cuenta de la tabla para eliminar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const obj = tiposGlobal.find(t => t.id === tipoSeleccionadoId);
    const mensajeConfirm = `¿Seguro que deseas eliminar el tipo: ${obj.tipo_cuenta}?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('tipos_cuenta').delete().eq('id', tipoSeleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        tipoSeleccionadoId = null;
        cargarTiposCuenta();
      }
    }
  });

  document.getElementById('btnExportarCsv')?.addEventListener('click', async () => {
    if (tiposGlobal.length === 0) {
      await mostrarAlerta('No hay tipos de cuenta para exportar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const cabeceras = ['id', 'codigo', 'tipo_cuenta', 'naturaleza'];
    let csv = cabeceras.join(',') + '\n';
    tiposGlobal.forEach(item => {
      csv += `${item.id},"${item.codigo}","${item.tipo_cuenta}","${item.naturaleza}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tipos_de_cuenta_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
});

async function cargarTiposCuenta() {
  const tbody = document.getElementById('tablaTiposCuentaBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando tipos de cuenta...</td></tr>`;

  const { data, error } = await supabase.from('tipos_cuenta').select('*').order('id', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-400">Error al cargar tipos de cuenta. Asegúrate de crear la tabla en Supabase.</td></tr>`;
    return;
  }
  tiposGlobal = data || [];
  renderizarTipos(tiposGlobal);
}

function renderizarTipos(lista) {
  const tbody = document.getElementById('tablaTiposCuentaBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">No hay tipos de cuenta registrados.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaTiposCuentaBody tr').forEach(t => t.classList.remove('bg-purple-600/20', 'border-purple-500/40'));
      tr.classList.add('bg-purple-600/20', 'border-purple-500/40');
      tipoSeleccionadoId = item.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-purple-400 font-bold">${item.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-white font-bold">${item.codigo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-200 font-bold">${item.tipo_cuenta || ''}</td>
      <td class="p-3.5 font-mono font-bold text-amber-400">${item.naturaleza || 'D'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTipos() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = tiposGlobal.filter(item => {
    if (!texto) return true;
    const val = String(item[campo] || '').toLowerCase();
    return val.includes(texto);
  });
  renderizarTipos(filtrados);
}