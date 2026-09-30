import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let usuariosGlobal = [];
let seleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();

  document.getElementById('inputBuscador')?.addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase();
    const filtrados = usuariosGlobal.filter(u => 
      (u.nombre && u.nombre.toLowerCase().includes(texto)) ||
      (u.email && u.email.toLowerCase().includes(texto)) ||
      (u.rol && u.rol.toLowerCase().includes(texto))
    );
    renderizar(filtrados);
  });

  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarUsuarios);

  const modal = document.getElementById('modalUsuario');

  // Lógica de "Ver Contraseña"
  document.getElementById('btnTogglePassword')?.addEventListener('click', () => {
    const input = document.getElementById('usrPassword');
    const icono = document.getElementById('iconoPassword');
    if (input.type === 'password') {
      input.type = 'text';
      icono.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      icono.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  document.getElementById('btnTogglePasswordConfirm')?.addEventListener('click', () => {
    const input = document.getElementById('usrPasswordConfirm');
    const icono = document.getElementById('iconoPasswordConfirm');
    if (input.type === 'password') {
      input.type = 'text';
      icono.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      icono.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // Abrir Modal Agregar
  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    seleccionadoId = null;
    document.getElementById('modalTitulo').textContent = 'Registrar Usuario';
    document.getElementById('formUsuario').reset();
    document.getElementById('usrPasswordContainer').style.display = 'block';
    document.getElementById('usrPassword').setAttribute('required', 'true');
    document.getElementById('usrPasswordConfirm').setAttribute('required', 'true');
    modal.classList.remove('hidden');
  });

  // Abrir Modal Editar
  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!seleccionadoId) {
      await mostrarAlerta('Debe seleccionar un usuario.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').textContent = 'Editar Usuario';
    
    // Ocultar campos de contraseña al editar si no se desea modificar
    document.getElementById('usrPasswordContainer').style.display = 'none';
    document.getElementById('usrPassword').removeAttribute('required');
    document.getElementById('usrPasswordConfirm').removeAttribute('required');

    const u = usuariosGlobal.find(item => item.id === seleccionadoId);
    if (u) {
      document.getElementById('usrNombre').value = u.nombre || '';
      document.getElementById('usrEmail').value = u.email || '';
      document.getElementById('usrRol').value = u.rol || 'Administrador';
    }
    modal.classList.remove('hidden');
  });

  // Lógica Eliminar Usuario
  document.getElementById('btnEliminarUsuario')?.addEventListener('click', async () => {
    if (!seleccionadoId) {
      await mostrarAlerta('Debe seleccionar un usuario.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    const u = usuariosGlobal.find(item => item.id === seleccionadoId);
    const mensajeConfirm = `¿Seguro que deseas eliminar al usuario: ${u ? u.nombre : ''}?`;
    
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      const { error } = await supabase.from('usuarios').delete().eq('id', seleccionadoId);
      if (error) {
        await mostrarAlerta('Error al eliminar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
      } else {
        seleccionadoId = null;
        cargarUsuarios();
      }
    }
  });

  document.getElementById('btnAsignarPermiso')?.addEventListener('click', async () => {
    if (!seleccionadoId) {
      await mostrarAlerta('Debe seleccionar un usuario para configurar permisos.', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    await mostrarAlerta('Módulo de asignación de permisos vinculado correctamente.', `${CONFIG.SYSTEM_NAME} - Información`);
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modal.classList.add('hidden'));

  // Guardar / Actualizar con validación de contraseñas
  document.getElementById('formUsuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('usrNombre').value.trim().toUpperCase();
    const email = document.getElementById('usrEmail').value.trim();
    const rol = document.getElementById('usrRol').value;

    let datos = { nombre, email, rol };

    if (!modoEdicion) {
      const password = document.getElementById('usrPassword').value;
      const passwordConfirm = document.getElementById('usrPasswordConfirm').value;

      if (password !== passwordConfirm) {
        await mostrarAlerta('Las contraseñas no coinciden. Por favor verifique.', `${CONFIG.SYSTEM_NAME} - Aviso`);
        return;
      }
      datos.password = password;
    }

    let res = modoEdicion 
      ? await supabase.from('usuarios').update(datos).eq('id', seleccionadoId)
      : await supabase.from('usuarios').insert([datos]);

    if (res.error) {
      await mostrarAlerta('Error: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
    } else {
      modal.classList.add('hidden');
      cargarUsuarios();
    }
  });
});

async function cargarUsuarios() {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando usuarios...</td></tr>`;

  const { data, error } = await supabase.from('usuarios').select('*').order('nombre', { ascending: true });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-rose-400">Error al conectar con la base de datos: ${error.message}</td></tr>`;
    return;
  }

  usuariosGlobal = data || [];
  renderizar(usuariosGlobal);
}

function renderizar(lista) {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">No se encontraron usuarios registrados.</td></tr>`;
    return;
  }

  lista.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaUsuariosBody tr').forEach(r => r.classList.remove('bg-purple-600/20'));
      tr.classList.add('bg-purple-600/20');
      seleccionadoId = u.id;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-purple-400 font-bold truncate max-w-[120px]">${u.id || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${u.nombre || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${u.email || ''}</td>
      <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">${u.rol || 'Administrador'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
