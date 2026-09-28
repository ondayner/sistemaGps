import { supabase } from '../supabaseClient.js';

let lineasGlobal = [];
let lineaSeleccionadaId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarLineas();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroEstatus')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroPlataforma')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroSinNumero')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarLineas);

  const modalLinea = document.getElementById('modalLinea');
  const modalAlerta = document.getElementById('modalAlerta');
  const modalEliminar = document.getElementById('modalEliminar');

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-sim-card text-blue-500"></i> Registrar Nueva Línea`;
    document.getElementById('formLinea').reset();
    
    const inputId = document.getElementById('lineaIdNum');
    if (inputId) {
      inputId.value = '';
      inputId.disabled = false;
    }

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('lineaRegistro').value = hoy;
    document.getElementById('lineaEmision').value = hoy;
    document.getElementById('lineaEstatus').value = 'ACTIVO';
    document.getElementById('lineaPlataforma').value = 'SI';
    
    actualizarPanelAsociados({ eq_asociado: '', usuario: '' });
    modalLinea.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', () => {
    if (!lineaSeleccionadaId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    modoEdicion = true;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Datos de Línea`;
    
    const linea = lineasGlobal.find(l => l.id === lineaSeleccionadaId);
    if (linea) {
      const inputId = document.getElementById('lineaIdNum');
      if (inputId) {
        inputId.value = linea.id || '';
        inputId.disabled = true;
      }

      document.getElementById('lineaRegistro').value = linea.registro || '';
      document.getElementById('lineaEmision').value = linea.emision || '';
      document.getElementById('lineaEstatus').value = linea.estatus || 'ACTIVO';
      document.getElementById('lineaTelefonia').value = linea.telefonia || 'DIGITEL';
      document.getElementById('lineaSerial').value = linea.serial || '';
      document.getElementById('lineaTelefono').value = linea.telefono || '';
      document.getElementById('lineaEqAsociado').value = linea.eq_asociado || '';
      document.getElementById('lineaSalida').value = linea.salida || '';
      document.getElementById('lineaUsuario').value = linea.usuario || '';
      document.getElementById('lineaNota').value = linea.nota || '';
      document.getElementById('lineaPlataforma').value = linea.esta_en_plataforma || 'SI';

      actualizarPanelAsociados(linea);
    }
    modalLinea.classList.remove('hidden');
  });

  document.getElementById('btnEliminarLinea')?.addEventListener('click', () => {
    if (!lineaSeleccionadaId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    const linea = lineasGlobal.find(l => l.id === lineaSeleccionadaId);
    document.getElementById('textoEliminarModal').textContent = `¿Seguro que deseas eliminar la línea ID: ${linea.id} (${linea.telefono})?`;
    modalEliminar.classList.remove('hidden');
  });

  document.getElementById('btnCancelarEliminar')?.addEventListener('click', () => modalEliminar.classList.add('hidden'));

  document.getElementById('btnConfirmarEliminar')?.addEventListener('click', async () => {
    const { error } = await supabase.from('lineas').delete().eq('id', lineaSeleccionadaId);
    if (error) {
      mostrarAlertaModal('Error al eliminar: ' + error.message);
    } else {
      modalEliminar.classList.add('hidden');
      lineaSeleccionadaId = null;
      cargarLineas();
    }
  });

  document.getElementById('btnExportarExcel')?.addEventListener('click', () => {
    if (lineasGlobal.length === 0) {
      mostrarAlertaModal('No hay registros para exportar.');
      return;
    }

    const cabeceras = ['id', 'telefonia', 'telefono', 'serial', 'eq_asociado', 'registro', 'emision', 'salida', 'usuario', 'estatus', 'esta_en_plataforma', 'nota'];
    let csvContenido = cabeceras.join(',') + '\n';

    lineasGlobal.forEach(l => {
      const fila = cabeceras.map(cabecera => {
        let val = l[cabecera] !== null && l[cabecera] !== undefined ? String(l[cabecera]) : '';
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
    link.setAttribute('download', `lineas_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        const cabeceras = primeraLinea.split(separador).map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        
        let registrosExitosos = 0;
        let registrosFallidos = 0;

        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(separador).map(v => v.trim().replace(/^["']|["']$/g, ''));
          let registroObj = {};
          cabeceras.forEach((cabecera, index) => {
            registroObj[cabecera] = valores[index] || null;
          });

          let idVal = parseInt(registroObj.id || registroObj['id de linea'] || registroObj.linea_id);
          if (!idVal || isNaN(idVal)) {
            idVal = lineasGlobal.length + registrosExitosos + Math.floor(Math.random() * 10000);
          }

          const telefonoVal = registroObj.telefono || registroObj.nro || registroObj.celular;
          const serialVal = registroObj.serial || registroObj.sim || 'S/N';

          if (!telefonoVal) {
            registrosFallidos++;
            continue;
          }

          const datosInsertar = {
            id: idVal,
            registro: registroObj.registro || new Date().toISOString().split('T')[0],
            emision: registroObj.emision || null,
            estatus: registroObj.estatus || 'ACTIVO',
            telefonia: registroObj.telefonia || 'DIGITEL',
            serial: serialVal,
            telefono: telefonoVal,
            eq_asociado: registroObj.eq_asociado || registroObj.imei || '',
            salida: registroObj.salida || null,
            usuario: registroObj.usuario || '',
            nota: registroObj.nota || '',
            esta_en_plataforma: registroObj.esta_en_plataforma || registroObj.plataforma || 'SI'
          };

          const { error } = await supabase.from('lineas').upsert([datosInsertar], { onConflict: 'id' });
          if (error) {
            registrosFallidos++;
          } else {
            registrosExitosos++;
          }
        }

        inputCsvFile.value = '';
        await cargarLineas();
        mostrarAlertaModal(`Importación finalizada.\nGuardados / actualizados: ${registrosExitosos}\nFallidos: ${registrosFallidos}`);
      } catch (err) {
        mostrarAlertaModal('Error al procesar el archivo CSV: ' + err.message);
      } finally {
        btnImportarCsv.innerHTML = textoOriginalBtn;
        btnImportarCsv.disabled = false;
      }
    };
    lector.readAsText(archivo);
  });

  document.getElementById('btnQuitarEquipo')?.addEventListener('click', () => {
    document.getElementById('lineaEqAsociado').value = '';
    actualizarPanelAsociados({ eq_asociado: '', usuario: document.getElementById('lineaUsuario').value });
  });

  document.getElementById('lineaEqAsociado')?.addEventListener('input', (e) => {
    actualizarPanelAsociados({ eq_asociado: e.target.value, usuario: document.getElementById('lineaUsuario').value });
  });

  document.getElementById('btnCerrarModalLinea')?.addEventListener('click', () => modalLinea.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalLinea.classList.add('hidden'));
  document.getElementById('btnCerrarAlerta')?.addEventListener('click', () => modalAlerta.classList.add('hidden'));

  document.getElementById('formLinea')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErroresEnLinea();

    const idInputVal = parseInt(document.getElementById('lineaIdNum').value);
    const telefonoVal = document.getElementById('lineaTelefono').value.trim();
    const serialVal = document.getElementById('lineaSerial').value.trim();

    if (!modoEdicion) {
      const existeId = lineasGlobal.some(l => l.id === idInputVal);
      const existeTelefono = lineasGlobal.some(l => l.telefono?.toLowerCase() === telefonoVal.toLowerCase());
      const existeSerial = lineasGlobal.some(l => l.serial?.toLowerCase() === serialVal.toLowerCase());

      let hayError = false;
      if (existeId) {
        mostrarErrorSpan('errorId', 'Este ID ya se encuentra registrado.');
        hayError = true;
      }
      if (existeTelefono) {
        mostrarErrorSpan('errorTelefono', 'Este número de teléfono ya está registrado.');
        hayError = true;
      }
      if (existeSerial) {
        mostrarErrorSpan('errorSerial', 'Este Serial SIM ya está registrado.');
        hayError = true;
      }
      if (hayError) return;
    }

    const datosForm = {
      id: idInputVal,
      registro: document.getElementById('lineaRegistro').value,
      emision: document.getElementById('lineaEmision').value,
      estatus: document.getElementById('lineaEstatus').value,
      telefonia: document.getElementById('lineaTelefonia').value,
      serial: serialVal,
      telefono: telefonoVal,
      eq_asociado: document.getElementById('lineaEqAsociado').value.trim(),
      salida: document.getElementById('lineaSalida').value,
      usuario: document.getElementById('lineaUsuario').value.trim(),
      nota: document.getElementById('lineaNota').value.trim(),
      esta_en_plataforma: document.getElementById('lineaPlataforma').value
    };

    let res;
    if (modoEdicion) {
      res = await supabase.from('lineas').update(datosForm).eq('id', lineaSeleccionadaId);
    } else {
      res = await supabase.from('lineas').insert([datosForm]);
    }

    const { error } = res;
    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('id')) mostrarErrorSpan('errorId', 'El ID ya existe en la base de datos.');
        if (error.message.includes('telefono')) mostrarErrorSpan('errorTelefono', 'El teléfono ya existe.');
        if (error.message.includes('serial')) mostrarErrorSpan('errorSerial', 'El serial ya existe.');
      } else {
        mostrarAlertaModal('Error al guardar línea: ' + error.message);
      }
      return;
    }

    modalLinea.classList.add('hidden');
    cargarLineas();
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
  ['errorId', 'errorTelefono', 'errorSerial'].forEach(id => {
    const span = document.getElementById(id);
    if (span) {
      span.textContent = '';
      span.classList.add('hidden');
    }
  });
}

function actualizarPanelAsociados(linea) {
  const eqTxt = document.getElementById('asociadoEquipoTxt');
  const userTxt = document.getElementById('asociadoClienteTxt');

  if (eqTxt) {
    eqTxt.textContent = linea.eq_asociado ? `Equipo: ${linea.eq_asociado}` : 'Equipo: No asignado';
  }
  if (userTxt) {
    userTxt.textContent = linea.usuario ? `Usuario: ${linea.usuario}` : 'Cliente: N/A';
  }
}

function mostrarAlertaModal(texto) {
  document.getElementById('textoAlertaModal').textContent = texto;
  document.getElementById('modalAlerta').classList.remove('hidden');
}

async function cargarLineas() {
  const tbody = document.getElementById('tablaLineasBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando líneas...</td></tr>`;

  const { data, error } = await supabase.from('lineas').select('*').order('id', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-rose-400">Error al conectar con la base de datos.</td></tr>`;
    return;
  }

  lineasGlobal = data || [];
  renderizarTabla(lineasGlobal);
}

function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaLineasBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500">No se encontraron registros.</td></tr>`;
    return;
  }

  lista.forEach((linea) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    row.addEventListener('click', () => {
      document.querySelectorAll('#tablaLineasBody tr').forEach(tr => tr.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      row.classList.add('bg-blue-600/20', 'border-blue-500/40');
      lineaSeleccionadaId = linea.id;
    });

    const estatusColor = linea.estatus === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    const plataformaColor = linea.esta_en_plataforma === 'SI' ? 'text-emerald-400' : 'text-slate-500';

    const esPendienteLinea = linea.telefono && (linea.telefono.startsWith('PENDIENTE-') || linea.telefono.startsWith('LOT-'));

    row.innerHTML = `
      <td class="p-3.5 font-mono text-blue-400 font-bold">${linea.id || 'N/A'}</td>
      <td class="p-3.5 font-bold text-white">${linea.telefonia || ''}</td>
      <td class="p-3.5 font-mono text-slate-300">
        ${esPendienteLinea 
          ? `<span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold inline-flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> ${linea.telefono}</span>` 
          : (linea.telefono || '')}
      </td>
      <td class="p-3.5 font-mono text-slate-400 max-w-[180px] truncate" title="${linea.serial || ''}">${linea.serial || ''}</td>
      <td class="p-3.5 font-mono text-blue-300 max-w-[150px] truncate" title="${linea.eq_asociado || ''}">${linea.eq_asociado || 'Sin IMEI'}</td>
      <td class="p-3.5 font-mono text-slate-400">${linea.registro || ''}</td>
      <td class="p-3.5 font-mono text-slate-400">${linea.emision || ''}</td>
      <td class="p-3.5 font-mono text-slate-400">${linea.salida || ''}</td>
      <td class="p-3.5 font-mono text-slate-300">${linea.usuario || ''}</td>
      <td class="p-3.5"><span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${estatusColor}">${linea.estatus || 'ACTIVO'}</span></td>
      <td class="p-3.5 font-bold ${plataformaColor}">${linea.esta_en_plataforma || 'NO'}</td>
    `;
    tbody.appendChild(row);
  });
}

function filtrarTabla() {
  const campo = document.getElementById('filtroCampo').value;
  const estatusFiltro = document.getElementById('filtroEstatus').value;
  const plataformaFiltro = document.getElementById('filtroPlataforma').value;
  const textoBusqueda = document.getElementById('inputBuscador').value.toLowerCase().trim();
  const soloSinNumero = document.getElementById('filtroSinNumero')?.checked || false;

  const filtrados = lineasGlobal.filter(linea => {
    if (estatusFiltro !== 'TODOS' && linea.estatus !== estatusFiltro) return false;
    if (plataformaFiltro !== 'TODOS' && linea.esta_en_plataforma !== plataformaFiltro) return false;
    if (soloSinNumero && (!linea.telefono || (!linea.telefono.startsWith('PENDIENTE-') && !linea.telefono.startsWith('LOT-')))) return false;

    if (textoBusqueda) {
      const valorCampo = String(linea[campo] || '').toLowerCase();
      return valorCampo.includes(textoBusqueda);
    }
    return true;
  });

  renderizarTabla(filtrados);
}