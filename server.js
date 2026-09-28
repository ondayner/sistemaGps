// server.js
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { CONFIG, PROVEEDOR_ACTIVO, SUPABASE_CONFIG } = require('./trackerConfig');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.KEY);

// Configuración interna del sistema para el modal flotante
const APP_CONFIG = {
  SYSTEM_NAME: "Sistema Administrativo V1.0",
  SYSTEM_DESCRIPTION: "Plataforma de Control GPS",
  SYSTEM_VERSION: "1.0.0",
  SYSTEM_AUTHOR: "OndarDev",
  SYSTEM_COPYRIGHT: "© 2026 Todos los derechos reservados."
};

console.log(`[SISTEMA] Backend corriendo bajo el proveedor activo: ${PROVEEDOR_ACTIVO}`);

app.get('/', (req, res) => {
  res.send('¡Backend del sistema administrativo funcionando al 100%!');
});

// Endpoint para que el componente frontend lea la configuración del modal
app.get('/api/config-sistema', (req, res) => {
  res.status(200).json(APP_CONFIG);
});

// Función auxiliar para detectar operadora móvil en Venezuela
function detectarOperadora(telefono) {
  if (!telefono) return 'OTRO';
  let limpio = String(telefono).replace(/\D/g, '');
  if (limpio.startsWith('58') && limpio.length > 10) limpio = limpio.substring(2);
  if (limpio.startsWith('0')) limpio = limpio.substring(1);

  if (limpio.startsWith('412')) return 'DIGITEL';
  if (limpio.startsWith('414') || limpio.startsWith('424')) return 'MOVISTAR';
  if (limpio.startsWith('416') || limpio.startsWith('426')) return 'MOVILNET';
  return 'OTRO';
}

// Función auxiliar para aplanar y extraer TODOS los dispositivos sin límite de paginación o agrupación
async function obtenerDispositivosExternos() {
  const urlDevices = `${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.devices}?lang=en&user_api_hash=${CONFIG.USER_API_HASH}`;
  const response = await fetch(urlDevices, { method: 'GET', headers: { 'Accept': 'application/json' } });
  if (!response.ok) return [];

  const resultado = await response.json();
  let dispositivosPlana = [];

  const dataRaw = resultado.data || resultado;
  if (Array.isArray(dataRaw)) {
    dataRaw.forEach(grupo => {
      if (grupo.items && Array.isArray(grupo.items)) {
        dispositivosPlana.push(...grupo.items);
      } else {
        dispositivosPlana.push(grupo);
      }
    });
  }
  return dispositivosPlana;
}

// Función auxiliar para insertar en Supabase por bloques seguros (chunks) de 500 en 500
// Garantiza que si hay 2,000 o 3,000 registros, pasen TODOS sin que Supabase los rechace por tamaño.
async function upsertEnBloques(tabla, datos, conflictCol = 'id') {
  const tamanoBloque = 500;
  let totalProcesados = 0;
  let errores = 0;

  for (let i = 0; i < datos.length; i += tamanoBloque) {
    const bloque = datos.slice(i, i + tamanoBloque);
    const { error } = await supabase.from(tabla).upsert(bloque, { onConflict: conflictCol });
    
    if (error) {
      console.error(`[ERROR LOTE SUPABASE ${tabla}]:`, error.message);
      errores += bloque.length;
    } else {
      totalProcesados += bloque.length;
    }
  }
  return { totalProcesados, errores };
}

// ==========================================
// 1. MÓDULO CLIENTES (Ultra Rápido y Masivo)
// ==========================================
app.get('/api/sincronizar-clientes', async (req, res) => {
  try {
    console.log(`\n[SYNC CLIENTES] Sincronización masiva ultrarrápida desde ${PROVEEDOR_ACTIVO}...`);

    let paginaActual = 1;
    let hayMasClientes = true;
    let todosLosClientes = [];

    while (hayMasClientes) {
      const urlClients = `${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.clients}?page=${paginaActual}&lang=en&user_api_hash=${CONFIG.USER_API_HASH}`;
      const response = await fetch(urlClients, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!response.ok) break;

      const resultadoExterno = await response.json();
      const clientesExternos = resultadoExterno.data;

      if (!clientesExternos || !Array.isArray(clientesExternos) || clientesExternos.length === 0) {
        hayMasClientes = false;
        break;
      }

      const loteMapeado = clientesExternos.map(cli => {
        let nombresFinales = cli.name || cli.company_name || (cli.email ? cli.email.split('@')[0].toUpperCase() : 'CLIENTE SIN NOMBRE');
        if (typeof nombresFinales === 'string') nombresFinales = nombresFinales.toUpperCase();

        return {
          id: cli.id,
          nombres: nombresFinales,
          rif: cli.personal_code || cli.rif || 'S/N',
          telefono: cli.phone_number || cli.phone || 'N/D',
          email: cli.email || 'sin-correo@galaxgps.com',
          vendedor: 'GALAX',
          comision: 1.50,
          estatus: (cli.active == 1 || cli.active === true) ? 'ACTIVO' : 'INACTIVO',
          nota: `Sincronizado de ${PROVEEDOR_ACTIVO}`
        };
      });

      todosLosClientes.push(...loteMapeado);

      if (clientesExternos.length < 25) hayMasClientes = false;
      else paginaActual++;
    }

    const resultadoUpsert = await upsertEnBloques('clientes', todosLosClientes, 'id');
    console.log(`[SYNC CLIENTES] Finalizado. Total inyectados: ${resultadoUpsert.totalProcesados} de ${todosLosClientes.length}\n`);
    
    if (res) res.status(200).json({ status: 'success', total_procesados: resultadoUpsert.totalProcesados, fallidos: resultadoUpsert.errores });
  } catch (error) {
    console.error('[ERROR CRÍTICO SYNC CLIENTES]:', error);
    if (res) res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// 2. MÓDULO EQUIPOS (Ultra Rápido y Masivo)
// ==========================================
app.get('/api/sincronizar-equipos', async (req, res) => {
  try {
    console.log(`\n[SYNC EQUIPOS] Sincronización masiva desde ${PROVEEDOR_ACTIVO}...`);
    const dispositivosExternos = await obtenerDispositivosExternos();

    if (dispositivosExternos.length === 0) {
      if (res) return res.status(400).json({ status: 'error', message: 'No hay dispositivos externos.' });
      return;
    }

    const loteEquipos = dispositivosExternos.map(item => {
      const devInfo = item.device_data || item;
      const traccarInfo = devInfo.traccar || {};

      const imeiLimpio = devInfo.imei || traccarInfo.uniqueId || item.serial || 'SIN-IMEI';
      const modeloLimpio = devInfo.device_model || devInfo.model || 'GENÉRICO';
      const estatusLimpio = (devInfo.active == 1 || item.online === 'ack' || item.online === 'online') ? 'ACTIVO' : 'INACTIVO';
      const telefonoSim = devInfo.sim_number || item.sim_number || null;
      const placaEncontrada = devInfo.plate_number || item.plate_number || null;

      let fechaOriginal = devInfo.created_at || item.created_at || traccarInfo.server_time || null;
      let fechaRegistroLimpia = new Date().toISOString().split('T')[0];
      if (fechaOriginal) {
        fechaRegistroLimpia = String(fechaOriginal).split('T')[0].split(' ')[0];
      }

      return {
        id: item.id,
        serial_imei: imeiLimpio,
        modelo: modeloLimpio.toUpperCase(),
        estatus: estatusLimpio,
        telefono: telefonoSim,
        vehiculo_id: placaEncontrada,
        esta_en_plataforma: 'SI',
        fecha_registro: fechaRegistroLimpia,
        nota: `Sincronizado de ${PROVEEDOR_ACTIVO}`
      };
    });

    const resultadoUpsert = await upsertEnBloques('equipos', loteEquipos, 'id');
    console.log(`[SYNC EQUIPOS] Finalizado. Total inyectados: ${resultadoUpsert.totalProcesados} de ${loteEquipos.length}\n`);
    
    if (res) res.status(200).json({ status: 'success', equipos_procesados: resultadoUpsert.totalProcesados, fallidos: resultadoUpsert.errores });
  } catch (error) {
    console.error('[ERROR CRÍTICO SYNC EQUIPOS]:', error);
    if (res) res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// 3. MÓDULO LÍNEAS (Ultra Rápido y Masivo)
// ==========================================
app.get('/api/sincronizar-lineas', async (req, res) => {
  try {
    console.log(`\n[SYNC LÍNEAS] Sincronización masiva desde ${PROVEEDOR_ACTIVO}...`);
    const dispositivosExternos = await obtenerDispositivosExternos();

    if (dispositivosExternos.length === 0) {
      if (res) return res.status(400).json({ status: 'error', message: 'No hay dispositivos externos.' });
      return;
    }

    let loteLineas = [];
    for (const item of dispositivosExternos) {
      const devInfo = item.device_data || item;
      const telefonoSim = devInfo.sim_number || item.sim_number || null;
      const imeiLimpio = devInfo.imei || devInfo.traccar?.uniqueId || item.serial || 'SIN-IMEI';
      const estatusLimpio = (devInfo.active == 1 || item.online === 'ack' || item.online === 'online') ? 'ACTIVO' : 'INACTIVO';

      if (telefonoSim && telefonoSim.trim() !== '' && telefonoSim !== 'N/D') {
        const operadoraDetectada = detectarOperadora(telefonoSim);

        loteLineas.push({
          id: item.id,
          telefono: telefonoSim,
          telefonia: operadoraDetectada,
          serial: 'S/N',
          eq_asociado: imeiLimpio,
          estatus: estatusLimpio,
          esta_en_plataforma: 'SI',
          registro: new Date().toISOString().split('T')[0],
          nota: `Sincronizado de ${PROVEEDOR_ACTIVO}`
        });
      }
    }

    if (loteLineas.length > 0) {
      const resultadoUpsert = await upsertEnBloques('lineas', loteLineas, 'id');
      console.log(`[SYNC LÍNEAS] Finalizado. Total inyectadas: ${resultadoUpsert.totalProcesados} de ${loteLineas.length}\n`);
      if (res) res.status(200).json({ status: 'success', lineas_actualizadas: resultadoUpsert.totalProcesados, fallidos: resultadoUpsert.errores });
    } else {
      if (res) res.status(200).json({ status: 'success', lineas_actualizadas: 0 });
    }
  } catch (error) {
    console.error('[ERROR CRÍTICO SYNC LÍNEAS]:', error);
    if (res) res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// 4. MÓDULO VEHÍCULOS (Ultra Rápido + Sin Límite + Blindado)
// ==========================================
app.get('/api/sincronizar-vehiculos', async (req, res) => {
  try {
    console.log(`\n[SYNC VEHÍCULOS] Sincronización masiva ultrarrápida desde ${PROVEEDOR_ACTIVO}...`);
    const dispositivosExternos = await obtenerDispositivosExternos();

    if (dispositivosExternos.length === 0) {
      if (res) return res.status(400).json({ status: 'error', message: 'No hay dispositivos para sincronizar vehículos.' });
      return;
    }

    const TARIFA_MENSUAL = 21.00;

    // Precargamos los clientes y IDs válidos para evitar errores de llave foránea de golpe
    const { data: clientesDB } = await supabase.from('clientes').select('id, nombres');
    const mapaClientes = new Map();
    const idsClientesValidos = new Set();
    if (clientesDB) {
      clientesDB.forEach(c => {
        mapaClientes.set(c.id, c.nombres.toUpperCase());
        idsClientesValidos.add(c.id);
      });
    }

    const correosStaffIgnorados = [
      'administrador@movilnet.com.ve',
      'administracion@galaxgps.com',
      'cobranza@galaxgps.com',
      'gerenteatc@galaxgps.com',
      'info@galaxgps.com',
      'programacion@galaxgps.com',
      'aondayner@gmail.com',
      'christian.sandrea3506@gmail.com'
    ];
    const dominiosStaffIgnorados = ['galaxgps.com', 'movilnet.com.ve'];

    let loteVehiculos = [];

    for (const item of dispositivosExternos) {
      const devInfo = item.device_data || item;
      const traccarInfo = devInfo.traccar || {};

      const imeiLimpio = devInfo.imei || traccarInfo.uniqueId || item.serial || 'SIN-IMEI';
      const matriculaLimpia = devInfo.plate_number || item.plate_number || devInfo.plate || item.plate || 'S/N';
      const estatusLimpio = (devInfo.active == 1 || item.online === 'ack' || item.online === 'online') ? 'ACTIVO' : 'INACTIVO';
      
      let clienteIdDetectado = null;

      if (devInfo.users && Array.isArray(devInfo.users) && devInfo.users.length > 0) {
        const clienteReal = devInfo.users.find(u => {
          const email = (u.email || '').toLowerCase().trim();
          return !correosStaffIgnorados.includes(email) && !dominiosStaffIgnorados.some(dom => email.includes(dom));
        });
        if (clienteReal) clienteIdDetectado = clienteReal.id;
      }

      if (!clienteIdDetectado) {
        clienteIdDetectado = devInfo.pivot?.user_id || devInfo.user_id || item.user_id || null;
      }

      // Blindaje de llave foránea: Si el ID de cliente no existe en Supabase, pasa como null para no bloquear el lote
      const clienteIdFinal = (clienteIdDetectado && idsClientesValidos.has(clienteIdDetectado)) ? clienteIdDetectado : null;

      let nombreClienteLimpio = '';
      if (clienteIdFinal && mapaClientes.has(clienteIdFinal)) {
        nombreClienteLimpio = mapaClientes.get(clienteIdFinal);
      } else if (devInfo.users && devInfo.users.length > 0) {
        const userFallback = devInfo.users.find(u => u.id === clienteIdDetectado) || devInfo.users[0];
        if (userFallback && userFallback.email) {
          nombreClienteLimpio = userFallback.email.split('@')[0].toUpperCase();
        }
      }

      const vencimientoOriginal = devInfo.subscription_expiration || item.subscription_expiration || devInfo.expiration_date || null;
      let fechaVencimiento = null;
      let mesesVencidos = 0;
      let montoVencido = 0.00;

      if (vencimientoOriginal) {
        fechaVencimiento = String(vencimientoOriginal).split(' ')[0];
        const fechaVenObj = new Date(fechaVencimiento);
        const hoy = new Date();
        
        if (fechaVenObj < hoy) {
          const diffAnios = hoy.getFullYear() - fechaVenObj.getFullYear();
          const diffMeses = hoy.getMonth() - fechaVenObj.getMonth();
          mesesVencidos = (diffAnios * 12) + diffMeses;
          if (mesesVencidos < 0) mesesVencidos = 0;
          montoVencido = mesesVencidos * TARIFA_MENSUAL;
        }
      }

      loteVehiculos.push({
        id: item.id,
        secuencia: String(item.id),
        cliente_id: clienteIdFinal,
        cliente: nombreClienteLimpio || '', 
        matricula: matriculaLimpia,
        serial_equipo: imeiLimpio,
        vencimiento: fechaVencimiento,
        plazo: fechaVencimiento,
        estatus: estatusLimpio,
        esta_en_plataforma: 'SI',
        meses_vencidos: mesesVencidos,
        monto_vencido: montoVencido,
        modelo: devInfo.device_model || '',
        marca: '',
        color: '',
        categoria: 'PARTICULAR',
        canal: '',
        nota: ''
      });
    }

    // Inserción en bloques seguros (sin recortar a 1000, inyecta los 2000 o más que lleguen de golpe)
    const resultadoUpsert = await upsertEnBloques('vehiculos', loteVehiculos, 'id');
    console.log(`[SYNC VEHÍCULOS] Finalizado. Total inyectados: ${resultadoUpsert.totalProcesados} de ${loteVehiculos.length}\n`);

    if (res) res.status(200).json({ status: 'success', vehiculos_procesados: resultadoUpsert.totalProcesados, fallidos: resultadoUpsert.errores });

  } catch (error) {
    console.error('[ERROR CRÍTICO SYNC VEHÍCULOS]:', error);
    if (res) res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// 5. MÓDULO MONITOR EN VIVO
// ==========================================
app.get('/api/monitor-gpswox', async (req, res) => {
  try {
    const dispositivosExternos = await obtenerDispositivosExternos();
    if (!dispositivosExternos || dispositivosExternos.length === 0) {
      return res.status(200).json([]);
    }

    const correosStaffIgnorados = [
      'administrador@movilnet.com.ve',
      'administracion@galaxgps.com',
      'cobranza@galaxgps.com',
      'gerenteatc@galaxgps.com',
      'info@galaxgps.com',
      'programacion@galaxgps.com',
      'aondayner@gmail.com',
      'christian.sandrea3506@gmail.com'
    ];
    const dominiosStaffIgnorados = ['galaxgps.com', 'movilnet.com.ve'];

    const monitorMapeado = dispositivosExternos.map((item, index) => {
      const devInfo = item.device_data || item;
      const traccarInfo = devInfo.traccar || {};

      let propietarioNombre = 'GALAX';
      if (devInfo.users && Array.isArray(devInfo.users) && devInfo.users.length > 0) {
        const clienteReal = devInfo.users.find(u => {
          const email = (u.email || '').toLowerCase().trim();
          return !correosStaffIgnorados.includes(email) && !dominiosStaffIgnorados.some(dom => email.includes(dom));
        });
        if (clienteReal) {
          propietarioNombre = `${clienteReal.first_name || ''} ${clienteReal.last_name || ''}`.trim() || clienteReal.email.split('@')[0];
        } else if (devInfo.users[0]) {
          propietarioNombre = devInfo.users[0].email ? devInfo.users[0].email.split('@')[0] : 'GALAX';
        }
      }

      return {
        id: item.id || index + 1,
        nu_secuencia: item.id || index + 1,
        name: devInfo.name || item.name || 'SIN NOMBRE',
        imei: devInfo.imei || traccarInfo.uniqueId || item.serial || 'SIN-IMEI',
        sim_number: devInfo.sim_number || item.sim_number || 'N/D',
        device_model: devInfo.device_model || devInfo.model || 'GENÉRICO',
        plate_number: devInfo.plate_number || item.plate_number || 'S/N',
        object_owner: propietarioNombre.toUpperCase(),
        active: (devInfo.active == 1 || item.online === 'ack' || item.online === 'online') ? 1 : 0,
        protocol: traccarInfo.protocol || devInfo.protocol || 'GT06',
        comment: devInfo.comment || devInfo.notes || ''
      };
    });

    res.status(200).json(monitorMapeado);
  } catch (error) {
    console.error('[ERROR CRÍTICO MONITOR GPSWOX]:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// TAREA PROGRAMADA: Sincronización Diaria (6:00 AM)
// ==========================================
cron.schedule('0 6 * * *', async () => {
  console.log('\n[CRON JOB] Iniciando sincronización automática diaria (6:00 AM)...');
  try {
    await new Promise((resolve) => { app._router.handle({ method: 'GET', url: '/api/sincronizar-clientes' }, { status: () => ({ json: resolve }) }, resolve); });
    await new Promise((resolve) => { app._router.handle({ method: 'GET', url: '/api/sincronizar-equipos' }, { status: () => ({ json: resolve }) }, resolve); });
    await new Promise((resolve) => { app._router.handle({ method: 'GET', url: '/api/sincronizar-lineas' }, { status: () => ({ json: resolve }) }, resolve); });
    await new Promise((resolve) => { app._router.handle({ method: 'GET', url: '/api/sincronizar-vehiculos' }, { status: () => ({ json: resolve }) }, resolve); });
    console.log('[CRON JOB] Sincronización automática diaria completada con éxito.');
  } catch (err) {
    console.error('[CRON JOB ERROR] Falló la sincronización automática:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});