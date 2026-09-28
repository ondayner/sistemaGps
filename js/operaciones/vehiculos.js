import { supabase } from '../supabaseClient.js';

let vehiculosGlobal = [];
let clientesList = [];
let equiposList = [];
let vendedoresList = [];
let vehiculoSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarListasRelacionadas();
  cargarVehiculos().then(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const buscarMatricula = urlParams.get('buscar');
    
    if (buscarMatricula) {
      const inputBuscador = document.getElementById('inputBuscador');
      const filtroCampo = document.getElementById('filtroCampo');
      
      if (inputBuscador && filtroCampo) {
        filtroCampo.value = 'matricula';
        inputBuscador.value = buscarMatricula;
        filtrarTabla();

        const encontrado = vehiculosGlobal.find(v => v.matricula?.toLowerCase() === buscarMatricula.toLowerCase());
        if (encontrado) {
          vehiculoSeleccionadoId = encontrado.id;
          setTimeout(() => {
            const filas = document.querySelectorAll('#tablaVehiculosBody tr');
            filas.forEach(tr => {
              if (tr.textContent.includes(buscarMatricula.toUpperCase())) {
                tr.classList.add('bg-blue-600/20', 'border-blue-500/40');
              }
            });
          }, 100);
        }
      }
    }
  });

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroEstatus')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroPago')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroPlataformaCheck')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarVehiculos);

  const modalVehiculo = document.getElementById('modalVehiculo');
  const modalAlerta = document.getElementById('modalAlerta');
  const modalEliminar = document.getElementById('modalEliminar');

  setupBuscadorClientes();
  setupBuscadorEquipos();
  
  // Buscador inteligente para Canal / Técnico con límite de 5 opciones al hacer clic o escribir
  setupBuscadorPersonalizado('vehiculoCanal', 'sugerenciasCanal', () => vendedoresList.map(v => v.nombre), 5);

  // Herencia automática: si seleccionas un equipo que ya tiene técnico asignado, se pasa al canal
  const inputEquipo = document.getElementById('vehiculoEquipoSerial');
  inputEquipo?.addEventListener('input', () => {
    const serialIngresado = inputEquipo.value.trim();
    const equipoEncontrado = equiposList.find(eq => eq.serial_imei?.toLowerCase() === serialIngresado.toLowerCase());
    if (equipoEncontrado && equipoEncontrado.tecnico) {
      const inputCanal = document.getElementById('vehiculoCanal');
      if (inputCanal) inputCanal.value = equipoEncontrado.tecnico;
      actualizarPanelEquipo(equipoEncontrado);
    }
  });

  // Abrir Modal Agregar
  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-car text-blue-500"></i> Registrar Nuevo Vehículo`;
    document.getElementById('formVehiculo').reset();
    
    const inputId = document.getElementById('vehiculoIdNum');
    if (inputId) {
      inputId.value = '';
      inputId.disabled = false;
    }

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('vehiculoVencimiento').value = hoy;
    document.getElementById('vehiculoPlazo').value = hoy;

    actualizarPanelCliente(null);
    actualizarPanelEquipo(null);
    modalVehiculo.classList.remove('hidden');
  });

  // Abrir Modal Editar
  document.getElementById('btnAbrirEditar')?.addEventListener('click', () => {
    if (!vehiculoSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    
    modoEdicion = true;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Modificar Datos del Vehículo`;
    
    const v = vehiculosGlobal.find(item => item.id === vehiculoSeleccionadoId);
    if (v) {
      const inputId = document.getElementById('vehiculoIdNum');
      if (inputId) {
        inputId.value = v.id || '';
        inputId.disabled = true;
      }

      document.getElementById('vehiculoMatricula').value = v.matricula || '';
      document.getElementById('vehiculoModelo').value = v.modelo || '';
      document.getElementById('vehiculoColor').value = v.color || '';
      document.getElementById('vehiculoMarca').value = v.marca || '';
      document.getElementById('vehiculoAnio').value = v.anio || '';
      document.getElementById('vehiculoCategoria').value = v.categoria || 'PARTICULAR';
      document.getElementById('vehiculoVencimiento').value = v.vencimiento || '';
      document.getElementById('vehiculoPlazo').value = v.plazo || '';
      document.getElementById('vehiculoEstatus').value = v.estatus || 'ACTIVO';
      document.getElementById('vehiculoCanal').value = v.canal || v.tecnico || 'GALAX';
      document.getElementById('vehiculoNota').value = v.nota || '';

      const clienteAsociado = clientesList.find(c => 
        (v.cliente_id && c.id == v.cliente_id) ||
        (v.cliente_rif && c.rif?.toLowerCase() === v.cliente_rif?.toLowerCase()) ||
        (v.cliente && (c.rif?.toLowerCase() === v.cliente.toLowerCase() || v.cliente.toLowerCase() === c.nombres?.toLowerCase()))
      );

      if (clienteAsociado) {
        document.getElementById('vehiculoClienteRif').value = clienteAsociado.nombres;
        actualizarPanelCliente(clienteAsociado);
      } else {
        // Limpiar formato S/N si lo tuviera guardado anteriormente
        let nombreLimpio = v.cliente || '';
        if (nombreLimpio.includes(' - ')) {
          nombreLimpio = nombreLimpio.split(' - ').pop().trim();
        }
        document.getElementById('vehiculoClienteRif').value = nombreLimpio;
        actualizarPanelCliente({ nombres: nombreLimpio || 'No registrado', telefono_principal: '', email: '' });
      }

      const equipoAsociado = equiposList.find(eq => 
        (v.serial_equipo && eq.serial_imei?.toLowerCase() === v.serial_equipo?.toLowerCase()) ||
        (eq.vehiculo_id && eq.vehiculo_id.toLowerCase() === v.matricula?.toLowerCase())
      );

      if (equipoAsociado) {
        document.getElementById('vehiculoEquipoSerial').value = equipoAsociado.serial_imei;
        actualizarPanelEquipo(equipoAsociado);
      } else {
        document.getElementById('vehiculoEquipoSerial').value = v.serial_equipo || '';
        actualizarPanelEquipo({ tecnico: v.canal || 'N/A', modelo: 'N/A', telefono: 'N/A' });
      }
    }
    modalVehiculo.classList.remove('hidden');
  });

  // Botón Eliminar
  document.getElementById('btnEliminarVehiculo')?.addEventListener('click', () => {
    if (!vehiculoSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    const v = vehiculosGlobal.find(item => item.id === vehiculoSeleccionadoId);
    document.getElementById('textoEliminarModal').textContent = `¿Seguro que deseas eliminar el vehículo ID: ${v.id} (Matrícula: ${v.matricula})?`;
    modalEliminar.classList.remove('hidden');
  });

  document.getElementById('btnCancelarEliminar')?.addEventListener('click', () => modalEliminar.classList.add('hidden'));

  document.getElementById('btnConfirmarEliminar')?.addEventListener('click', async () => {
    const v = vehiculosGlobal.find(item => item.id === vehiculoSeleccionadoId);
    if (v && v.matricula) {
      await supabase.from('equipos').update({ vehiculo_id: null }).eq('vehiculo_id', v.matricula);
    }
    
    const { error } = await supabase.from('vehiculos').delete().eq('id', vehiculoSeleccionadoId);
    if (error) {
      mostrarAlertaModal('Error al eliminar: ' + error.message);
    } else {
      modalEliminar.classList.add('hidden');
      vehiculoSeleccionadoId = null;
      cargarVehiculos();
    }
  });

  // Exportar y otros eventos de botones
  document.getElementById('btnExportarCsv')?.addEventListener('click', () => {
    if (vehiculosGlobal.length === 0) {
      mostrarAlertaModal('No hay registros para exportar.');
      return;
    }

    const cabeceras = ['id', 'estatus', 'vencimiento', 'plazo', 'cliente', 'matricula', 'modelo', 'marca', 'canal', 'serial_equipo', 'color', 'categoria', 'nota', 'esta_en_plataforma', 'meses_vencidos', 'monto_vencido'];
    let csvContenido = cabeceras.join(',') + '\n';

    vehiculosGlobal.forEach(v => {
      const fila = cabeceras.map(cabecera => {
        let val = v[cabecera] !== null && v[cabecera] !== undefined ? String(v[cabecera]) : '';
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
    link.setAttribute('download', `vehiculos_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
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

          let idVal = parseInt(registroObj.id || registroObj['id del vehiculo'] || registroObj.vehiculo_id);
          if (!idVal || isNaN(idVal)) {
            idVal = vehiculosGlobal.length + registrosExitosos + Math.floor(Math.random() * 10000);
          }

          const matriculaVal = registroObj.matricula || registroObj.placa;
          if (!matriculaVal) {
            registrosFallidos++;
            continue;
          }

          let clienteLimpio = registroObj.cliente || '';
          if (clienteLimpio.includes(' - ')) {
            clienteLimpio = clienteLimpio.split(' - ').pop().trim();
          }

          const datosInsertar = {
            id: idVal,
            matricula: matriculaVal.toUpperCase(),
            modelo: registroObj.modelo || '',
            marca: registroObj.marca || '',
            color: registroObj.color || '',
            anio: registroObj.anio || '',
            categoria: registroObj.categoria || 'PARTICULAR',
            estatus: registroObj.estatus || 'ACTIVO',
            vencimiento: registroObj.vencimiento || null,
            plazo: registroObj.plazo || null,
            canal: registroObj.canal || 'GALAX',
            cliente: clienteLimpio,
            serial_equipo: registroObj.serial_equipo || registroObj.imei || '',
            nota: registroObj.nota || '',
            esta_en_plataforma: registroObj.esta_en_plataforma || 'SI',
            meses_vencidos: parseInt(registroObj.meses_vencidos) || 0,
            monto_vencido: parseFloat(registroObj.monto_vencido) || 0
          };

          const { error } = await supabase.from('vehiculos').upsert([datosInsertar], { onConflict: 'id' });
          if (error) {
            registrosFallidos++;
          } else {
            registrosExitosos++;
          }
        }

        inputCsvFile.value = '';
        await cargarVehiculos();
        mostrarAlertaModal(`Importación finalizada.\nGuardados/Actualizados: ${registrosExitosos}\nFallidos: ${registrosFallidos}`);
      } catch (err) {
        mostrarAlertaModal('Error al procesar el archivo CSV: ' + err.message);
      } finally {
        btnImportarCsv.innerHTML = textoOriginalBtn;
        btnImportarCsv.disabled = false;
      }
    };
    lector.readAsText(archivo);
  });

  document.getElementById('btnCerrarModalVehiculo')?.addEventListener('click', () => modalVehiculo.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalVehiculo.classList.add('hidden'));
  document.getElementById('btnCerrarAlerta')?.addEventListener('click', () => modalAlerta.classList.add('hidden'));

  // Submit del Formulario con Limpieza de S/N
  document.getElementById('formVehiculo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErroresEnLinea();

    const idInputVal = parseInt(document.getElementById('vehiculoIdNum').value);
    const matriculaVal = document.getElementById('vehiculoMatricula').value.trim().toUpperCase();

    if (!modoEdicion) {
      const existeId = vehiculosGlobal.some(v => v.id === idInputVal);
      const existeMatricula = vehiculosGlobal.some(v => v.matricula?.toLowerCase() === matriculaVal.toLowerCase());

      let hayError = false;
      if (existeId) {
        mostrarErrorSpan('errorId', 'Este ID ya se encuentra registrado.');
        hayError = true;
      }
      if (existeMatricula) {
        mostrarErrorSpan('errorMatricula', 'Esta Matrícula ya está registrada.');
        hayError = true;
      }
      if (hayError) return;
    }

    let clienteTexto = document.getElementById('vehiculoClienteRif').value.trim();
    if (clienteTexto.includes(' - ')) {
      clienteTexto = clienteTexto.split(' - ').pop().trim();
    }

    const equipoTexto = document.getElementById('vehiculoEquipoSerial').value.trim();
    const canalVal = document.getElementById('vehiculoCanal').value.trim().toUpperCase();

    const datosForm = {
      id: idInputVal,
      matricula: matriculaVal,
      modelo: document.getElementById('vehiculoModelo').value.trim().toUpperCase(),
      marca: document.getElementById('vehiculoMarca').value.trim().toUpperCase(),
      color: document.getElementById('vehiculoColor').value.trim().toUpperCase(),
      anio: document.getElementById('vehiculoAnio').value.trim(),
      categoria: document.getElementById('vehiculoCategoria').value,
      vencimiento: document.getElementById('vehiculoVencimiento').value || null,
      plazo: document.getElementById('vehiculoPlazo').value || null,
      estatus: document.getElementById('vehiculoEstatus').value,
      canal: canalVal,
      cliente: clienteTexto,
      serial_equipo: equipoTexto,
      nota: document.getElementById('vehiculoNota').value.trim()
    };

    let res;
    if (modoEdicion) {
      res = await supabase.from('vehiculos').update(datosForm).eq('id', idInputVal);
    } else {
      res = await supabase.from('vehiculos').insert([datosForm]);
    }

    const { error } = res;
    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('id')) mostrarErrorSpan('errorId', 'El ID ya existe en la base de datos.');
        if (error.message.includes('matricula')) mostrarErrorSpan('errorMatricula', 'La matrícula ya está registrada.');
      } else {
        mostrarAlertaModal('Error al guardar vehículo: ' + error.message);
      }
      return;
    }

    // Sincronización bidireccional con equipos (actualizando técnico y vínculo)
    await supabase.from('equipos').update({ vehiculo_id: null }).eq('vehiculo_id', matriculaVal);

    if (equipoTexto) {
      await supabase.from('equipos').update({ vehiculo_id: matriculaVal, tecnico: canalVal }).eq('serial_imei', equipoTexto);
    }

    modalVehiculo.classList.add('hidden');
    cargarVehiculos();
  });
});

function setupBuscadorClientes() {
  const input = document.getElementById('vehiculoClienteRif');
  const contenedor = document.getElementById('sugerenciasCliente');
  if (!input || !contenedor) return;

  input.addEventListener('input', () => {
    const texto = input.value.toLowerCase().trim();
    const filtrados = clientesList.filter(c => c.rif?.toLowerCase().includes(texto) || c.nombres?.toLowerCase().includes(texto)).slice(0, 10);

    if (filtrados.length === 0 || !texto) {
      contenedor.classList.add('hidden');
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(c => {
      const div = document.createElement('div');
      div.className = 'p-2.5 text-slate-300 hover:bg-blue-600/30 hover:text-white cursor-pointer transition-colors';
      div.textContent = c.nombres;
      div.addEventListener('click', () => {
        input.value = c.nombres;
        actualizarPanelCliente(c);
        contenedor.classList.add('hidden');
      });
      contenedor.appendChild(div);
    });
    contenedor.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !contenedor.contains(e.target)) {
      contenedor.classList.add('hidden');
    }
  });
}

function setupBuscadorEquipos() {
  const input = document.getElementById('vehiculoEquipoSerial');
  const contenedor = document.getElementById('sugerenciasEquipo');
  if (!input || !contenedor) return;

  input.addEventListener('input', () => {
    const texto = input.value.toLowerCase().trim();
    const filtrados = equiposList.filter(eq => eq.serial_imei?.toLowerCase().includes(texto)).slice(0, 10);

    if (filtrados.length === 0 || !texto) {
      contenedor.classList.add('hidden');
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(eq => {
      const div = document.createElement('div');
      div.className = 'p-2.5 text-slate-300 hover:bg-blue-600/30 hover:text-white cursor-pointer transition-colors font-mono';
      div.textContent = eq.serial_imei;
      div.addEventListener('click', () => {
        input.value = eq.serial_imei;
        actualizarPanelEquipo(eq);
        const inputCanal = document.getElementById('vehiculoCanal');
        if (inputCanal && eq.tecnico) inputCanal.value = eq.tecnico;
        contenedor.classList.add('hidden');
      });
      contenedor.appendChild(div);
    });
    contenedor.classList.remove('hidden');
  });

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

function actualizarPanelCliente(c) {
  document.getElementById('lblClienteNombre').textContent = c ? c.nombres || '-' : '-';
  document.getElementById('lblClienteTelefono').textContent = c ? c.telefono_principal || c.telefono || '-' : '-';
  document.getElementById('lblClienteEmail').textContent = c ? c.email || '-' : '-';
}

function actualizarPanelEquipo(eq) {
  document.getElementById('lblEqTecnico').textContent = eq ? eq.tecnico || '-' : '-';
  document.getElementById('lblEqModelo').textContent = eq ? eq.modelo || '-' : '-';
  document.getElementById('lblEqLinea').textContent = eq ? eq.telefono || '-' : '-';
}

function mostrarErrorSpan(spanId, mensaje) {
  const span = document.getElementById(spanId);
  if (span) {
    span.textContent = mensaje;
    span.classList.remove('hidden');
  }
}

function limpiarErroresEnLinea() {
  ['errorId', 'errorMatricula'].forEach(id => {
    const span = document.getElementById(id);
    if (span) {
      span.textContent = '';
      span.classList.add('hidden');
    }
  });
}

function mostrarAlertaModal(texto) {
  document.getElementById('textoAlertaModal').textContent = texto;
  document.getElementById('modalAlerta').classList.remove('hidden');
}

async function cargarListasRelacionadas() {
  const { data: clientes } = await supabase.from('clientes').select('*');
  const { data: equipos } = await supabase.from('equipos').select('*');
  const { data: vendedores } = await supabase.from('vendedores').select('*');
  
  if (clientes) clientesList = clientes;
  if (equipos) equiposList = equipos;
  if (vendedores) vendedoresList = vendedores;
}

async function cargarVehiculos() {
  const tbody = document.getElementById('tablaVehiculosBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando vehículos...</td></tr>`;

  const { data, error } = await supabase.from('vehiculos').select('*').order('id', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-rose-400">Error al conectar con la base de datos.</td></tr>`;
    return;
  }

  vehiculosGlobal = data || [];
  renderizarTabla(vehiculosGlobal);
}

function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaVehiculosBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;
  document.getElementById('txtTotalVehiculos').textContent = lista.length;

  let vencidosHoyCount = 0;
  const hoyStr = new Date().toISOString().split('T')[0];

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" class="text-center py-6 text-slate-500">No se encontraron registros.</td></tr>`;
    document.getElementById('txtVencidosHoy').textContent = 0;
    return;
  }

  lista.forEach((v) => {
    if (v.vencimiento === hoyStr) vencidosHoyCount++;

    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    row.addEventListener('click', () => {
      document.querySelectorAll('#tablaVehiculosBody tr').forEach(tr => tr.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      row.classList.add('bg-blue-600/20', 'border-blue-500/40');
      vehiculoSeleccionadoId = v.id;
    });

    const estatusColor = v.estatus === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    const plataformaColor = v.esta_en_plataforma === 'SI' ? 'text-emerald-400' : 'text-slate-500';

    row.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400 font-bold">${v.id || 'N/A'}</td>
      <td class="p-3.5 border-r border-slate-800/50"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${estatusColor}">${v.estatus || 'ACTIVO'}</span></td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${v.vencimiento || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${v.plazo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${v.cliente || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300 font-bold">${v.matricula || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50">${v.modelo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50">${v.marca || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${v.canal || v.tecnico || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-300">${v.serial_equipo || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50">${v.color || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${v.categoria || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-400">${v.nota || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold ${plataformaColor}">${v.esta_en_plataforma || 'SI'}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-center text-slate-300">${v.meses_vencidos || 0}</td>
      <td class="p-3.5 font-mono text-emerald-400">${v.monto_vencido ? Number(v.monto_vencido).toFixed(2) : '0.00'}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById('txtVencidosHoy').textContent = vencidosHoyCount;
}

function filtrarTabla() {
  const campo = document.getElementById('filtroCampo').value.toLowerCase();
  let estatusFiltro = document.getElementById('filtroEstatus').value;
  const pagoFiltro = document.getElementById('filtroPago').value;
  const soloNoPlataforma = document.getElementById('filtroPlataformaCheck').checked;
  const textoBusqueda = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = vehiculosGlobal.filter(v => {
    if (estatusFiltro !== 'TODOS' && v.estatus !== estatusFiltro) return false;
    if (soloNoPlataforma && v.esta_en_plataforma === 'SI') return false;
    if (textoBusqueda) {
      const valorCampo = String(v[campo] || '').toLowerCase();
      return valorCampo.includes(textoBusqueda);
    }
    return true;
  });

  renderizarTabla(filtrados);
}