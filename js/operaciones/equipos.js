import { supabase } from '../supabaseClient.js';

let equiposGlobal = [];
let vehiculosList = [];
let lineasList = [];
let empleadosList = [];
let proveedoresList = [];
let equipoSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarListasDesplegables();
  cargarEquipos();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroEstatus')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroSinImei')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarEquipos);

  const modalEquipo = document.getElementById('modalEquipo');
  const modalAlerta = document.getElementById('modalAlerta');
  const modalEliminar = document.getElementById('modalEliminar');

  setupBuscadorPersonalizado('eqLineaSelect', 'sugerenciasLinea', () => lineasList.map(l => `${l.telefono} (${l.serial})`));
  setupBuscadorPersonalizado('eqVehiculoSelect', 'sugerenciasVehiculo', () => vehiculosList.map(v => v.matricula));
  setupBuscadorPersonalizado('eqTecnico', 'sugerenciasTecnico', () => {
      const soloTecnicos = empleadosList.filter(emp => {
        const rol = (emp.nota || '').toUpperCase(); 
        return rol.includes('TECNICO') || rol.includes('TÉCNICO') || rol.includes('INSTALADOR');
      });
      return soloTecnicos.map(emp => emp.nombre);
    }, 5);
  setupBuscadorPersonalizado('eqProveedor', 'sugerenciasProveedor', () => proveedoresList.map(p => p.nombre), 5);

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-location-crosshairs text-blue-500"></i> Registrar Equipo GPS`;
    document.getElementById('formEquipo').reset();
    
    const inputId = document.getElementById('eqIdNum');
    if (inputId) {
      inputId.value = '';
      inputId.disabled = false;
    }
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('eqRegistro').value = hoy;
    modalEquipo.classList.remove('hidden');
  });

  const btnExportarCsv = document.getElementById('btnExportarCsv') || document.querySelector('button .fa-file-excel')?.closest('button');
  btnExportarCsv?.addEventListener('click', () => {
    if (equiposGlobal.length === 0) {
      mostrarAlertaModal('No hay registros para exportar.');
      return;
    }

    const cabeceras = ['id', 'serial_imei', 'telefono', 'vehiculo_id', 'modelo', 'tecnico', 'responsable', 'fecha_registro', 'emision', 'salida', 'instalacion', 'microfono', 'estatus', 'proveedor', 'esta_en_plataforma', 'nota'];
    let csvContenido = cabeceras.join(',') + '\n';

    equiposGlobal.forEach(eq => {
      const fila = cabeceras.map(cabecera => {
        let val = eq[cabecera] !== null && eq[cabecera] !== undefined ? String(eq[cabecera]) : '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContenido += fila.join(',') + '\n';
    });

    const blob = new Blob([csvContenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `equipos_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', () => {
    if (!equipoSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    
    modoEdicion = true;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Equipo GPS`;
    
    const eq = equiposGlobal.find(e => e.id === equipoSeleccionadoId);
    if (eq) {
      const inputId = document.getElementById('eqIdNum');
      if (inputId) {
        inputId.value = eq.id || '';
        inputId.disabled = true;
      }

      document.getElementById('eqSerial').value = eq.serial_imei || '';
      document.getElementById('eqModelo').value = eq.modelo || '';
      document.getElementById('eqProveedor').value = eq.proveedor || '';
      document.getElementById('eqEstatus').value = eq.estatus || 'ACTIVO';
      document.getElementById('eqPlataforma').value = eq.esta_en_plataforma || 'SI';
      document.getElementById('eqMicrofono').value = eq.microfono || 'NO';
      
      document.getElementById('eqRegistro').value = eq.fecha_registro || '';
      document.getElementById('eqEmision').value = eq.emision || '';
      document.getElementById('eqSalida').value = eq.salida || '';
      document.getElementById('eqInstalacion').value = eq.instalacion || '';
      
      document.getElementById('eqTecnico').value = eq.tecnico || '';
      document.getElementById('eqResponsable').value = eq.responsable || '';
      
      const vehiculoAsociado = vehiculosList.find(v => v.id == eq.vehiculo_id || v.matricula === eq.vehiculo_id);
      document.getElementById('eqVehiculoSelect').value = vehiculoAsociado ? vehiculoAsociado.matricula : '';
      
      if (eq.telefono) {
        const lineaRelacionada = lineasList.find(l => l.telefono === eq.telefono);
        document.getElementById('eqLineaSelect').value = lineaRelacionada 
          ? `${lineaRelacionada.telefono} (${lineaRelacionada.serial})` 
          : eq.telefono;
      } else {
        document.getElementById('eqLineaSelect').value = '';
      }
      
      document.getElementById('eqNota').value = eq.nota || '';
    }
    modalEquipo.classList.remove('hidden');
  });

  document.getElementById('btnEliminarEquipo')?.addEventListener('click', () => {
    if (!equipoSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    const eq = equiposGlobal.find(e => e.id === equipoSeleccionadoId);
    document.getElementById('textoEliminarModal').textContent = `¿Seguro que deseas eliminar el equipo ID: ${eq.id} (Serial: ${eq.serial_imei})?`;
    modalEliminar.classList.remove('hidden');
  });

  document.getElementById('btnCancelarEliminar')?.addEventListener('click', () => modalEliminar.classList.add('hidden'));
  
  document.getElementById('btnConfirmarEliminar')?.addEventListener('click', async () => {
    const eq = equiposGlobal.find(e => e.id === equipoSeleccionadoId);
    if (eq && eq.vehiculo_id) {
      await supabase.from('vehiculos').update({ serial_equipo: '' }).eq('id', eq.vehiculo_id);
    }

    const { error } = await supabase.from('equipos').delete().eq('id', equipoSeleccionadoId);
    if (error) {
      mostrarAlertaModal('Error al eliminar: ' + error.message);
    } else {
      modalEliminar.classList.add('hidden');
      equipoSeleccionadoId = null;
      cargarEquipos();
    }
  });

  const btnImportarCsv = document.getElementById('btnImportarCsv');
  const inputCsvFile = document.getElementById('inputCsvFile');

  btnImportarCsv?.addEventListener('click', () => inputCsvFile.click());

  inputCsvFile?.addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const textoOriginalBtn = btnImportarCsv.innerHTML;
    btnImportarCsv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Importando...`;
    btnImportarCsv.disabled = true;

    const lector = new FileReader();
    lector.onload = async function (evento) {
      try {
        const texto = evento.target.result;
        const lineas = texto.split(/\r\n|\n/).filter(l => l.trim() !== '');

        if (lineas.length < 2) {
          mostrarAlertaModal('El archivo CSV está vacío o no tiene formato válido.');
          return;
        }

        const primeraLinea = lineas[0];
        const separador = primeraLinea.includes(';') ? ';' : ',';
        const cabeceras = primeraLinea.split(separador).map(c => c.trim().toLowerCase());
        
        let registrosExitosos = 0;
        let registrosFallidos = 0;

        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(separador).map(v => v.trim().replace(/^["']|["']$/g, ''));
          let registroObj = {};
          cabeceras.forEach((cabecera, index) => {
            registroObj[cabecera] = valores[index] || null;
          });

          const idVal = parseInt(registroObj.id || registroObj['id del equipo']) || null;
          const serialVal = registroObj.serial || registroObj.serial_imei || registroObj.imei;

          if (!idVal || !serialVal) {
            registrosFallidos++;
            continue;
          }

          let vehiculoIdFinal = null;
          const matVehiculo = registroObj.vehiculo || registroObj.vehiculo_id;
          if (matVehiculo) {
            const vObj = vehiculosList.find(v => v.matricula.toLowerCase() === matVehiculo.toLowerCase());
            if (vObj) vehiculoIdFinal = vObj.id;
          }

          const datosInsertar = {
            id: idVal,
            serial_imei: serialVal,
            modelo: registroObj.modelo || '',
            proveedor: registroObj.proveedor || '',
            estatus: registroObj.estatus || 'ACTIVO',
            esta_en_plataforma: registroObj.plataforma || registroObj.esta_en_plataforma || 'SI',
            microfono: registroObj.microfono || 'NO',
            fecha_registro: registroObj.registro || registroObj.fecha_registro || null,
            emision: registroObj.emision || null,
            salida: registroObj.salida || null,
            instalacion: registroObj.instalacion || null,
            tecnico: registroObj.tecnico || '',
            responsable: registroObj.responsable || '',
            vehiculo_id: vehiculoIdFinal,
            telefono: registroObj.telefono || null,
            nota: registroObj.nota || ''
          };

          const { error } = await supabase.from('equipos').upsert([datosInsertar], { onConflict: 'id' });
          if (error) {
            registrosFallidos++;
          } else {
            registrosExitosos++;
          }
        }

        inputCsvFile.value = '';
        await cargarEquipos();
        mostrarAlertaModal(`Importación finalizada. Éxitosos: ${registrosExitosos}, Fallidos: ${registrosFallidos}`);
      } catch (err) {
        mostrarAlertaModal('Error al procesar el archivo CSV: ' + err.message);
      } finally {
        btnImportarCsv.innerHTML = textoOriginalBtn;
        btnImportarCsv.disabled = false;
      }
    };
    lector.readAsText(archivo);
  });

  document.getElementById('btnCerrarModalEquipo')?.addEventListener('click', () => modalEquipo.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalEquipo.classList.add('hidden'));
  document.getElementById('btnCerrarAlerta')?.addEventListener('click', () => modalAlerta.classList.add('hidden'));

  document.getElementById('formEquipo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErroresEnLinea();

    const idInputVal = parseInt(document.getElementById('eqIdNum').value);
    const serialVal = document.getElementById('eqSerial').value.trim();

    if (!modoEdicion) {
      const existeId = equiposGlobal.some(eq => eq.id === idInputVal);
      const existeSerial = equiposGlobal.some(eq => eq.serial_imei?.toLowerCase() === serialVal.toLowerCase());

      let hayError = false;
      if (existeId) {
        mostrarErrorSpan('errorId', 'Este ID ya se encuentra registrado.');
        hayError = true;
      }
      if (existeSerial) {
        mostrarErrorSpan('errorSerial', 'Este Serial / IMEI ya está registrado.');
        hayError = true;
      }
      if (hayError) return;
    }

    const lineaInputTexto = document.getElementById('eqLineaSelect').value.trim();
    const telefonoLimpio = lineaInputTexto.split(' ')[0] || null;

    const vehiculoInputTexto = document.getElementById('eqVehiculoSelect').value.trim();
    const vehiculoObj = vehiculosList.find(v => v.matricula.toLowerCase() === vehiculoInputTexto.toLowerCase());
    const vehiculoIdLimpio = vehiculoObj ? vehiculoObj.id : null;

    const datosForm = {
      id: idInputVal,
      serial_imei: serialVal,
      modelo: document.getElementById('eqModelo').value.trim(),
      proveedor: document.getElementById('eqProveedor').value.trim().toUpperCase(),
      estatus: document.getElementById('eqEstatus').value,
      esta_en_plataforma: document.getElementById('eqPlataforma').value,
      microfono: document.getElementById('eqMicrofono').value,
      fecha_registro: document.getElementById('eqRegistro').value || null,
      emision: document.getElementById('eqEmision').value || null,
      salida: document.getElementById('eqSalida').value || null,
      instalacion: document.getElementById('eqInstalacion').value || null,
      tecnico: document.getElementById('eqTecnico').value.trim().toUpperCase(),
      responsable: document.getElementById('eqResponsable').value.trim(),
      vehiculo_id: vehiculoIdLimpio,
      telefono: telefonoLimpio,
      nota: document.getElementById('eqNota').value.trim()
    };

    try {
      let res;
      if (modoEdicion) {
        res = await supabase.from('equipos').update(datosForm).eq('id', equipoSeleccionadoId);
      } else {
        res = await supabase.from('equipos').insert([datosForm]);
      }

      const { error } = res;
      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('id')) mostrarErrorSpan('errorId', 'El ID ya existe en la base de datos.');
          if (error.message.includes('serial')) mostrarErrorSpan('errorSerial', 'El Serial ya existe en la base de datos.');
        } else {
          mostrarAlertaModal('Error BD: ' + error.message);
        }
        return;
      }

      if (vehiculoObj) {
        await supabase.from('vehiculos').update({ serial_equipo: serialVal, equipo_id: idInputVal, tecnico: datosForm.tecnico }).eq('id', vehiculoObj.id);
      }

      modalEquipo.classList.add('hidden');
      cargarEquipos();
    } catch (err) {
      mostrarAlertaModal('Error inesperado: ' + err.message);
    }
  });
});

function mostrarErrorSpan(spanId, mensaje) {
  const span = document.getElementById(spanId);
  if (span) {
    span.textContent = mensaje;
    span.classList.remove('hidden');
  }
}

function limpiarErroresEnLinea() {
  ['errorId', 'errorSerial'].forEach(id => {
    const span = document.getElementById(id);
    if (span) {
      span.textContent = '';
      span.classList.add('hidden');
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
      div.className = 'p-2.5 text-slate-300 hover:bg-blue-600/30 hover:text-white cursor-pointer transition-colors';
      div.textContent = item;
      div.addEventListener('click', () => {
        input.value = item;
        contenedor.classList.add('hidden');
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

function mostrarAlertaModal(texto) {
  document.getElementById('textoAlertaModal').textContent = texto;
  document.getElementById('modalAlerta').classList.remove('hidden');
}

async function cargarListasDesplegables() {
  const { data: vehiculos } = await supabase.from('vehiculos').select('id, matricula');
  const { data: lineas } = await supabase.from('lineas').select('telefono, serial');
  const { data: empleados } = await supabase.from('empleados').select('id, nombre, nota');
  const { data: proveedores } = await supabase.from('proveedores').select('id, nombre');
  
  if (vehiculos) vehiculosList = vehiculos;
  if (lineas) lineasList = lineas;
  if (empleados) empleadosList = empleados; 
  if (proveedores) proveedoresList = proveedores;
}

async function cargarEquipos() {
  const tbody = document.getElementById('tablaEquiposBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando equipos...</td></tr>`;

  const { data, error } = await supabase
    .from('equipos')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-rose-400 font-bold">Error de BD: ${error.message}</td></tr>`;
    return;
  }

  equiposGlobal = data || [];
  renderizarTabla(equiposGlobal);
}

function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaEquiposBody');
  tbody.innerHTML = '';
  
  let activos = 0;
  let inactivos = 0;

  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;
  document.getElementById('txtTotalEq').textContent = lista.length;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-slate-500">No se encontraron registros.</td></tr>`;
    return;
  }

  lista.forEach((eq) => {
    if (eq.estatus === 'ACTIVO' || String(eq.estatus).includes('ACTIVO')) activos++;
    if (eq.estatus === 'INACTIVO' || String(eq.estatus).includes('INACTIVO')) inactivos++;

    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    row.addEventListener('click', () => {
      document.querySelectorAll('#tablaEquiposBody tr').forEach(tr => tr.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      row.classList.add('bg-blue-600/20', 'border-blue-500/40');
      equipoSeleccionadoId = eq.id;
    });

    const estatusColor = String(eq.estatus).includes('ACTIVO') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    const plataformaColor = eq.esta_en_plataforma === 'SI' ? 'text-emerald-400' : 'text-slate-500';

    // Si vehiculo_id ya trae la placa en texto o si la encontramos en la lista, la mostramos directo
    let vehiculoRenderizado = eq.vehiculo_id || '';
    const vRef = vehiculosList.find(v => v.id == eq.vehiculo_id);
    if (vRef) vehiculoRenderizado = vRef.matricula;

    const esPendienteImei = eq.serial_imei && eq.serial_imei.startsWith('PENDIENTE-');

    row.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400 font-bold">${eq.id || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-blue-300">
        ${esPendienteImei 
          ? `<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold inline-flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> ${eq.serial_imei}</span>` 
          : (eq.serial_imei || '')}
      </td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${eq.telefono || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-amber-300">${vehiculoRenderizado}</td>
      <td class="p-3.5 border-r border-slate-800/50">${eq.modelo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${eq.tecnico || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${eq.responsable || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${eq.fecha_registro || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${eq.emision || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${eq.salida || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${eq.instalacion || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50">${eq.microfono || 'NO'}</td>
      <td class="p-3.5 border-r border-slate-800/50"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${estatusColor}">${eq.estatus}</span></td>
      <td class="p-3.5 border-r border-slate-800/50">${eq.proveedor || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold ${plataformaColor}">${eq.esta_en_plataforma || 'SI'}</td>
      <td class="p-3.5 text-slate-400">${eq.nota || ''}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('txtActivosEq').textContent = activos;
  document.getElementById('txtInactivosEq').textContent = inactivos;
}

function filtrarTabla() {
  const campo = document.getElementById('filtroCampo').value === 'serial' ? 'serial_imei' : document.getElementById('filtroCampo').value;
  let estatusFiltro = document.getElementById('filtroEstatus').value;
  const texto = document.getElementById('inputBuscador').value.toLowerCase().trim();
  const soloSinImei = document.getElementById('filtroSinImei')?.checked || false;

  if(estatusFiltro.includes('ACTIVO')) estatusFiltro = 'ACTIVO';
  else if(estatusFiltro.includes('INACTIVO')) estatusFiltro = 'INACTIVO';
  else if(estatusFiltro.includes('ANULADO')) estatusFiltro = 'ANULADO';
  else estatusFiltro = 'TODOS';

  const filtrados = equiposGlobal.filter(eq => {
    if (estatusFiltro !== 'TODOS' && !String(eq.estatus).includes(estatusFiltro)) return false;
    if (soloSinImei && (!eq.serial_imei || !eq.serial_imei.startsWith('PENDIENTE-'))) return false;

    if (texto) {
      const val = String(eq[campo] || '').toLowerCase();
      return val.includes(texto);
    }
    return true;
  });

  renderizarTabla(filtrados);
}