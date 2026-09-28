import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let planCuentasGlobal = [];
let cuentaSeleccionadaId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarPlanCuentas();

  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarPlanCuentas);
  document.getElementById('inputBuscador')?.addEventListener('input', filtrarPlanCuentas);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarPlanCuentas);

  const modalCuenta = document.getElementById('modalCuenta');

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalCuenta.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalCuenta.classList.add('hidden'));

  // Abrir modal Agregar
  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    cuentaSeleccionadaId = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-plus-circle text-blue-500"></i> Registrar Cuenta Contable`;
    document.getElementById('formCuenta').reset();
    modalCuenta.classList.remove('hidden');
  });

  // Abrir modal Editar
  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!cuentaSeleccionadaId) {
      await mostrarAlerta('Debe seleccionar una cuenta de la tabla para editar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Cuenta Contable`;
    
    const cuentaObj = planCuentasGlobal.find(c => c.id === cuentaSeleccionadaId);
    if (cuentaObj) {
      document.getElementById('cuentaCodigo').value = cuentaObj.codigo || '';
      document.getElementById('cuentaNombre').value = cuentaObj.cuenta || '';
      document.getElementById('cuentaTipo').value = cuentaObj.tipo_cuenta || 'ACTIVO';
      document.getElementById('cuentaNivel').value = cuentaObj.nivel || 4;
      document.getElementById('cuentaAceptaMov').value = cuentaObj.acepta_mov || 'NO';
    }
    modalCuenta.classList.remove('hidden');
  });

  // Guardar (Insertar o Actualizar)
  document.getElementById('formCuenta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('cuentaCodigo').value.trim();
    const cuenta = document.getElementById('cuentaNombre').value.trim().toUpperCase();
    const tipo_cuenta = document.getElementById('cuentaTipo').value;
    const nivel = parseInt(document.getElementById('cuentaNivel').value) || 1;
    const acepta_mov = document.getElementById('cuentaAceptaMov').value;

    let res;
    if (modoEdicion) {
      res = await supabase.from('plan_cuentas').update({ codigo, cuenta, tipo_cuenta, nivel, acepta_mov }).eq('id', cuentaSeleccionadaId);
    } else {
      res = await supabase.from('plan_cuentas').insert([{ codigo, cuenta, tipo_cuenta, nivel, acepta_mov }]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar la cuenta: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      return;
    }

    modalCuenta.classList.add('hidden');
    cuentaSeleccionadaId = null;
    cargarPlanCuentas();
  });

  // Botón Eliminar
  document.getElementById('btnEliminarCuenta')?.addEventListener('click', async () => {
    if (!cuentaSeleccionadaId) {
      await mostrarAlerta('Debe seleccionar una cuenta de la tabla para eliminar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const cuentaObj = planCuentasGlobal.find(c => c.id === cuentaSeleccionadaId);
    const mensajeConfirm = `¿Seguro que deseas eliminar la cuenta: ${cuentaObj.codigo} - ${cuentaObj.cuenta}?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('plan_cuentas').delete().eq('id', cuentaSeleccionadaId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        cuentaSeleccionadaId = null;
        cargarPlanCuentas();
      }
    }
  });

  // Exportar Excel (CSV)
  document.getElementById('btnExportarCsv')?.addEventListener('click', async () => {
    if (planCuentasGlobal.length === 0) {
      await mostrarAlerta('No hay cuentas registradas para exportar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const cabeceras = ['id', 'codigo', 'cuenta', 'tipo_cuenta', 'nivel', 'acepta_mov'];
    let csv = cabeceras.join(',') + '\n';
    planCuentasGlobal.forEach(item => {
      csv += `${item.id},"${item.codigo}","${item.cuenta}","${item.tipo_cuenta}",${item.nivel},"${item.acepta_mov}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plan_de_cuentas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
});

async function cargarPlanCuentas() {
  const tbody = document.getElementById('tablaPlanCuentasBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando cuentas...</td></tr>`;

  const { data, error } = await supabase.from('plan_cuentas').select('*').order('id', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-400">Error al cargar plan de cuentas.</td></tr>`;
    return;
  }
  planCuentasGlobal = data || [];
  renderizarPlanCuentas(planCuentasGlobal);
}

function renderizarPlanCuentas(lista) {
  const tbody = document.getElementById('tablaPlanCuentasBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">No hay cuentas registradas.</td></tr>`;
    return;
  }

  lista.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaPlanCuentasBody tr').forEach(t => t.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      tr.classList.add('bg-blue-600/20', 'border-blue-500/40');
      cuentaSeleccionadaId = item.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${item.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-white font-bold">${item.codigo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-200">${item.cuenta || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${item.tipo_cuenta || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${item.nivel || 1}</td>
      <td class="p-3.5 font-mono font-bold ${item.acepta_mov === 'SI' ? 'text-emerald-400' : 'text-slate-400'}">${item.acepta_mov || 'NO'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarPlanCuentas() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = planCuentasGlobal.filter(item => {
    if (!texto) return true;
    const val = String(item[campo] || '').toLowerCase();
    return val.includes(texto);
  });
  renderizarPlanCuentas(filtrados);
}