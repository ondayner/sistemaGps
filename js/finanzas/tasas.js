import CONFIG from '../config/config.js'; // Ajusta la ruta según la profundidad de tu carpeta
import { mostrarAlerta, mostrarConfirmacion } from '../components/alertEliminar.js';

let tasasGlobal = [];
let tasaSeleccionadaFecha = null;
let modoEdicion = false;

const STORAGE_KEY = 'galax_tasas_cambio';

document.addEventListener('DOMContentLoaded', async () => {
  inicializarDatosMockSiNoExisten();
  
  // Sincronización automática y preventiva del día actual al cargar
  await sincronizarTasaDiariaAutomatica();

  cargarTasas();

  document.getElementById('btnFiltrarFechas')?.addEventListener('click', filtrarPorFechas);
  document.getElementById('btnLimpiarFiltro')?.addEventListener('click', limpiarFiltro);
  document.getElementById('btnActualizarHeader')?.addEventListener('click', cargarTasas);

  const modalTasa = document.getElementById('modalTasa');

  // Abrir Modal Agregar
  document.getElementById('btnAbrirAgregar')?.addEventListener('click', () => {
    modoEdicion = false;
    tasaSeleccionadaFecha = null;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-arrow-trend-up text-emerald-500"></i> Registrar Tasa Diaria`;
    document.getElementById('formTasa').reset();
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('tasaFecha').value = hoy;
    document.getElementById('tasaFecha').removeAttribute('disabled');

    modalTasa.classList.remove('hidden');
  });

  // Abrir Modal Editar
  document.getElementById('btnAbrirEditar')?.addEventListener('click', async () => {
    if (!tasaSeleccionadaFecha) {
      await mostrarAlerta('Debe Seleccionar un Registro', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    modoEdicion = true;
    document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-pen-to-square text-emerald-500"></i> Editar Tasa Diaria`;
    
    const t = tasasGlobal.find(item => item.fecha === tasaSeleccionadaFecha);
    if (t) {
      const inputFecha = document.getElementById('tasaFecha');
      inputFecha.value = t.fecha;
      inputFecha.setAttribute('disabled', 'true');

      document.getElementById('tasaUsd').value = t.usd;
      document.getElementById('tasaEuro').value = t.euro;
    }
    modalTasa.classList.remove('hidden');
  });

  document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalTasa.classList.add('hidden'));
  document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalTasa.classList.add('hidden'));

  // Guardar / Actualizar en LocalStorage
  document.getElementById('formTasa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = document.getElementById('tasaFecha').value;
    const usd = parseFloat(document.getElementById('tasaUsd').value);
    const euro = parseFloat(document.getElementById('tasaEuro').value);

    let tasas = obtenerTasasLocalStorage();

    if (modoEdicion) {
      tasas = tasas.map(t => t.fecha === fecha ? { fecha, usd, euro } : t);
    } else {
      const existe = tasas.some(t => t.fecha === fecha);
      if (existe) {
        await mostrarAlerta('Ya existe un registro para esta fecha. Use Editar.', `${CONFIG.SYSTEM_NAME} - Aviso`);
        return;
      }
      tasas.push({ fecha, usd, euro });
    }

    guardarTasasLocalStorage(tasas);
    modalTasa.classList.add('hidden');
    cargarTasas();
  });

  // Botón manual de respaldo por si se quiere forzar la actualización
  document.getElementById('btnSincronizaTasa')?.addEventListener('click', async () => {
    await sincronizarTasaDiariaAutomatica(true);
    cargarTasas();
  });

  // Eliminar Tasa
  document.getElementById('btnEliminarTasa')?.addEventListener('click', async () => {
    if (!tasaSeleccionadaFecha) {
      await mostrarAlerta('Debe Seleccionar un Registro', `${CONFIG.SYSTEM_NAME} - Aviso`);
      return;
    }
    
    const mensajeConfirm = `¿Seguro que deseas eliminar la tasa del ${tasaSeleccionadaFecha}?`;
    const confirmado = await mostrarConfirmacion(mensajeConfirm, `${CONFIG.SYSTEM_NAME} - Confirmación`);

    if (confirmado) {
      let tasas = obtenerTasasLocalStorage();
      tasas = tasas.filter(t => t.fecha !== tasaSeleccionadaFecha);
      guardarTasasLocalStorage(tasas);
      tasaSeleccionadaFecha = null;
      cargarTasas();
    }
  });
});

// Función centralizada y blindada para asegurar el registro diario
async function sincronizarTasaDiariaAutomatica(forzarAviso = false) {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares');
    if (!response.ok) throw new Error('No se pudo conectar con el servidor de tasas.');

    const data = await response.json();
    
    const bcvUsd = data.find(item => item.fuente === 'oficial' && item.moneda === 'USD') || data.find(item => item.moneda === 'USD');
    const bcvEuro = data.find(item => item.moneda === 'EUR');

    if (!bcvUsd) return;

    const hoy = new Date().toISOString().split('T')[0];
    const tasaUsdValor = Number(bcvUsd.promedio || bcvUsd.valor);
    const tasaEuroValor = bcvEuro ? Number(bcvEuro.promedio || bcvEuro.valor) : tasaUsdValor * 1.15;

    let tasas = obtenerTasasLocalStorage();
    
    const index = tasas.findIndex(t => t.fecha === hoy);
    if (index >= 0) {
      tasas[index].usd = tasaUsdValor;
      tasas[index].euro = tasaEuroValor;
    } else {
      tasas.push({ fecha: hoy, usd: tasaUsdValor, euro: tasaEuroValor });
    }

    guardarTasasLocalStorage(tasas);

    if (forzarAviso) {
      await mostrarAlerta(`¡Tasa sincronizada con éxito!\nUSD: ${tasaUsdValor.toFixed(4)} | EUR: ${tasaEuroValor.toFixed(4)}`, `${CONFIG.SYSTEM_NAME} - Sincronización`);
    }
  } catch (error) {
    if (forzarAviso) {
      await mostrarAlerta('Error al sincronizar: ' + error.message, `${CONFIG.SYSTEM_NAME} - Error`);
    }
  }
}

function obtenerTasasLocalStorage() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function guardarTasasLocalStorage(tasas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasas));
}

function inicializarDatosMockSiNoExisten() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const mock = [
      { fecha: '2026-09-10', usd: 827.7371, euro: 963.2128 },
      { fecha: '2026-09-09', usd: 820.1018, euro: 954.0244 },
      { fecha: '2026-09-08', usd: 814.6908, euro: 947.2980 },
      { fecha: '2026-09-07', usd: 813.7361, euro: 945.6509 },
      { fecha: '2026-09-04', usd: 807.3862, euro: 938.4492 },
      { fecha: '2026-09-03', usd: 804.8109, euro: 932.8080 },
      { fecha: '2026-09-02', usd: 801.1752, euro: 929.0908 },
      { fecha: '2026-09-01', usd: 798.3260, euro: 926.5531 }
    ];
    guardarTasasLocalStorage(mock);
  }
}

function cargarTasas() {
  const tbody = document.getElementById('tablaTasasBody');
  if (!tbody) return;

  const tasas = obtenerTasasLocalStorage();
  tasas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  bancosGlobalHelper(tasas);
}

function renderizarTasas(lista) {
  const tbody = document.getElementById('tablaTasasBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  document.getElementById('contadorRegistros').textContent = `Cant : ${lista.length}`;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">No se encontraron registros de tasas.</td></tr>`;
    return;
  }

  lista.forEach((t, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors';
    
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tablaTasasBody tr').forEach(row => row.classList.remove('bg-emerald-600/20', 'border-emerald-500/40'));
      tr.classList.add('bg-emerald-600/20', 'border-emerald-500/40');
      tasaSeleccionadaFecha = t.fecha;
    });

    tr.innerHTML = `
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-slate-400 font-bold">${index + 1}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-emerald-400 font-bold">${t.fecha}</td>
      <td class="p-3.5 border-r border-slate-800/50 font-mono text-white font-bold">${Number(t.usd).toFixed(4)}</td>
      <td class="p-3.5 font-mono text-slate-300">${Number(t.euro).toFixed(4)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function bancosGlobalHelper(lista) {
  tasasGlobal = lista;
  renderizarTasas(tasasGlobal);
}

function filtrarPorFechas() {
  const desde = document.getElementById('filtroDesde').value;
  const hasta = document.getElementById('filtroHasta').value;
  
  const todas = obtenerTasasLocalStorage();
  const filtradas = todas.filter(t => {
    if (desde && t.fecha < desde) return false;
    if (hasta && t.fecha > hasta) return false;
    return true;
  });

  bancosGlobalHelper(filtradas);
}

function limpiarFiltro() {
  document.getElementById('filtroDesde').value = '';
  document.getElementById('filtroHasta').value = '';
  cargarTasas();
}
