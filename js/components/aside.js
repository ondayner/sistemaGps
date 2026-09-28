import CONFIG from '../config/config.js';
import { supabase } from '../supabaseClient.js';

async function registrarCierreAuditoria() {
  try {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = me.toLocaleTimeString ? ahora.toLocaleTimeString() : ahora.toTimeString().split(' ')[0];
    const usuarioActual = localStorage.getItem('usuario_galax') || 'SISTEMA';
    const equipo = navigator.platform || 'Navegador Web';

    await supabase.from('auditoria').insert([{
      registro: fecha,
      hora: hora,
      concepto: 'Cierre de sesión manual',
      accion: 'S',
      programa: 'Sistema Web',
      tabla: 'usuarios',
      usuario: usuarioActual,
      equipo: equipo
    }]);
  } catch (err) {
    console.error('Error registrando auditoría de salida:', err);
  }
}

export function renderAside(moduloActivo = '') {
  const asideContainer = document.getElementById('app-aside');
  if (!asideContainer) return;

  const path = window.location.pathname.toLowerCase();

  // Detección del módulo activo según la ruta /sistemaGps/
  if (!moduloActivo) {
    if (path.includes('/administracion/')) moduloActivo = 'admin';
    else if (path.includes('/contabilidad/')) moduloActivo = 'contabilidad';
    else if (path.includes('/facturacion/')) moduloActivo = 'facturacion';
    else if (path.includes('/finanzas/')) moduloActivo = 'finanzas';
    else if (path.includes('/inventario/')) moduloActivo = 'inventario';
    else if (path.includes('/operacionesgps/')) moduloActivo = 'operaciones';
  }

  if (moduloActivo === 'administracion') moduloActivo = 'admin';

  const modulos = [
    {
      id: 'admin',
      nombre: 'Administración',
      icono: 'fa-shield-halved',
      link: '/sistemaGps/views/administracion/admin.html',
      sublinks: [
        { nombre: 'Auditoría', url: '/sistemaGps/views/administracion/auditoria/auditoria.html', icono: 'fa-file-shield' },
        { nombre: 'Empleados', url: '/sistemaGps/views/administracion/empleados/empleados.html', icono: 'fa-users' },
        { nombre: 'Usuarios', url: '/sistemaGps/views/administracion/usuarios/usuarios.html', icono: 'fa-user-gear' }
      ]
    },
    {
      id: 'contabilidad',
      nombre: 'Contabilidad',
      icono: 'fa-calculator',
      link: '/sistemaGps/views/contabilidad/menu.html',
      sublinks: [
        { nombre: 'Asientos contables', url: '/sistemaGps/views/contabilidad/asientosContables/asientos_contables.html', icono: 'fa-file-invoice' },
        { nombre: 'Balance comprobación', url: '/sistemaGps/views/contabilidad/balance/balance.html', icono: 'fa-scale-balanced' },
        { nombre: 'Detalle asientos', url: '/sistemaGps/views/contabilidad/detalleAsientos/detalle_asientos.html', icono: 'fa-list-check' },
        { nombre: 'Libro diario', url: '/sistemaGps/views/contabilidad/libro/libro_diario.html', icono: 'fa-book' },
        { nombre: 'Plan de cuentas', url: '/sistemaGps/views/contabilidad/planCuentas/plan_cuentas.html', icono: 'fa-sitemap' },
        { nombre: 'Tipos de cuenta', url: '/sistemaGps/views/contabilidad/tiposCuentas/tipos_cuentas.html', icono: 'fa-tags' }
      ]
    },
    {
      id: 'facturacion',
      nombre: 'Facturación',
      icono: 'fa-file-invoice-dollar',
      link: '/sistemaGps/views/facturacion/facturacion.html',
      sublinks: [
        { nombre: 'Factura cliente', url: '/sistemaGps/views/facturacion/facturaCliente/facturas.html', icono: 'fa-receipt' },
        { nombre: 'Pagos', url: '/sistemaGps/views/facturacion/pagos/pagos.html', icono: 'fa-money-bill-transfer' }
      ]
    },
    {
      id: 'finanzas',
      nombre: 'Finanzas',
      icono: 'fa-wallet',
      link: '/sistemaGps/views/finanzas/finanzas.html',
      sublinks: [
        { nombre: 'Bancos', url: '/sistemaGps/views/finanzas/bancos/bancos.html', icono: 'fa-building-columns' },
        { nombre: 'Tasas de cambio', url: '/sistemaGps/views/finanzas/tasas/tasas.html', icono: 'fa-chart-line' }
      ]
    },
    {
      id: 'inventario',
      nombre: 'Inventario',
      icono: 'fa-boxes-stacked',
      link: '/sistemaGps/views/inventario/inventario.html',
      sublinks: [
        { nombre: 'Inventario General', url: '/sistemaGps/views/inventario/inventario/inventario_general.html', icono: 'fa-box-open' },
        { nombre: 'Proveedores', url: '/sistemaGps/views/inventario/proveedores/proveedores.html', icono: 'fa-truck-field' },
        { nombre: 'Modelos y Operadoras', url: '/sistemaGps/views/inventario/modelosOperadoras/modelos_operadoras.html', icono: 'fa-network-wired' }
      ]
    },
    {
      id: 'operaciones',
      nombre: 'Operaciones',
      icono: 'fa-gears',
      link: '/sistemaGps/views/operacionesGPS/operaciones.html',
      sublinks: [
        { nombre: 'Clientes', url: '/sistemaGps/views/operacionesGPS/clientes/clientes.html', icono: 'fa-address-book' },
        { nombre: 'Equipos', url: '/sistemaGps/views/operacionesGPS/equipos/equipos.html', icono: 'fa-microchip' },
        { nombre: 'Lineas', url: '/sistemaGps/views/operacionesGPS/lineas/lineas.html', icono: 'fa-sim-card' },
        { nombre: 'Monitor', url: '/sistemaGps/views/operacionesGPS/monitor/monitor.html', icono: 'fa-desktop' },
        { nombre: 'Vehículos', url: '/sistemaGps/views/operacionesGPS/vehiculos/vehiculos.html', icono: 'fa-car' }
      ]
    }
  ];

  let html = `
    <!-- Botón flotante autónomo para móvil -->
    <button id="btnToggleMobile" class="md:hidden fixed top-3 left-3 z-30 w-10 h-10 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl flex items-center justify-center shadow-xl hover:bg-slate-800 transition-colors">
      <i class="fa-solid fa-bars text-sm"></i>
    </button>

    <!-- Overlay oscuro para móvil -->
    <div id="aside-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 hidden md:hidden transition-opacity"></div>

    <!-- Contenedor principal de la barra lateral -->
    <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none transform -translate-x-full md:translate-x-0 md:static md:h-full transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none">
      
      <div class="h-16 border-b border-slate-800 flex items-center justify-between px-5 gap-3 shrink-0">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <i class="fa-solid fa-satellite-dish"></i>
          </div>
          <span class="font-black tracking-wider text-slate-100 text-sm truncate">
            ${CONFIG.SYSTEM_NAME.split(' ')[0]}<span class="text-amber-500">${CONFIG.SYSTEM_NAME.split(' ')[1] || ''}</span>
          </span>
        </div>
        <button id="btnCloseMobile" class="md:hidden text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
  `;

  modulos.forEach(mod => {
    const isActive = mod.id === moduloActivo;
    
    html += `
      <div>
        <a href="${mod.link}" class="flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-colors ${isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}">
          <span class="flex items-center gap-3">
            <i class="fa-solid ${mod.icono} text-sm w-5 text-center"></i>
            ${mod.nombre}
          </span>
          ${mod.sublinks ? `<i class="fa-solid fa-chevron-down text-[10px] transition-transform ${isActive ? 'rotate-180 text-amber-400' : ''}"></i>` : ''}
        </a>
    `;

    if (isActive && mod.sublinks && mod.sublinks.length > 0) {
      html += `<div class="pl-6 pr-2 py-1.5 space-y-1 my-1 border-l border-slate-800 ml-5">`;
      mod.sublinks.forEach(sub => {
        const nombreArchivoSub = sub.url.split('/').pop().toLowerCase();
        const esSubActivo = path.includes(nombreArchivoSub);

        html += `
          <a href="${sub.url}" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${esSubActivo ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}">
            <i class="fa-solid ${sub.icono || 'fa-circle-dot'} text-[11px] w-4 text-center"></i>
            ${sub.nombre}
          </a>
        `;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `
      </div>

      <div class="p-3 border-t border-slate-800 shrink-0 bg-slate-900/50">
        <button id="btnCerrarSesion" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-left">
          <i class="fa-solid fa-arrow-right-from-bracket text-sm w-5 text-center"></i>
          SALIR
        </button>
      </div>
    </aside>
  `;

  asideContainer.innerHTML = html;

  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('aside-overlay');
  const toggleBtn = document.getElementById('btnToggleMobile');
  const closeBtn = document.getElementById('btnCloseMobile');

  function toggleMenu() {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
    document.body.classList.toggle('overflow-hidden', !overlay.classList.contains('hidden'));
  }

  toggleBtn?.addEventListener('click', toggleMenu);
  closeBtn?.addEventListener('click', toggleMenu);
  overlay?.addEventListener('click', toggleMenu);

  document.getElementById('btnCerrarSesion')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await registrarCierreAuditoria();
      await supabase.auth.signOut();
      localStorage.setItem('logout_event', Date.now());
    } catch (error) {
      console.error("Error al procesar el cierre de sesión:", error);
    } finally {
      localStorage.removeItem('usuario_galax');
      window.location.href = '/sistemaGps/index.html';
    }
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === 'logout_event') {
    localStorage.removeItem('usuario_galax');
    window.location.href = '/sistemaGps/index.html';
  }
});
