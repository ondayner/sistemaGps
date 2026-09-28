import { supabase } from '../supabaseClient.js';
import CONFIG from '../config/config.js'; // Datos institucionales fijos

let facturasGlobal = [];
let clientesList = [];
let serviciosList = [];
let metodosPagoList = []; // Lista de métodos de pago desde Supabase
let serviciosSeleccionados = []; // Carrito de múltiples servicios
let clienteSeleccionadoObj = null;
let TASA_CAMBIO_ACTUAL = 0.00; // Tasa del día seleccionada o actual
let callbackConfirmacion = null; // Callback para la confirmación de alertas personalizadas

const STORAGE_TASAS_KEY = 'galax_tasas_cambio';

document.addEventListener('DOMContentLoaded', () => {
  inicializarDatosSistema();

  document.getElementById('filtroTipoTransaccion')?.addEventListener('change', filtrarDatos);
  document.getElementById('inputBuscadorTexto')?.addEventListener('input', filtrarDatos);
  document.getElementById('filtroTipoFecha')?.addEventListener('change', filtrarDatos);
  document.getElementById('filtroDesde')?.addEventListener('change', filtrarDatos);
  document.getElementById('filtroHasta')?.addEventListener('change', filtrarDatos);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', inicializarDatosSistema);

  setupBuscadorClientes();

  const modal = document.getElementById('modalFactura');
  const modalServicios = document.getElementById('modalServicios');
  const modalNuevoServicio = document.getElementById('modalNuevoServicio');
  const modalGestionMetodos = document.getElementById('modalGestionMetodos');
  const modalAlerta = document.getElementById('modalAlerta');

  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    document.getElementById('formFactura').reset();
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('facFecha').value = hoy;
    document.getElementById('facEstatus').value = 'ACTIVO';
    document.getElementById('facTipoFactura').value = 'VENTA';
    
    clienteSeleccionadoObj = null;
    serviciosSeleccionados = [];
    limpiarInfoCliente();
    renderizarDetalleServicioVacio();
    
    actualizarTasaSegunFecha(hoy);
    modal.classList.remove('hidden');
  });

  // Botón para abrir el gestor de métodos de pago
  document.getElementById('btnGestionarMetodos')?.addEventListener('click', () => {
    limpiarFormularioMetodo();
    renderizarTablaGestionMetodos();
    modalGestionMetodos.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModalGestion')?.addEventListener('click', () => modalGestionMetodos.classList.add('hidden'));
  document.getElementById('btnSalirGestionMetodos')?.addEventListener('click', () => modalGestionMetodos.classList.add('hidden'));

  // Manejador del formulario de creación/edición de métodos de pago
  document.getElementById('formMetodoPago')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEditando = document.getElementById('metodoIdEditando').value;
    const nombre = document.getElementById('inputNombreMetodo').value.trim().toUpperCase();
    const observacion = document.getElementById('inputObservacionMetodo').value.trim();

    if (!nombre) return;

    let res;
    if (idEditando) {
      res = await supabase.from('metodos_pago').update({ nombre, observacion }).eq('id', idEditando);
    } else {
      res = await supabase.from('metodos_pago').insert([{ nombre, observacion }]);
    }

    if (res.error) {
      mostrarAlerta('Error al guardar método de pago: ' + res.error.message);
    } else {
      limpiarFormularioMetodo();
      await cargarMetodosPagoSupabase();
      renderizarTablaGestionMetodos();
    }
  });

  document.getElementById('btnCancelarEdicionMetodo')?.addEventListener('click', limpiarFormularioMetodo);

  // Si el usuario cambia la fecha en el formulario de factura, actualizamos la tasa automáticamente
  document.getElementById('facFecha')?.addEventListener('change', (e) => {
    const fechaSeleccionada = e.target.value;
    if (fechaSeleccionada) {
      actualizarTasaSegunFecha(fechaSeleccionada);
      if (serviciosSeleccionados.length > 0) {
        renderizarServiciosSeleccionados();
      }
    }
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modal.classList.add('hidden'));
  
  // Botón principal de la alerta personalizada (Aceptar / Sí, eliminar)
  document.getElementById('btnCerrarAlerta')?.addEventListener('click', () => {
    modalAlerta.classList.add('hidden');
    if (callbackConfirmacion) {
      callbackConfirmacion();
      callbackConfirmacion = null;
    }
  });

  // Botón para deseleccionar cliente
  document.getElementById('btnLimpiarCliente')?.addEventListener('click', () => {
    document.getElementById('facRazonSocial').value = '';
    clienteSeleccionadoObj = null;
    serviciosSeleccionados = [];
    limpiarInfoCliente();
    renderizarDetalleServicioVacio();
  });

  // Validación estricta: Elegir servicio solo si hay cliente seleccionado
  document.getElementById('btnElegirServicio')?.addEventListener('click', () => {
    const inputRazon = document.getElementById('facRazonSocial').value.trim();
    if (!clienteSeleccionadoObj && !inputRazon) {
      mostrarAlerta('Debe seleccionar obligatoriamente un cliente antes de elegir un servicio.');
      return;
    }
    renderizarTablaServiciosModal(serviciosList);
    modalServicios.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModalServicios')?.addEventListener('click', () => modalServicios.classList.add('hidden'));
  document.getElementById('btnSalirServicios')?.addEventListener('click', () => modalServicios.classList.add('hidden'));

  // Abrir modal visual para nuevo servicio
  document.getElementById('btnNuevoServicioPrompt')?.addEventListener('click', () => {
    document.getElementById('formNuevoServicio').reset();
    const lblTasa = document.getElementById('tasaSistemaTxt');
    if (lblTasa) lblTasa.textContent = `${TASA_CAMBIO_ACTUAL.toFixed(2)} BS/$`;
    modalNuevoServicio.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModalNuevoServicio')?.addEventListener('click', () => modalNuevoServicio.classList.add('hidden'));
  document.getElementById('btnCancelarNuevoServicio')?.addEventListener('click', () => modalNuevoServicio.classList.add('hidden'));

  document.getElementById('nuevoServicioUsd')?.addEventListener('input', (e) => {
    const usd = parseFloat(e.target.value) || 0;
    const bs = usd * TASA_CAMBIO_ACTUAL;
    document.getElementById('equivalenteBsTxt').textContent = `${bs.toFixed(2)} BS`;
  });

  document.getElementById('formNuevoServicio')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nuevoServicioNombre').value.trim().toUpperCase();
    const montoUsd = parseFloat(document.getElementById('nuevoServicioUsd').value) || 0;
    const meses = parseInt(document.getElementById('nuevoServicioMeses').value) || 1;
    const nota = document.getElementById('nuevoServicioNota').value.trim();
    const montoBs = montoUsd * TASA_CAMBIO_ACTUAL;

    const { data, error } = await supabase.from('servicios').insert([{
      nombre,
      monto_usd: montoUsd,
      monto_bs: montoBs,
      meses,
      nota,
      estatus: 'ACTIVO'
    }]).select().single();

    if (error) {
      mostrarAlerta('Error al crear servicio: ' + error.message);
    } else {
      serviciosList.push(data);
      renderizarTablaServiciosModal(serviciosList);
      modalNuevoServicio.classList.add('hidden');
    }
  });

  document.getElementById('buscadorServicioModal')?.addEventListener('input', (e) => {
    const txt = e.target.value.toLowerCase();
    const filtrados = serviciosList.filter(s => (s.nombre || '').toLowerCase().includes(txt));
    renderizarTablaServiciosModal(filtrados);
  });

  // Botón Exportar a Excel (CSV) en Facturas
  document.getElementById('btnExportarCsv')?.addEventListener('click', () => {
    if (facturasGlobal.length === 0) {
      mostrarAlerta('No hay registros de facturas para exportar.');
      return;
    }

    const cabeceras = ['id', 'fecha_registro', 'fecha_factura', 'razon_social', 'transaccion', 'tasa_cambio', 'total_iva', 'base_imponible', 'referencia_usd', 'factura_num', 'estatus', 'usuario'];
    let csvContenido = cabeceras.join(',') + '\n';

    facturasGlobal.forEach(fac => {
      const fila = cabeceras.map(cabecera => {
        let val = fac[cabecera] !== null && fac[cabecera] !== undefined ? String(fac[cabecera]) : '';
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
    link.setAttribute('download', `facturas_galaxgps_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // ========== PROCESO PRINCIPAL: GUARDAR FACTURA Y PDF ==========
  document.getElementById('formFactura')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const razonSocial = document.getElementById('facRazonSocial').value.trim().toUpperCase();
    const baseImponible = parseFloat(document.getElementById('facResumenBase').value) || 0;
    const totalIva = parseFloat(document.getElementById('facResumenTotal').value) || 0;
    const refUsd = parseFloat(document.getElementById('facResumenRef').value) || 0;
    const facturaNum = document.getElementById('facNumero').value.trim();
    const fechaFac = document.getElementById('facFecha').value || new Date().toISOString().split('T')[0];
    const estatusFac = document.getElementById('facEstatus').value;
    const tipoTransaccion = document.getElementById('facTipoFactura').value;
    const metodoPagoSeleccionado = document.getElementById('facMetodoPago')?.value || 'OTRO';

    if (!razonSocial) {
      mostrarAlerta('Debe seleccionar una Razón Social.');
      return;
    }

    if (serviciosSeleccionados.length === 0) {
      mostrarAlerta('Debe seleccionar al menos un servicio a facturar.');
      return;
    }

    // 1. Guardar la factura en la BD incluyendo la tasa fija de ese día
    const { data: facturaRes, error: errFac } = await supabase.from('facturas').insert([{
      razon_social: razonSocial,
      base_imponible: baseImponible,
      total_iva: totalIva,
      referencia_usd: refUsd,
      factura_num: facturaNum,
      fecha_factura: fechaFac,
      estatus: estatusFac,
      transaccion: tipoTransaccion,
      usuario: 'ADMINISTRADOR',
      tasa_cambio: TASA_CAMBIO_ACTUAL
    }]).select().single();

    if (errFac) {
      mostrarAlerta('Error al registrar factura: ' + errFac.message);
      return;
    }

    // 2. Guardar el pago vinculado con el método de pago seleccionado
    const observacionConTasa = `AUTOGENERADO POR FACTURA. Tasa BCV (Fecha ${fechaFac}): ${TASA_CAMBIO_ACTUAL.toFixed(4)}`;
    
    await supabase.from('pagos').insert([{
      factura_id: facturaRes.id,
      cliente: razonSocial,
      monto_bs: totalIva * TASA_CAMBIO_ACTUAL,
      ref_usd: refUsd,
      referencia: 'AUTO-' + Math.floor(100000 + Math.random() * 900000),
      tipo_pago: metodoPagoSeleccionado,
      metodo_pago: metodoPagoSeleccionado,
      observacion: observacionConTasa
    }]);

    // 3. Preparar lista múltiple de servicios
    const listaServicios = serviciosSeleccionados.map(s => {
      return {
        nombre: s.nombre,
        precioUsd: Number(s.monto_usd).toFixed(2),
        precioBs: (Number(s.monto_usd) * TASA_CAMBIO_ACTUAL).toFixed(2),
        meses: s.meses,
        vencimiento: calcularVencimiento(fechaFac, s.meses)
      };
    });

    const datosFactura = {
      nroFactura: facturaNum,
      clienteNombre: razonSocial,
      cedula: clienteSeleccionadoObj ? clienteSeleccionadoObj.rif : 'S/N',
      telefono: clienteSeleccionadoObj ? (clienteSeleccionadoObj.telefono || 'S/N') : 'S/N',
      fecha: fechaFac,
      tasaCambio: TASA_CAMBIO_ACTUAL.toFixed(4),
      servicios: listaServicios,
      baseImponible: baseImponible,
      montoIva: totalIva - baseImponible,
      totalUsd: refUsd,
      totalBs: (totalIva * TASA_CAMBIO_ACTUAL).toFixed(2)
    };

    await generarDescargarFacturaPdf(datosFactura);

    modal.classList.add('hidden');
    cargarFacturas();
  });
});

async function inicializarDatosSistema() {
  await cargarClientesYServicios();
  await cargarMetodosPagoSupabase();
  await cargarFacturas();
  const hoy = new Date().toISOString().split('T')[0];
  actualizarTasaSegunFecha(hoy);
  mostrarTasasHeaderEnVivo();
}

function mostrarTasasHeaderEnVivo() {
  const tasasGuardadas = JSON.parse(localStorage.getItem(STORAGE_TASAS_KEY) || '[]');
  const hoy = new Date().toISOString().split('T')[0];
  
  let tasaHoy = tasasGuardadas.find(t => t.fecha === hoy);
  if (!tasaHoy && tasasGuardadas.length > 0) {
    tasasGuardadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    tasaHoy = tasasGuardadas[0];
  }

  const lblDolar = document.getElementById('lblTasaDolarHeader');
  const lblEuro = document.getElementById('lblTasaEuroHeader');

  if (lblDolar && tasaHoy) {
    lblDolar.textContent = `${Number(tasaHoy.usd).toFixed(4)} BS`;
  }
  if (lblEuro && tasaHoy) {
    lblEuro.textContent = `${Number(tasaHoy.euro || tasaHoy.usd * 1.15).toFixed(4)} BS`;
  }
}

function actualizarTasaSegunFecha(fechaStr) {
  const tasasGuardadas = JSON.parse(localStorage.getItem(STORAGE_TASAS_KEY) || '[]');
  const tasaEncontrada = tasasGuardadas.find(t => t.fecha === fechaStr);

  if (tasaEncontrada) {
    TASA_CAMBIO_ACTUAL = Number(tasaEncontrada.usd);
  } else if (tasasGuardadas.length > 0) {
    tasasGuardadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    TASA_CAMBIO_ACTUAL = Number(tasasGuardadas[0].usd);
  } else {
    TASA_CAMBIO_ACTUAL = 827.7371;
  }

  const facTasaInput = document.getElementById('facTasaCambio');
  if (facTasaInput) {
    facTasaInput.value = `${TASA_CAMBIO_ACTUAL.toFixed(4)} BS`;
  }
}

async function cargarClientesYServicios() {
  const [resCli, resServ] = await Promise.all([
    supabase.from('clientes').select('*'),
    supabase.from('servicios').select('*').eq('estatus', 'ACTIVO')
  ]);
  if (resCli.data) clientesList = resCli.data;
  if (resServ.data) serviciosList = resServ.data;
}

async function cargarMetodosPagoSupabase() {
  const { data, error } = await supabase.from('metodos_pago').select('*').order('nombre', { ascending: true });
  if (!error && data) {
    metodosPagoList = data;
    poblarSelectMetodosPago();
  }
}

function poblarSelectMetodosPago() {
  const select = document.getElementById('facMetodoPago');
  if (!select) return;
  select.innerHTML = '';

  if (metodosPagoList.length === 0) {
    select.innerHTML = `<option value="PAGO MÓVIL">PAGO MÓVIL (Por defecto)</option>`;
    return;
  }

  metodosPagoList.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.nombre;
    opt.textContent = m.nombre;
    select.appendChild(opt);
  });
}

function renderizarTablaGestionMetodos() {
  const tbody = document.getElementById('tablaMetodosGestionBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (metodosPagoList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-slate-500">No hay métodos de pago registrados.</td></tr>`;
    return;
  }

  metodosPagoList.forEach(m => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors';
    tr.innerHTML = `
      <td class="p-2.5 border-r border-slate-800 font-bold text-white">${m.nombre}</td>
      <td class="p-2.5 border-r border-slate-800 text-slate-400">${m.observacion || '-'}</td>
      <td class="p-2.5 text-center flex items-center justify-center gap-2">
        <button type="button" class="btn-editar-metodo text-blue-400 hover:text-blue-300 px-1.5 py-1" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="btn-eliminar-metodo text-rose-500 hover:text-rose-400 px-1.5 py-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;

    tr.querySelector('.btn-editar-metodo').addEventListener('click', () => {
      document.getElementById('metodoIdEditando').value = m.id;
      document.getElementById('inputNombreMetodo').value = m.nombre;
      document.getElementById('inputObservacionMetodo').value = m.observacion || '';
      document.getElementById('btnGuardarMetodo').textContent = 'Actualizar Método';
      document.getElementById('btnCancelarEdicionMetodo').classList.remove('hidden');
    });

    tr.querySelector('.btn-eliminar-metodo').addEventListener('click', () => {
      mostrarAlerta(`¿Seguro que deseas eliminar el método de pago "${m.nombre}"?`, true, async () => {
        const { error } = await supabase.from('metodos_pago').delete().eq('id', m.id);
        if (error) {
          mostrarAlerta('Error al eliminar: ' + error.message);
        } else {
          await cargarMetodosPagoSupabase();
          renderizarTablaGestionMetodos();
        }
      });
    });

    tbody.appendChild(tr);
  });
}

function limpiarFormularioMetodo() {
  document.getElementById('formMetodoPago').reset();
  document.getElementById('metodoIdEditando').value = '';
  document.getElementById('btnGuardarMetodo').textContent = 'Guardar Método';
  document.getElementById('btnCancelarEdicionMetodo').classList.add('hidden');
}

function setupBuscadorClientes() {
  const input = document.getElementById('facRazonSocial');
  const contenedor = document.getElementById('sugerenciasClientes');
  if (!input || !contenedor) return;

  const mostrarSugerencias = () => {
    const texto = input.value.toLowerCase().trim();
    const filtrados = texto 
      ? clientesList.filter(c => (c.nombres || '').toLowerCase().includes(texto) || (c.rif || '').toLowerCase().includes(texto)).slice(0, 5)
      : clientesList.slice(0, 5);

    if (filtrados.length === 0) {
      contenedor.classList.add('hidden');
      contenedor.innerHTML = '';
      return;
    }

    contenedor.innerHTML = '';
    filtrados.forEach(c => {
      const nombreCli = c.nombres || '';
      const div = document.createElement('div');
      div.className = 'p-2.5 text-slate-300 hover:bg-amber-600/30 hover:text-white cursor-pointer transition-colors';
      div.textContent = `${nombreCli} (${c.rif || 'S/N'})`;
      div.addEventListener('click', () => {
        input.value = nombreCli;
        clienteSeleccionadoObj = c;
        mostrarInfoCliente(c);
        contenedor.classList.add('hidden');
      });
      contenedor.appendChild(div);
    });
    contenedor.classList.remove('hidden');
  };

  input.addEventListener('input', () => {
    mostrarSugerencias();
    const encontrado = clientesList.find(c => (c.nombres || '').toUpperCase() === input.value.toUpperCase().trim());
    if (encontrado) {
      clienteSeleccionadoObj = encontrado;
      mostrarInfoCliente(encontrado);
    } else {
      clienteSeleccionadoObj = null;
      limpiarInfoCliente();
    }
  });

  input.addEventListener('focus', mostrarSugerencias);
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !contenedor.contains(e.target)) {
      contenedor.classList.add('hidden');
    }
  });
}

function mostrarInfoCliente(c) {
  document.getElementById('infoClienteNombre').textContent = c.nombres || '-';
  document.getElementById('infoClienteCedula').textContent = c.rif || '-';
  document.getElementById('infoClienteTelefono').textContent = c.telefono || '-';
  document.getElementById('infoClienteDireccion').textContent = c.direccion || '-';
}

function limpiarInfoCliente() {
  document.getElementById('infoClienteNombre').textContent = '-';
  document.getElementById('infoClienteCedula').textContent = '-';
  document.getElementById('infoClienteTelefono').textContent = '-';
  document.getElementById('infoClienteDireccion').textContent = '-';
}

function renderizarTablaServiciosModal(lista) {
  const tbody = document.getElementById('tablaServiciosDisponibles');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-500">No hay servicios activos disponibles.</td></tr>`;
    return;
  }

  lista.forEach(s => {
    const montoBsCalculado = (Number(s.monto_usd || 0) * TASA_CAMBIO_ACTUAL).toFixed(2);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/60 cursor-pointer transition-colors';
    tr.innerHTML = `
      <td class="p-2.5 border-r border-slate-800 font-mono text-amber-400 font-bold">${s.id}</td>
      <td class="p-2.5 border-r border-slate-800 font-bold text-white">${s.nombre}</td>
      <td class="p-2.5 border-r border-slate-800 font-mono text-emerald-400">$ ${Number(s.monto_usd || 0).toFixed(2)}</td>
      <td class="p-2.5 border-r border-slate-800 font-mono text-slate-300">Bs. ${montoBsCalculado}</td>
      <td class="p-2.5 font-mono">${s.meses || 1}</td>
    `;
    tr.addEventListener('click', () => {
      seleccionarServicio(s);
      document.getElementById('modalServicios').classList.add('hidden');
    });
    tbody.appendChild(tr);
  });
}

function seleccionarServicio(s) {
  serviciosSeleccionados.push(s);
  renderizarServiciosSeleccionados();
}

function renderizarServiciosSeleccionados() {
  const tbody = document.getElementById('tablaDetalleServicios');
  tbody.innerHTML = '';

  if (serviciosSeleccionados.length === 0) {
    renderizarDetalleServicioVacio();
    return;
  }

  let sumaBaseUsd = 0;

  serviciosSeleccionados.forEach((s, index) => {
    const montoUsd = Number(s.monto_usd || 0);
    sumaBaseUsd += montoUsd;
    const montoBsCalculado = (montoUsd * TASA_CAMBIO_ACTUAL).toFixed(2);

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60';
    tr.innerHTML = `
      <td class="p-2 border-r border-slate-800 font-mono text-amber-400 font-bold">${s.id}</td>
      <td class="p-2 border-r border-slate-800 font-bold text-white flex justify-between items-center">
        ${s.nombre}
        <button type="button" class="btn-eliminar-srv text-rose-500 hover:text-rose-400 px-2" title="Quitar servicio"><i class="fa-solid fa-trash"></i></button>
      </td>
      <td class="p-2 border-r border-slate-800 font-mono">$ ${montoUsd.toFixed(2)} USD</td>
      <td class="p-2 border-r border-slate-800 font-mono text-amber-300">Bs. ${montoBsCalculado}</td>
      <td class="p-2 border-r border-slate-800 font-mono text-emerald-400 font-bold">$ ${montoUsd.toFixed(2)}</td>
      <td class="p-2 font-mono text-center">1</td>
    `;

    tr.querySelector('.btn-eliminar-srv').addEventListener('click', () => {
      serviciosSeleccionados.splice(index, 1);
      renderizarServiciosSeleccionados();
    });

    tbody.appendChild(tr);
  });

  document.getElementById('facResumenBase').value = sumaBaseUsd.toFixed(2);
  document.getElementById('facResumenRef').value = sumaBaseUsd.toFixed(2);
  calcularTotales();
}

function renderizarDetalleServicioVacio() {
  const tbody = document.getElementById('tablaDetalleServicios');
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-500 italic">Ningún servicio seleccionado. Seleccione un cliente primero y luego haga clic en "Elegir Servicio".</td></tr>`;
  document.getElementById('facResumenBase').value = '0.00';
  document.getElementById('facResumenTotal').value = '0.00';
  document.getElementById('facResumenRef').value = '0.00';
}

function calcularTotales() {
  const base = parseFloat(document.getElementById('facResumenBase').value) || 0;
  const porcIva = parseFloat(document.getElementById('facIvaPorc').value) || 0;
  const montoIva = base * (porcIva / 100);
  const total = base + montoIva;
  document.getElementById('facResumenTotal').value = total.toFixed(2);
}

async function cargarFacturas() {
  const { data, error } = await supabase.from('facturas').select('*').order('id', { ascending: false });
  if (error) return;
  facturasGlobal = data || [];
  renderizar(facturasGlobal);
}

function renderizar(lista) {
  const tbody = document.getElementById('tablaFacturasBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;

  let sumaBaseIva = 0;
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500">No hay facturas registradas.</td></tr>`;
    document.getElementById('txtTotalBaseIva').textContent = '$ 0.00';
    return;
  }

  lista.forEach(fac => {
    sumaBaseIva += Number(fac.base_imponible || 0);
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-400 font-bold">${fac.id}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${fac.fecha_registro || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400">${fac.fecha_factura || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-bold text-white">${fac.razon_social || ''}</td>
      <td class="p-3.5 border-r border-slate-800/50 text-slate-300">${fac.transaccion || 'VENTA'}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-blue-400 font-bold">${Number(fac.tasa_cambio || 0).toFixed(4)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-amber-300 font-bold">$ ${Number(fac.total_iva || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">$ ${Number(fac.base_imponible || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400 font-bold">$ ${Number(fac.referencia_usd || 0).toFixed(2)}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-300">${fac.factura_num && fac.factura_num !== '0' ? fac.factura_num : 'N/D'}</td>
      <td class="p-3.5 text-slate-400">${fac.usuario || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('txtTotalBaseIva').textContent = '$ ' + sumaBaseIva.toFixed(2);
}

function filtrarDatos() {
  const transaccionFiltro = document.getElementById('filtroTipoTransaccion')?.value || 'TODAS';
  const textoBuscador = document.getElementById('inputBuscadorTexto')?.value.toLowerCase().trim() || '';
  const tipoFecha = document.getElementById('filtroTipoFecha')?.value || 'FACTURA';
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;

  const filtrados = facturasGlobal.filter(fac => {
    // Filtro por tipo de transacción (VENTA / COMPRA)
    if (transaccionFiltro !== 'TODAS' && fac.transaccion !== transaccionFiltro) return false;

    // Filtro por buscador de texto (Razón social o número de factura)
    if (textoBuscador) {
      const razonSocial = String(fac.razon_social || '').toLowerCase();
      const nroFactura = String(fac.factura_num || '').toLowerCase();
      if (!razonSocial.includes(textoBuscador) && !nroFactura.includes(textoBuscador)) {
        return false;
      }
    }

    // Filtro por rangos de fecha (según fecha factura o fecha registro)
    const fechaEvaluar = tipoFecha === 'REGISTRO' ? fac.fecha_registro : fac.fecha_factura;
    if (desde && fechaEvaluar < desde) return false;
    if (hasta && fechaEvaluar > hasta) return false;

    return true;
  });

  renderizar(filtrados);
}

function mostrarAlerta(msg, esConfirmacion = false, onConfirm = null) {
  const modalAlerta = document.getElementById('modalAlerta');
  const txtAlerta = document.getElementById('textoAlertaModal');
  const btnCerrar = document.getElementById('btnCerrarAlerta');
  
  txtAlerta.textContent = msg;
  callbackConfirmacion = onConfirm;

  let contenedorBotones = btnCerrar.parentElement;
  let btnCancelarAlerta = document.getElementById('btnCancelarAlertaCustom');

  if (esConfirmacion) {
    if (!btnCancelarAlerta) {
      btnCancelarAlerta = document.createElement('button');
      btnCancelarAlerta.id = 'btnCancelarAlertaCustom';
      btnCancelarAlerta.className = 'w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all';
      btnCancelarAlerta.textContent = 'Cancelar';
      btnCancelarAlerta.addEventListener('click', () => {
        modalAlerta.classList.add('hidden');
        callbackConfirmacion = null;
      });
      contenedorBotones.insertBefore(btnCancelarAlerta, btnCerrar);
    } else {
      btnCancelarAlerta.classList.remove('hidden');
    }
    btnCerrar.textContent = 'Sí, eliminar';
    btnCerrar.className = 'w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all';
  } else {
    if (btnCancelarAlerta) btnCancelarAlerta.classList.add('hidden');
    btnCerrar.textContent = 'Aceptar';
    btnCerrar.className = 'w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all';
  }

  modalAlerta.classList.remove('hidden');
}

function calcularVencimiento(fechaInicioStr, cantidadMeses) {
  const fecha = new Date(fechaInicioStr + 'T12:00:00');
  fecha.setMonth(fecha.getMonth() + parseInt(cantidadMeses));
  
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  
  return `${dia}/${mes}/${anio}`; 
}

// ========== FUNCIÓN DE GENERACIÓN DE PDF ==========
async function generarDescargarFacturaPdf(datosFactura) {
  try {
    let cantidadServicios = datosFactura.servicios.length;

    let filasTablaHtml = '';
    datosFactura.servicios.forEach((serv, index) => {
      filasTablaHtml += `
        <tr>
          ${index === 0 ? `<td rowspan="${cantidadServicios}" style="padding: 10px; border: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; text-align: center; vertical-align: middle; font-weight: bold; font-size: 22px; background: #ffffff;">${cantidadServicios}</td>` : ''}
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 13px;">
            <strong>${serv.nombre}</strong><br>
            <span style="font-size: 11px; color: #64748b;">Vencimiento: ${serv.vencimiento}</span>
          </td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; font-size: 13px;">
            $${serv.precioUsd}<br>
            <span style="font-size: 11px; color: #64748b;">(Bs ${serv.precioBs})</span>
          </td>
        </tr>
      `;
    });

    let htmlTemplate = `
      <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #000000; padding: 10px; width: 750px;">
        <div style="margin: auto; padding: 25px; border: 1px solid #cbd5e1; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); font-size: 13px; line-height: 20px; background: #fff;">
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 2px; vertical-align: top;">
                <h2 style="margin: 0; color: #0284c7; font-size: 16px;">${CONFIG.SYSTEM_NAME}</h2>
                <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${CONFIG.SYSTEM_ADDRESS}</p>
                <p style="margin: 2px 0; font-size: 11px; color: #64748b;">${CONFIG.SYSTEM_EMAIL} | Tel: ${CONFIG.SYSTEM_PHONE}</p>
              </td>
              <td style="padding: 2px; vertical-align: top; text-align: right; font-size: 11px; color: #334155;">
                <strong>Rif:</strong> ${CONFIG.SYSTEM_RIF}<br>
                <strong>Fecha:</strong> ${datosFactura.fecha}<br>
                <strong>Tasa del día:</strong> 1$ = ${datosFactura.tasaCambio} BS
              </td>
            </tr>
          </table>

          <div style="background: #1e293b; color: white; text-align: center; font-weight: bold; font-size: 14px; padding: 6px; letter-spacing: 2px; margin: 15px 0;">
            R E C I B O   D E   P A G O
          </div>

          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <tr>
              <td style="padding: 6px 10px; vertical-align: top; width: 50%; border: 1px solid #cbd5e1; font-size: 12px;"><strong>Nombre Cliente:</strong><br>${datosFactura.clienteNombre}</td>
              <td style="padding: 6px 10px; vertical-align: top; width: 25%; border: 1px solid #cbd5e1; font-size: 12px;"><strong>Rif o C.I:</strong><br>${datosFactura.cedula}</td>
              <td style="padding: 6px 10px; vertical-align: top; width: 25%; border: 1px solid #cbd5e1; font-size: 12px;"><strong>Teléfono:</strong><br>${datosFactura.telefono}</td>
            </tr>
          </table>

          <div style="height: 10px;"></div>

          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <thead>
              <tr>
                <th style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; font-size: 12px; width: 15%; color: #334155;">CANTIDAD</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; font-size: 12px; width: 55%; color: #334155;">DESCRIPCIÓN</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; text-align: center; font-size: 12px; width: 30%; color: #334155;">PRECIO UNITARIO</th>
              </tr>
            </thead>
            <tbody>
              ${filasTablaHtml}
              <tr>
                <td colspan="2" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background: #f8fafc; font-size: 13px; color: #1e293b;">
                  TOTAL PAGADO:
                </td>
                <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background: #f8fafc;">
                  <span style="font-size: 15px; color: #0284c7;">$${datosFactura.totalUsd}</span><br>
                  <span style="font-size: 11px; color: #64748b;">(Bs ${datosFactura.totalBs})</span>
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>
    `;

    const contenedorTemp = document.createElement('div');
    contenedorTemp.innerHTML = htmlTemplate;
    document.body.appendChild(contenedorTemp);

    const clienteLimpio = datosFactura.clienteNombre.replace(/\s+/g, '_');
    const nombreArchivo = `factura_${clienteLimpio}_${datosFactura.fecha}.pdf`;

    const opciones = {
      margin:       5,
      filename:     nombreArchivo,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    await html2pdf().from(contenedorTemp).set(opciones).save();
    document.body.removeChild(contenedorTemp);

  } catch (error) {
    console.error('Error al generar PDF:', error);
    mostrarAlerta('Se guardó la factura en la base de datos, pero hubo un error al generar el PDF.');
  }
}