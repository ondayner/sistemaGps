import { supabase } from '../supabaseClient.js';
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let inventarioUnificado = [];
let proveedoresList = [];
let modelosList = [];
let operadorasList = [];
let seleccionado = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarListasAuxiliares();
  cargarInventarioCompleto();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarDatos);
  document.getElementById('selectFiltroTipo')?.addEventListener('change', filtrarDatos);
  document.getElementById('selectFiltroEstado')?.addEventListener('change', filtrarDatos);
  document.getElementById('selectFiltroOrigen')?.addEventListener('change', filtrarDatos);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarInventarioCompleto);

  const modal = document.getElementById('modalInventario');
  const selectTipoIngreso = document.getElementById('selectTipoIngreso');

  setupBuscadorPersonalizado('invExtra', 'sugerenciasProveedoresInv', () => proveedoresList);

  selectTipoIngreso?.addEventListener('change', async (e) => {
    const val = e.target.value;
    const esLote = val.includes('lote');
    document.getElementById('campoCantidadLote').style.display = esLote ? 'grid' : 'none';
    document.getElementById('contenedorInputsDinamicos').innerHTML = '';

    const lblMaster = document.getElementById('labelModeloOperadoraMaster');
    if (lblMaster) {
      lblMaster.textContent = val.includes('equipo') ? 'Modelo GPS Maestro :' : 'Operadora Maestra :';
    }

    setupBuscadorPersonalizado('invMasterDetalle', 'sugerenciasMasterInv', () => val.includes('equipo') ? modelosList : operadorasList);

    if (esLote) {
      document.getElementById('invCantidad').value = '';
      document.getElementById('invIdentificador').value = '';
      document.getElementById('invMasterDetalle').value = '';
    } else {
      document.getElementById('invIdentificador').value = 'INGRESO-UNITARIO-' + Date.now().toString().slice(-6);
      generarInputsDinamicos(val, 1);
    }
  });

  document.getElementById('invMasterDetalle')?.addEventListener('input', () => {
    const valorMaster = document.getElementById('invMasterDetalle').value.trim().toUpperCase();
    const tipo = selectTipoIngreso.value;
    const selectorHijos = tipo.includes('equipo') ? '.input-modelo-sug' : '.input-operadora-sug';
    
    document.querySelectorAll(selectorHijos).forEach(input => {
      input.value = valorMaster;
    });
    actualizarNombreLoteAutomatico();
  });

  document.getElementById('invCantidad')?.addEventListener('input', async (e) => {
    const tipo = selectTipoIngreso.value;
    if (tipo.includes('lote')) {
      const cantidad = parseInt(e.target.value) || 0;
      if (cantidad > 0) {
        generarInputsDinamicos(tipo, cantidad > 20 ? 20 : cantidad);
        await actualizarNombreLoteAutomatico();
      } else {
        document.getElementById('contenedorInputsDinamicos').innerHTML = '';
        document.getElementById('invIdentificador').value = '';
      }
    }
  });

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    document.getElementById('formInventario').reset();
    document.getElementById('campoCantidadLote').style.display = 'grid';
    selectTipoIngreso.value = 'lote_equipos';
    document.getElementById('labelModeloOperadoraMaster').textContent = 'Modelo GPS Maestro :';
    setupBuscadorPersonalizado('invMasterDetalle', 'sugerenciasMasterInv', () => modelosList);
    document.getElementById('invCantidad').value = '';
    document.getElementById('contenedorInputsDinamicos').innerHTML = '';
    document.getElementById('invIdentificador').value = '';
    document.getElementById('invMasterDetalle').value = '';
    modal.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modal.classList.add('hidden'));

  // Envío del formulario
  document.getElementById('formInventario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipoIngreso = selectTipoIngreso.value;
    const nombreLote = document.getElementById('invIdentificador').value.trim().toUpperCase();
    const proveedorComun = document.getElementById('invExtra')?.value.trim().toUpperCase() || 'N/D';
    const timestampBase = Date.now();

    const filasDinamicas = document.querySelectorAll('.fila-dinamica');

    if (tipoIngreso.includes('equipo')) {
      const registros = [];
      filasDinamicas.forEach((fila, index) => {
        const imei = fila.querySelector('.input-imei')?.value.trim().toUpperCase();
        const modelo = fila.querySelector('.input-modelo-sug')?.value.trim().toUpperCase();
        if (imei) {
          registros.push({
            id: timestampBase + index,
            serial_imei: imei,
            modelo: modelo || 'GENÉRICO',
            proveedor: proveedorComun,
            nota: tipoIngreso.includes('lote') ? `LOTE ALMACÉN: ${nombreLote}` : 'INGRESO UNITARIO DIRECTO',
            estatus: 'DISPONIBLE',
            telefono: null,
            esta_en_plataforma: 'NO',
            microfono: 'NO'
          });
        }
      });

      if (registros.length === 0) {
        await mostrarAlerta('Debe ingresar al menos un IMEI válido.');
        return;
      }

      const { error } = await supabase.from('equipos').insert(registros);
      if (error) {
        await mostrarAlerta('Error al guardar equipos: ' + error.message);
      } else {
        modal.classList.add('hidden');
        cargarInventarioCompleto();
      }
    } 
    else if (tipoIngreso.includes('linea')) {
      const registros = [];
      filasDinamicas.forEach((fila, index) => {
        const telefono = fila.querySelector('.input-telefono')?.value.trim();
        const operadora = fila.querySelector('.input-operadora-sug')?.value.trim().toUpperCase();
        const iccid = fila.querySelector('.input-iccid')?.value.trim().toUpperCase();
        if (telefono && iccid) {
          registros.push({
            id: timestampBase + index,
            telefono: telefono,
            telefonia: operadora || 'MOVILNET',
            serial: iccid,
            nota: tipoIngreso.includes('lote') ? `LOTE ALMACÉN: ${nombreLote}` : 'INGRESO UNITARIO DIRECTO',
            estatus: 'DISPONIBLE',
            eq_asociado: null,
            esta_en_plataforma: 'NO'
          });
        }
      });

      if (registros.length === 0) {
        await mostrarAlerta('Debe ingresar el número y el Serial SIM en cada línea.');
        return;
      }

      const { error } = await supabase.from('lineas').insert(registros);
      if (error) {
        await mostrarAlerta('Error al guardar líneas: ' + error.message);
      } else {
        modal.classList.add('hidden');
        cargarInventarioCompleto();
      }
    }
  });

  // Botón Eliminar globalizado con la función importada
  document.getElementById('btnEliminar')?.addEventListener('click', async () => {
    if (!seleccionado) {
      await mostrarAlerta('Debe seleccionar un elemento de la lista.');
      return;
    }

    const mensajeConfirm = `¿Seguro que deseas eliminar este registro de ${seleccionado.tipo.toUpperCase()} (${seleccionado.identificador})?`;
    const confirmado = await mostrarConfirmacion(mensajeConfirm);

    if (confirmado) {
      const tabla = seleccionado.tipo === 'equipo' ? 'equipos' : 'lineas';
      const { error } = await supabase.from(tabla).delete().eq('id', seleccionado.id);
      
      if (!error) {
        seleccionado = null;
        cargarInventarioCompleto();
      } else {
        await mostrarAlerta('Error al eliminar: ' + error.message);
      }
    }
  });
});

async function actualizarNombreLoteAutomatico() {
  const tipoIngreso = document.getElementById('selectTipoIngreso').value;
  const inputIdentificador = document.getElementById('invIdentificador');
  if (!inputIdentificador || !tipoIngreso.includes('lote')) return;

  const esEquipo = tipoIngreso.includes('equipo');
  const sufijoTipo = esEquipo ? 'EQUIPOS' : 'LINEAS';
  
  const masterValor = document.getElementById('invMasterDetalle')?.value.trim().toUpperCase();
  const detalleValor = masterValor ? masterValor : (esEquipo ? 'GPS' : 'OPERADORA');

  const tablaConsulta = esEquipo ? 'equipos' : 'lineas';
  const { data } = await supabase.from(tablaConsulta).select('nota').like('nota', '%LOTE ALMACÉN:%');

  let consecutivo = 1;
  if (data && data.length > 0) {
    const lotesUnicos = new Set(data.map(item => item.nota));
    consecutivo = lotesUnicos.size + 1;
  }

  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  inputIdentificador.value = `LOTE_${consecutivo}_${sufijoTipo}_${detalleValor}_${fechaHoy}`;
}

async function cargarListasAuxiliares() {
  const [resProv, resMod, resOp] = await Promise.all([
    supabase.from('proveedores').select('nombre'),
    supabase.from('modelos_gps').select('nombre'),
    supabase.from('operadoras_sim').select('nombre')
  ]);

  if (resProv.data) proveedoresList = resProv.data.map(p => p.nombre);
  if (resMod.data && resMod.data.length > 0) {
    modelosList = resMod.data.map(m => m.nombre);
  } else {
    modelosList = ['FMB920', 'FMC130', 'GV50M', 'ST300'];
  }

  if (resOp.data && resOp.data.length > 0) {
    operadorasList = resOp.data.map(o => o.nombre);
  } else {
    operadorasList = ['MOVILNET', 'MOVISTAR', 'DIGITEL', 'INTERNET M2M'];
  }
}

function generarInputsDinamicos(tipo, cantidad) {
  const contenedor = document.getElementById('contenedorInputsDinamicos');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  const valorMaster = document.getElementById('invMasterDetalle')?.value.trim().toUpperCase() || '';

  for (let i = 1; i <= cantidad; i++) {
    const div = document.createElement('div');
    div.className = 'fila-dinamica bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 mb-2';

    if (tipo.includes('equipo')) {
      div.innerHTML = `
        <div class="flex items-center justify-between text-[11px] text-slate-400 font-bold">
          <span>Equipo #${i}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">IMEI del Equipo :</label>
            <input type="text" required placeholder="Ej: 354892..." class="input-imei w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs uppercase">
          </div>
          <div class="relative">
            <div class="flex items-center justify-between mb-0.5">
              <label class="text-[10px] text-slate-400">Modelo GPS :</label>
              <a href="/views/inventario/modelosOperadoras/modelos_operadoras.html" target="_blank" class="text-[9px] text-amber-400 hover:underline"><i class="fa-solid fa-plus"></i> Gestionar</a>
            </div>
            <input type="text" autocomplete="off" value="${valorMaster}" placeholder="Modelo GPS..." class="input-modelo-sug w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase font-mono focus:border-amber-500">
            <div class="sugerencias-modelo absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-36 overflow-y-auto z-50 hidden divide-y divide-slate-800 text-xs"></div>
          </div>
        </div>
      `;
      const inputModelo = div.querySelector('.input-modelo-sug');
      setupBuscadorDinamico(inputModelo, div.querySelector('.sugerencias-modelo'), () => modelosList);
      inputModelo.addEventListener('input', actualizarNombreLoteAutomatico);
    } else {
      div.innerHTML = `
        <div class="flex items-center justify-between text-[11px] text-slate-400 font-bold">
          <span>Línea / SIM #${i}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Número Telefónico :</label>
            <input type="text" required placeholder="Ej: 04141234567" class="input-telefono w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs">
          </div>
          <div class="relative">
            <div class="flex items-center justify-between mb-0.5">
              <label class="text-[10px] text-slate-400">Operadora :</label>
              <a href="/views/inventario/modelosOperadoras/modelos_operadoras.html" target="_blank" class="text-[9px] text-blue-400 hover:underline"><i class="fa-solid fa-plus"></i> Gestionar</a>
            </div>
            <input type="text" autocomplete="off" value="${valorMaster}" placeholder="Operadora..." class="input-operadora-sug w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase font-mono focus:border-amber-500">
            <div class="sugerencias-operadora absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-36 overflow-y-auto z-50 hidden divide-y divide-slate-800 text-xs"></div>
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-0.5">Serial SIM (Obligatorio) :</label>
            <input type="text" required placeholder="Serial SIM..." class="input-iccid w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs uppercase">
          </div>
        </div>
      `;
      const inputOperadora = div.querySelector('.input-operadora-sug');
      setupBuscadorDinamico(inputOperadora, div.querySelector('.sugerencias-operadora'), () => operadorasList);
      inputOperadora.addEventListener('input', actualizarNombreLoteAutomatico);
    }
    contenedor.appendChild(div);
  }
  actualizarNombreLoteAutomatico();
}

function setupBuscadorDinamico(input, contenedor, getListaFn) {
  if (!input || !contenedor) return;

  const mostrarSugerencias = () => {
    const texto = input.value.toLowerCase().trim();
    const lista = getListaFn();
    const filtrados = texto 
      ? lista.filter(item => item.toLowerCase().includes(texto))
      : lista;

    if (filtrados.length === 0) {
      contenedor.classList.add('hidden');
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2 text-slate-300 hover:bg-amber-600/30 hover:text-white cursor-pointer transition-colors';
      div.textContent = item;
      div.addEventListener('click', () => {
        input.value = item;
        contenedor.classList.add('hidden');
        actualizarNombreLoteAutomatico();
      });
      contenedor.appendChild(div);
    });

    contenedor.classList.remove('hidden');
  };

  input.addEventListener('input', mostrarSugerencias);
  input.addEventListener('focus', mostrarSugerencias);

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !contenedor.contains(e.target)) {
      contenedor.classList.add('hidden');
    }
  });
}

function setupBuscadorPersonalizado(inputId, sugerenciasId, getListaFn, limite = 5) {
  const input = document.getElementById(inputId);
  const contenedor = document.getElementById(sugerenciasId);
  if (!input || !contenedor) return;

  const mostrarSugerencias = () => {
    const texto = input.value.toLowerCase().trim();
    const lista = getListaFn();
    const filtrados = texto 
      ? lista.filter(item => item.toLowerCase().includes(texto)).slice(0, limite)
      : lista.slice(0, limite);

    if (filtrados.length === 0) {
      contenedor.classList.add('hidden');
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(item => {
      const div = document.createElement('div');
      div.className = 'p-2.5 text-slate-300 hover:bg-amber-600/30 hover:text-white cursor-pointer transition-colors';
      div.textContent = item;
      div.addEventListener('click', () => {
        input.value = item;
        contenedor.classList.add('hidden');
        actualizarNombreLoteAutomatico();
      });
      contenedor.appendChild(div);
    });

    contenedor.classList.remove('hidden');
  };

  input.addEventListener('input', mostrarSugerencias);
  input.addEventListener('focus', mostrarSugerencias);

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !contenedor.contains(e.target)) {
      contenedor.classList.add('hidden');
    }
  });
}

async function cargarInventarioCompleto() {
  const [resEquipos, resLineas] = await Promise.all([
    supabase.from('equipos').select('*').order('id', { ascending: false }),
    supabase.from('lineas').select('*').order('id', { ascending: false })
  ]);

  const listaEquipos = (resEquipos.data || []).map(e => {
    const estaAsignado = (e.eq_asociado && e.eq_asociado.trim() !== '') || (e.esta_en_plataforma === 'SI');
    
    return {
      id: e.id,
      tipo: 'equipo',
      identificador: e.serial_imei,
      secundario: e.modelo || 'SIN MODELO',
      extra: e.proveedor || 'N/D',
      nota: e.nota || 'INVENTARIO',
      estado: estaAsignado ? 'asignado' : 'disponible',
      origen: (e.nota && e.nota.includes('LOTE ALMACÉN')) ? 'lote' : 'unitario'
    };
  });

  const listaLineas = (resLineas.data || []).map(l => {
    const estaAsignado = (l.eq_asociado && l.eq_asociado.trim() !== '') || (l.esta_en_plataforma === 'SI');

    return {
      id: l.id,
      tipo: 'linea',
      identificador: l.telefono,
      secundario: l.telefonia || 'SIN OPERADORA',
      extra: l.serial || 'S/ICCID',
      nota: l.nota || 'INVENTARIO',
      estado: estaAsignado ? 'asignado' : 'disponible',
      origen: (l.nota && l.nota.includes('LOTE ALMACÉN')) ? 'lote' : 'unitario'
    };
  });

  inventarioUnificado = [...listaEquipos, ...listaLineas];
  renderizar(inventarioUnificado);
}

function renderizar(lista) {
  const tbody = document.getElementById('tablaInventarioBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500">No hay registros de inventario disponibles.</td></tr>`;
    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaInventarioBody tr').forEach(r => r.classList.remove('bg-amber-600/20', 'border-amber-500/40'));
      tr.classList.add('bg-amber-600/20', 'border-amber-500/40');
      seleccionado = { id: item.id, tipo: item.tipo, identificador: item.identificador };
    });

    const badgeEstado = item.estado === 'disponible'
      ? `<span class="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold flex items-center gap-1.5 w-fit"><i class="fa-solid fa-box-open"></i> DISPONIBLE</span>`
      : `<span class="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[10px] font-bold flex items-center gap-1.5 w-fit"><i class="fa-solid fa-link"></i> ASIGNADO</span>`;

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50">${badgeEstado}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-semibold text-slate-300">
        ${item.tipo === 'equipo' ? '<i class="fa-solid fa-satellite-dish text-amber-400 mr-1"></i> EQUIPO' : '<i class="fa-solid fa-sim-card text-blue-400 mr-1"></i> LÍNEA'}
      </td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${item.identificador}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${item.secundario}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300 font-mono">${item.extra}</td>
      <td class="p-3.5 text-blue-400 font-semibold">${item.nota}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarDatos() {
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();
  const filtroTipo = document.getElementById('selectFiltroTipo').value;
  const filtroEstado = document.getElementById('selectFiltroEstado').value;
  const filtroOrigen = document.getElementById('selectFiltroOrigen').value;

  const filtrados = inventarioUnificado.filter(item => {
    if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;
    if (filtroEstado !== 'todos' && item.estado !== filtroEstado) return false;
    if (filtroOrigen !== 'todos' && item.origen !== filtroOrigen) return false;

    return (
      (item.identificador && item.identificador.toLowerCase().includes(texto)) ||
      (item.secundario && item.secundario.toLowerCase().includes(texto)) ||
      (item.extra && item.extra.toLowerCase().includes(texto)) ||
      (item.nota && item.nota.toLowerCase().includes(texto))
    );
  });
  renderizar(filtrados);
}