import { supabase } from '../supabaseClient.js';

let clientesGlobal = [];
let vehiculosGlobal = [];
let facturasGlobal = [];
let clienteSeleccionadoId = null;
let modoEdicion = false;

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosIniciales();

  document.getElementById('inputBuscador')?.addEventListener('input', filtrarTabla);
  document.getElementById('filtroCampo')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroPago')?.addEventListener('change', filtrarTabla);
  document.getElementById('filtroEstatus')?.addEventListener('change', filtrarTabla);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarDatosIniciales);

  const modalCliente = document.getElementById('modalCliente');
  const modalAlerta = document.getElementById('modalAlerta');
  const modalEliminar = document.getElementById('modalEliminar');
  const modalFichaCliente = document.getElementById('modalFichaCliente');

  // Eventos para cerrar modal de ficha
  document.getElementById('btnCerrarModalFicha')?.addEventListener('click', () => modalFichaCliente.classList.add('hidden'));
  document.getElementById('btnSalirFicha')?.addEventListener('click', () => modalFichaCliente.classList.add('hidden'));

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-user-plus text-blue-500"></i> Registrar Nuevo Cliente`;
    document.getElementById('formCliente').reset();
    
    const inputId = document.getElementById('clienteIdNum');
    if (inputId) {
      inputId.value = '';
      inputId.disabled = false;
    }
    
    modalCliente.classList.remove('hidden');
  });

  document.getElementById('btnAbrirEditar')?.addEventListener('click', () => {
    if (!clienteSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    modoEdicion = true;
    limpiarErroresEnLinea();
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-500"></i> Editar Datos del Cliente`;
    
    const cliente = clientesGlobal.find(c => c.id === clienteSeleccionadoId);
    if (cliente) {
      const inputId = document.getElementById('clienteIdNum');
      if (inputId) {
        inputId.value = cliente.id || '';
        inputId.disabled = true;
      }

      document.getElementById('nombreRazon').value = cliente.nombres || '';
      document.getElementById('rifCliente').value = cliente.rif || '';
      document.getElementById('telefonoCliente').value = cliente.telefono || '';
      document.getElementById('emailCliente').value = cliente.email || '';
      document.getElementById('vendedorCliente').value = cliente.vendedor || 'GALAX';
      document.getElementById('comisionCliente').value = cliente.comision || 1.50;
      document.getElementById('notaCliente').value = cliente.nota || '';
    }
    modalCliente.classList.remove('hidden');
  });

  document.getElementById('btnEliminarCliente')?.addEventListener('click', () => {
    if (!clienteSeleccionadoId) {
      mostrarAlertaModal('Debe Seleccionar un Registro');
      return;
    }
    const cliente = clientesGlobal.find(c => c.id === clienteSeleccionadoId);
    document.getElementById('textoEliminarModal').textContent = `¿Seguro que deseas eliminar al cliente: ${cliente.nombres} (ID: ${cliente.id})?`;
    modalEliminar.classList.remove('hidden');
  });

  document.getElementById('btnCancelarEliminar')?.addEventListener('click', () => modalEliminar.classList.add('hidden'));
  
  document.getElementById('btnConfirmarEliminar')?.addEventListener('click', async () => {
    const { error } = await supabase.from('clientes').delete().eq('id', clienteSeleccionadoId);
    if (error) {
      mostrarAlertaModal('Error al eliminar: ' + error.message);
    } else {
      modalEliminar.classList.add('hidden');
      clienteSeleccionadoId = null;
      cargarDatosIniciales();
    }
  });

  document.getElementById('btnExportarExcel')?.addEventListener('click', () => {
    if (clientesGlobal.length === 0) {
      mostrarAlertaModal('No hay registros para exportar.');
      return;
    }

    const cabeceras = ['id', 'nombres', 'rif', 'telefono', 'email', 'vendedor', 'comision', 'nota', 'estatus'];
    let csvContenido = cabeceras.join(',') + '\n';

    clientesGlobal.forEach(c => {
      const fila = cabeceras.map(cabecera => {
        let val = c[cabecera] !== null && c[cabecera] !== undefined ? String(c[cabecera]) : '';
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
    link.setAttribute('download', `clientes_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
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
        const cabeceras = primeraLinea.split(separador).map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, '').replace(/[^a-z0-9_]/g, '_'));
        
        let registrosExitosos = 0;
        let registrosFallidos = 0;

        for (let i = 1; i < lineas.length; i++) {
          const valores = lineas[i].split(separador).map(v => v.trim().replace(/^["']|["']$/g, ''));
          let registroObj = {};
          cabeceras.forEach((cabecera, index) => {
            registroObj[cabecera] = valores[index] || null;
          });

          let idVal = parseInt(registroObj.id || registroObj.id_del_cliente || registroObj.cliente_id);
          if (!idVal || isNaN(idVal)) {
            idVal = clientesGlobal.length + registrosExitosos + Math.floor(Math.random() * 10000);
          }

          const nombreVal = registroObj.nombres || registroObj.nombre_razon_social || registroObj.nombre || registroObj.razon_social || registroObj.cliente || 'SIN NOMBRE';
          const rifVal = registroObj.rif || registroObj.cedula_rif || registroObj.cedula || registroObj.rif_ci || registroObj.ci || 'S/N';

          const datosInsertar = {
            id: idVal,
            nombres: nombreVal,
            rif: rifVal,
            telefono: registroObj.telefono || registroObj.telefono_principal || '',
            email: registroObj.email || registroObj.correo || '',
            vendedor: registroObj.vendedor || 'GALAX',
            comision: parseFloat(registroObj.comision) || 1.50,
            nota: registroObj.nota || registroObj.observacion || '',
            estatus: 'ACTIVO'
          };

          const { error } = await supabase.from('clientes').upsert([datosInsertar], { onConflict: 'id' });
          if (error) {
            registrosFallidos++;
          } else {
            registrosExitosos++;
          }
        }

        inputCsvFile.value = '';
        await cargarDatosIniciales();
        mostrarAlertaModal(`Importación finalizada.\nRegistros guardados / actualizados: ${registrosExitosos}\nFallidos: ${registrosFallidos}`);
      } catch (err) {
        mostrarAlertaModal('Error al procesar el archivo CSV: ' + err.message);
      } finally {
        btnImportarCsv.innerHTML = textoOriginalBtn;
        btnImportarCsv.disabled = false;
      }
    };
    lector.readAsText(archivo);
  });

  document.getElementById('btnCerrarModalCliente')?.addEventListener('click', () => modalCliente.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalCliente.classList.add('hidden'));
  document.getElementById('btnCerrarAlerta')?.addEventListener('click', () => modalAlerta.classList.add('hidden'));

  document.getElementById('formCliente')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErroresEnLinea();

    const idInput = parseInt(document.getElementById('clienteIdNum').value);
    const rifVal = document.getElementById('rifCliente').value.trim();

    if (!modoEdicion) {
      const existeId = clientesGlobal.some(c => c.id === idInput);
      const existeRif = clientesGlobal.some(c => c.rif?.toLowerCase() === rifVal.toLowerCase());

      let hayError = false;
      if (existeId) {
        mostrarErrorSpan('errorId', 'Este ID ya se encuentra registrado.');
        hayError = true;
      }
      if (existeRif) {
        mostrarErrorSpan('errorRif', 'Esta Cédula / RIF ya está registrada.');
        hayError = true;
      }
      if (hayError) return;
    }

    const datosForm = {
      id: idInput,
      nombres: document.getElementById('nombreRazon').value.trim(),
      rif: rifVal,
      telefono: document.getElementById('telefonoCliente').value.trim(),
      email: document.getElementById('emailCliente').value.trim(),
      vendedor: document.getElementById('vendedorCliente').value.trim(),
      comision: parseFloat(document.getElementById('comisionCliente').value) || 0,
      nota: document.getElementById('notaCliente').value.trim(),
      estatus: 'ACTIVO'
    };

    let res;
    if (modoEdicion) {
      res = await supabase.from('clientes').update(datosForm).eq('id', idInput);
    } else {
      res = await supabase.from('clientes').insert([datosForm]);
    }

    const { error } = res;
    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('id')) mostrarErrorSpan('errorId', 'El ID ya existe en la base de datos.');
        if (error.message.includes('rif')) mostrarErrorSpan('errorRif', 'El RIF ya existe en la base de datos.');
      } else {
        mostrarAlertaModal('Error BD: ' + error.message);
      }
      return;
    }

    modalCliente.classList.add('hidden');
    cargarDatosIniciales();
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
  ['errorId', 'errorRif'].forEach(id => {
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

async function cargarDatosIniciales() {
  const [resCli, resVeh, resFac] = await Promise.all([
    supabase.from('clientes').select('*').order('id', { ascending: true }),
    supabase.from('vehiculos').select('*'),
    supabase.from('facturas').select('*')
  ]);

  clientesGlobal = resCli.data || [];
  vehiculosGlobal = resVeh.data || [];
  facturasGlobal = resFac.data || [];
  renderizarTabla(clientesGlobal);
}

function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaClientesBody');
  const contador = document.getElementById('contadorRegistros');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (contador) contador.textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-500">No se encontraron registros.</td></tr>`;
    return;
  }

  lista.forEach((cliente) => {
    const vehiculosCliente = vehiculosGlobal.filter(v => {
      const vClienteStr = String(v.cliente || '').toLowerCase();
      const cliRif = String(cliente.rif || '').toLowerCase();
      const cliNombre = String(cliente.nombres || '').toLowerCase();
      
      return (
        (v.cliente_id && v.cliente_id == cliente.id) ||
        (v.cliente_rif && v.cliente_rif.toLowerCase() === cliRif) ||
        (cliRif && vClienteStr.includes(cliRif)) ||
        (cliNombre && vClienteStr.includes(cliNombre))
      );
    });

    const facturasCliente = facturasGlobal.filter(f => {
      const fRazon = String(f.razon_social || '').toLowerCase();
      const cliNombre = String(cliente.nombres || '').toLowerCase();
      return cliNombre && fRazon.includes(cliNombre);
    });
    
    const trPrincipal = document.createElement('tr');
    trPrincipal.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';

    trPrincipal.addEventListener('click', () => {
      document.querySelectorAll('#tablaClientesBody tr').forEach(tr => tr.classList.remove('bg-blue-600/20', 'border-blue-500/40'));
      trPrincipal.classList.add('bg-blue-600/20', 'border-blue-500/40');
      clienteSeleccionadoId = cliente.id;
    });

    const estatusColor = cliente.estatus === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

    trPrincipal.innerHTML = `
      <td class="p-3.5 font-mono text-blue-400 font-bold">${cliente.id || 'N/A'}</td>
      <td class="p-3.5 font-mono text-slate-300 text-center"><span class="bg-slate-800 px-2 py-0.5 rounded-full">${vehiculosCliente.length}</span></td>
      <td class="p-3.5 font-bold text-white flex items-center justify-between gap-3">
        <span>${cliente.nombres || ''}</span>
        <button class="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg border border-blue-500/30 text-[10px] font-semibold transition-all btn-ver-ficha flex items-center gap-1">
          <i class="fa-solid fa-eye"></i> Ver Ficha
        </button>
      </td>
      <td class="p-3.5 font-mono text-slate-300">${cliente.rif || ''}</td>
      <td class="p-3.5 font-mono text-slate-300">${cliente.telefono || ''}</td>
      <td class="p-3.5 max-w-[250px] overflow-hidden text-slate-400">${cliente.email || 'N/A'}</td>
      <td class="p-3.5 text-slate-300">${cliente.vendedor || 'GALAX'}</td>
      <td class="p-3.5 text-slate-400">${cliente.nota || '-'}</td>
      <td class="p-3.5 font-mono text-emerald-400">${cliente.comision ? Number(cliente.comision).toFixed(2) : '1.50'}</td>
      <td class="p-3.5">
        <span class="px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${estatusColor}">${cliente.estatus || 'ACTIVO'}</span>
      </td>
    `;
    tbody.appendChild(trPrincipal);

    // Evento para abrir el modal integrado de ficha
    trPrincipal.querySelector('.btn-ver-ficha').addEventListener('click', (e) => {
      e.stopPropagation();
      abrirFichaCliente(cliente, vehiculosCliente, facturasCliente);
    });
  });
}

function abrirFichaCliente(cliente, vehiculos, facturas) {
  document.getElementById('fichaTitulo').innerHTML = `<i class="fa-solid fa-id-card text-blue-500"></i> Ficha: ${cliente.nombres}`;
  document.getElementById('fichaId').textContent = cliente.id || 'N/A';
  document.getElementById('fichaRif').textContent = cliente.rif || 'S/N';
  document.getElementById('fichaTelefono').textContent = cliente.telefono || 'N/A';
  document.getElementById('fichaVendedor').textContent = cliente.vendedor || 'GALAX';

  // Cargar vehículos
  const contenedorVehiculos = document.getElementById('listaVehiculosFicha');
  document.getElementById('contadorVehiculosFicha').textContent = vehiculos.length;
  contenedorVehiculos.innerHTML = '';

  if (vehiculos.length === 0) {
    contenedorVehiculos.innerHTML = `<div class="p-3 text-slate-500 italic text-xs">No hay vehículos asociados.</div>`;
  } else {
    vehiculos.forEach(v => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-slate-900 rounded-xl flex items-center justify-between text-xs hover:border-blue-500/60 border border-slate-800 cursor-pointer transition-all group';
      div.innerHTML = `
        <div>
          <span class="font-mono text-amber-300 font-bold group-hover:underline"><i class="fa-solid fa-car mr-1"></i> ${v.matricula || 'S/N'}</span>
          <span class="text-slate-400 ml-2">Modelo: ${v.modelo || 'N/A'}</span>
        </div>
        <span class="text-blue-400 text-[10px] font-semibold"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Vehículo</span>
      `;
      div.addEventListener('click', () => {
        window.location.href = `../vehiculos/vehiculos.html?buscar=${encodeURIComponent(v.matricula)}`;
      });
      contenedorVehiculos.appendChild(div);
    });
  }

  // Cargar facturas
  const contenedorFacturas = document.getElementById('listaFacturasFicha');
  document.getElementById('contadorFacturasFicha').textContent = facturas.length;
  contenedorFacturas.innerHTML = '';

  if (facturas.length === 0) {
    contenedorFacturas.innerHTML = `<div class="p-3 text-slate-500 italic text-xs">No hay facturas registradas.</div>`;
  } else {
    facturas.forEach(f => {
      const div = document.createElement('div');
      div.className = 'p-2.5 bg-slate-900 rounded-xl flex items-center justify-between text-xs hover:border-amber-500/60 border border-slate-800 cursor-pointer transition-all group';
      div.innerHTML = `
        <div>
          <span class="font-mono text-amber-400 font-bold group-hover:underline"><i class="fa-solid fa-file-invoice mr-1"></i> Factura N°: ${f.factura_num || f.id}</span>
          <span class="text-slate-400 ml-2">Ref: $${Number(f.referencia_usd || 0).toFixed(2)}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-emerald-400 font-mono font-bold">${f.fecha_factura || f.fecha_registro || ''}</span>
          <span class="text-amber-400 text-[10px] font-semibold"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Módulo</span>
        </div>
      `;
      div.addEventListener('click', () => {
        window.location.href = `../facturacion/facturas.html`;
      });
      contenedorFacturas.appendChild(div);
    });
  }

  document.getElementById('modalFichaCliente').classList.remove('hidden');
}

function filtrarTabla() {
  const campo = document.getElementById('filtroCampo').value;
  const estatusFiltro = document.getElementById('filtroEstatus').value;
  const textoBusqueda = document.getElementById('inputBuscador').value.toLowerCase().trim();

  const filtrados = clientesGlobal.filter(cliente => {
    if (estatusFiltro !== 'TODOS' && cliente.estatus !== estatusFiltro) {
      return false;
    }
    if (textoBusqueda) {
      const valorCampo = String(cliente[campo] || '').toLowerCase();
      return valorCampo.includes(textoBusqueda);
    }
    return true;
  });

  renderizarTabla(filtrados);
}