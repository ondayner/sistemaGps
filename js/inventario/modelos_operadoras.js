import { supabase } from '../supabaseClient.js';
import CONFIG from '../../../js/config/config.js';
import { mostrarAlerta, mostrarConfirmacion } from '../../../js/components/alertEliminar.js';

document.addEventListener('DOMContentLoaded', () => {
  cargarModelos();
  cargarOperadoras();

  const modal = document.getElementById('modalCatalogo');

  document.getElementById('btnAbrirModalModelo')?.addEventListener('click', () => {
    abrirModal('modelo', null, '');
  });

  document.getElementById('btnAbrirModalOperadora')?.addEventListener('click', () => {
    abrirModal('operadora', null, '');
  });

  document.getElementById('btnCerrarModalCatalogo')?.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('btnCancelarModalCatalogo')?.addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('formCatalogo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = document.getElementById('catalogoTipo').value;
    const id = document.getElementById('catalogoId').value;
    const nombre = document.getElementById('catalogoNombre').value.trim().toUpperCase();

    const tabla = tipo === 'modelo' ? 'modelos_gps' : 'operadoras_sim';

    let res;
    if (id) {
      res = await supabase.from(tabla).update({ nombre }).eq('id', id);
    } else {
      res = await supabase.from(tabla).insert([{ nombre }]);
    }

    if (res.error) {
      await mostrarAlerta('Error al guardar: ' + res.error.message, `${CONFIG.SYSTEM_NAME} - Error`);
    } else {
      modal.classList.add('hidden');
      if (tipo === 'modelo') cargarModelos();
      else cargarOperadoras();
    }
  });
});

function abrirModal(tipo, id, nombre) {
  document.getElementById('catalogoTipo').value = tipo;
  document.getElementById('catalogoId').value = id || '';
  document.getElementById('catalogoNombre').value = nombre || '';
  document.getElementById('modalCatalogoTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500"></i> ${id ? `Editar ${tipo}` : `Registrar ${tipo}`}`;
  document.getElementById('modalCatalogo').classList.remove('hidden');
}

async function cargarModelos() {
  const tbody = document.getElementById('tablaModelosBody');
  const contador = document.getElementById('contadorModelos');
  if (!tbody) return;

  const { data, error } = await supabase.from('modelos_gps').select('*').order('nombre', { ascending: true });
  
  if (contador) contador.textContent = `Cant : ${data ? data.length : 0}`;

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-500 italic">No hay modelos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400 font-bold">${index + 1}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${item.nombre}</td>
      <td class="p-3.5 text-center flex items-center justify-center gap-2">
        <button type="button" class="btn-editar text-blue-400 hover:text-blue-300 p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 transition-colors" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="btn-eliminar text-rose-400 hover:text-rose-300 p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 transition-colors" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tr.querySelector('.btn-editar').addEventListener('click', () => abrirModal('modelo', item.id, item.nombre));
    tr.querySelector('.btn-eliminar').addEventListener('click', async () => {
      const confirmado = await mostrarConfirmacion(`¿Seguro que deseas eliminar el modelo ${item.nombre}?`, `${CONFIG.SYSTEM_NAME} - Confirmación`);
      if (confirmado) {
        const { error: errDel } = await supabase.from('modelos_gps').delete().eq('id', item.id);
        if (errDel) {
          await mostrarAlerta('No se puede eliminar porque está en uso.', `${CONFIG.SYSTEM_NAME} - Aviso`);
        } else {
          cargarModelos();
        }
      }
    });
    tbody.appendChild(tr);
  });
}

async function cargarOperadoras() {
  const tbody = document.getElementById('tablaOperadorasBody');
  const contador = document.getElementById('contadorOperadoras');
  if (!tbody) return;

  const { data, error } = await supabase.from('operadoras_sim').select('*').order('nombre', { ascending: true });
  
  if (contador) contador.textContent = `Cant : ${data ? data.length : 0}`;

  if (error || !data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-500 italic">No hay operadoras registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  data.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400 font-bold">${index + 1}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${item.nombre}</td>
      <td class="p-3.5 text-center flex items-center justify-center gap-2">
        <button type="button" class="btn-editar text-blue-400 hover:text-blue-300 p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 transition-colors" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="btn-eliminar text-rose-400 hover:text-rose-300 p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20 transition-colors" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tr.querySelector('.btn-editar').addEventListener('click', () => abrirModal('operadora', item.id, item.nombre));
    tr.querySelector('.btn-eliminar').addEventListener('click', async () => {
      const confirmado = await mostrarConfirmacion(`¿Seguro que deseas eliminar la operadora ${item.nombre}?`, `${CONFIG.SYSTEM_NAME} - Confirmación`);
      if (confirmado) {
        const { error: errDel } = await supabase.from('operadoras_sim').delete().eq('id', item.id);
        if (errDel) {
          await mostrarAlerta('No se puede eliminar porque está en uso.', `${CONFIG.SYSTEM_NAME} - Aviso`);
        } else {
          cargarOperadoras();
        }
      }
    });
    tbody.appendChild(tr);
  });
}