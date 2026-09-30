import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js'; // Ajusta la ruta según la profundidad de tu carpeta
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let bancosGlobal = [];
let bancoSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarBancos();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarBancos);

  const modalBanco = document.getElementById('modalBanco');

  // Abrir Modal Agregar
  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    bancoSeleccionadoId = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-building-columns text-blue-500"></i> Registrar Banco / Cuenta`;
    document.getElementById('formBanco').reset();
    modalBanco.classList.remove('hidden');
  });

  // Abrir Modal Editar
  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!bancoSeleccionadoId) {
      await mostrarAlerta('Debe Seleccionar un Registro', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Banco / Cuenta`;
    const b = bancosGlobal.find(item => item.id === bancoSeleccionadoId);
    if (b) {
      document.getElementById('bancoCodigo').value = b.codigo || '';
      document.getElementById('bancoNombre').value = b.banco || '';
      document.getElementById('bancoObservacion').value = b.observacion || '';
    }
    modalBanco.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalBanco.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalBanco.classList.add('hidden'));

  // Guardar / Actualizar
  document.getElementById('formBanco')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      codigo: document.getElementById('bancoCodigo').value.trim(),
      banco: document.getElementById('bancoNombre').value.trim().toUpperCase(),
      observacion: document.getElementById('bancoObservacion').value.trim()
    };

    let res;
    if (modoEdicion) {
      res = await supabase.from('bancos').update(datos).eq('id', bancoSeleccionadoId);
    } else {
      res = await supabase.from('bancos').insert([datos]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
    } else {
      modalBanco.classList.add('hidden');
      cargarBancos();
    }
  });

  document.getElementById('btnEliminarBanco')?.addEventListener('click', async () => {
    if (!bancoSeleccionadoId) {
      await mostrarAlerta('Debe Seleccionar un Registro', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const b = bancosGlobal.find(item => item.id === bancoSeleccionadoId);
    const mensajeConfirm = `¿Seguro que deseas eliminar el registro: ${b.banco}?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('bancos').delete().eq('id', bancoSeleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        bancoSeleccionadoId = null;
        cargarBancos();
      }
    }
  });
});

async function cargarBancos() {
  const tbody = document.getElementById('tablaBancosBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando registros...</td></tr>`;

  const { data, error } = await supabase.from('bancos').select('*').order('id', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-400">Error al conectar con la base de datos.</td></tr>`;
    return;
  }

  bancosGlobal = data || [];
  renderizarBancos(bancosGlobal);
}

function renderizarBancos(lista) {
  const tbody = document.getElementById('tablaBancosBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;
  document.getElementById('txtTotalBancos').textContent = lista.length;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">No se encontraron registros.</td></tr>`;
    return;
  }

  lista.forEach((b, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaBancosBody tr').forEach(t => t.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      tr.classList.add('bg-blue-600/20', 'border-blue-500/40');
      bancoSeleccionadoId = b.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400 font-bold">${index + 1}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300 font-bold">${b.codigo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${b.banco || ''}</td>
      <td class="p-3.5 text-slate-400">${b.observacion || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarTabla() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();
  
  const filtrados = bancosGlobal.filter(b => {
    const valor = String(b[campo] || '').toLowerCase();
    return valor.includes(texto);
  });

  renderizarBancos(filtrados);
}
