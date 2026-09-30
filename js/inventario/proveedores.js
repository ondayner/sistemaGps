import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let proveedoresGlobal = [];
let proveedorSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarProveedores();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarProveedores);

  const modalProveedor = document.getElementById('modalProveedor');

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    proveedorSeleccionadoId = null;
    limpiarErrores();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-truck-field text-amber-500"></i> Registrar Proveedor`;
    document.getElementById('formProveedor').reset();
    modalProveedor.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!proveedorSeleccionadoId) {
      await mostrarAlerta('Debe Seleccionar un Proveedor', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    limpiarErrores();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500"></i> Editar Proveedor`;

    const prov = proveedoresGlobal.find(p => p.id === proveedorSeleccionadoId);
    if (prov) {
      document.getElementById('provNombre').value = prov.nombre || '';
      document.getElementById('provContacto').value = prov.contacto || '';
      document.getElementById('provTelefono').value = prov.telefono || '';
      document.getElementById('provCorreo').value = prov.correo || '';
      document.getElementById('provDireccion').value = prov.direccion || '';
    }
    modalProveedor.classList.remove('hidden');
  });

  document.getElementById('btnEliminarProveedor')?.addEventListener('click', async () => {
    if (!proveedorSeleccionadoId) {
      await mostrarAlerta('Debe Seleccionar un Proveedor', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const prov = proveedoresGlobal.find(p => p.id === proveedorSeleccionadoId);
    const mensajeConfirm = `¿Seguro que deseas eliminar al proveedor "${prov.nombre}"?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('proveedores').delete().eq('id', proveedorSeleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        proveedorSeleccionadoId = null;
        cargarProveedores();
      }
    }
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalProveedor.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalProveedor.classList.add('hidden'));

  document.getElementById('formProveedor')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores();

    const nombreVal = document.getElementById('provNombre').value.trim().toUpperCase();

    if (!modoEdicion) {
      const existe = proveedoresGlobal.some(p => p.nombre.toLowerCase() === nombreVal.toLowerCase());
      if (existe) {
        mostrarErrorSpan('errorNombre', 'Este proveedor ya se encuentra registrado.');
        return;
      }
    }

    const datosForm = {
      nombre: nombreVal,
      contacto: document.getElementById('provContacto').value.trim().toUpperCase(),
      telefono: document.getElementById('provTelefono').value.trim(),
      correo: document.getElementById('provCorreo').value.trim(),
      direccion: document.getElementById('provDireccion').value.trim().toUpperCase()
    };

    let res;
    if (modoEdicion) {
      res = await supabase.from('proveedores').update(datosForm).eq('id', proveedorSeleccionadoId);
    } else {
      res = await supabase.from('proveedores').insert([datosForm]);
    }

    const { error } = res;
    if (error) {
      await mostrarAlerta('Error BD: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      return;
    }

    modalProveedor.classList.add('hidden');
    proveedorSeleccionadoId = null;
    cargarProveedores();
  });
});

function mostrarErrorSpan(spanId, mensaje) {
  const span = document.getElementById(spanId);
  if (span) {
    span.textContent = mensaje;
    span.classList.remove('hidden');
  }
}

function limpiarErrores() {
  const span = document.getElementById('errorNombre');
  if (span) {
    span.textContent = '';
    span.classList.add('hidden');
  }
}

async function cargarProveedores() {
  const tbody = document.getElementById('tablaProveedoresBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando proveedores...</td></tr>`;

  const { data, error } = await supabase.from('proveedores').select('*').order('nombre', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-rose-400">Error al conectar con la base de datos.</td></tr>`;
    return;
  }

  proveedoresGlobal = data || [];
  filtrarTabla();
}

function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaProveedoresBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">No se encontraron proveedores registrados.</td></tr>`;
    return;
  }

  lista.forEach((prov) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    row.addEventListener('click', () => {
      document.querySelectorAll('#tablaProveedoresBody tr').forEach(tr => tr.classList.remove('bg-amber-600/20', 'border-amber-500/40'));
      row.classList.add('bg-amber-600/20', 'border-amber-500/40');
      proveedorSeleccionadoId = prov.id;
    });

    row.innerHTML = `
      <td class="p-3.5 font-mono text-amber-400 font-bold">${prov.id || 'N/A'}</td>
      <td class="p-3.5 font-bold text-white">${prov.nombre || ''}</td>
      <td class="p-3.5 text-slate-300">${prov.contacto || 'N/D'}</td>
      <td class="p-3.5 font-mono text-slate-300">${prov.telefono || 'N/D'}</td>
      <td class="p-3.5 text-slate-400">${prov.correo || 'N/D'}</td>
      <td class="p-3.5 flex items-center gap-2">
        <span class="text-slate-400 truncate max-w-[150px]" title="${prov.direccion || ''}">${prov.direccion || 'N/D'}</span>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filtrarTabla() {
  const campoSelect = document.getElementById('filtroCampo');
  const estatusSelect = document.getElementById('filtroEstatus');
  const buscadorInput = document.getElementById('inputBuscador');

  const campo = campoSelect ? campoSelect.value : 'todos';
  const estatusFiltro = estatusSelect ? estatusSelect.value : 'TODOS';
  const textoBusqueda = buscadorInput ? buscadorInput.value.toLowerCase().trim() : '';

  const filtrados = proveedoresGlobal.filter(prov => {
    if (estatusFiltro !== 'TODOS' && prov.estatus !== estatusFiltro) return false;

    if (textoBusqueda) {
      if (campo === 'todos' || !campo) {
        const nombre = String(prov.nombre || '').toLowerCase();
        const contacto = String(prov.contacto || '').toLowerCase();
        const telefono = String(prov.telefono || '').toLowerCase();
        const correo = String(prov.correo || '').toLowerCase();
        
        return nombre.includes(textoBusqueda) || 
               contacto.includes(textoBusqueda) || 
               telefono.includes(textoBusqueda) || 
               correo.includes(textoBusqueda);
      } else {
        const valorCampo = String(prov[campo] || '').toLowerCase();
        return valorCampo.includes(textoBusqueda);
      }
    }

    return true;
  });

  renderizarTabla(filtrados);
}
