import { supabase } from '../supabaseClient.js';

export async function registrarAuditoria(concepto, accion, programa = 'Sistema Web') {
  try {
    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const hora = ahora.toLocaleTimeString();
    
    // Extraer el nombre real del usuario logueado, evitando mostrar "ADMINISTRADOR" por defecto
    const usuarioActual = localStorage.getItem('usuario_galax') || 'SISTEMA';
    const equipo = navigator.platform || 'Navegador Web';

    await supabase.from('auditoria').insert([{
      registro: fecha,
      hora: hora,
      concepto: concepto,
      accion: accion, // 'I' para Entrada, 'S' para Salida
      programa: programa,
      tabla: 'usuarios',
      usuario: usuarioActual,
      equipo: equipo
    }]);
  } catch (err) {
    console.error('Error registrando auditoría:', err);
  }
}

// Registrar salida automáticamente si el usuario cierra la pestaña o recarga el navegador de forma imprevista
window.addEventListener('beforeunload', () => {
  const usuarioActual = localStorage.getItem('usuario_galax');
  if (!usuarioActual) return; // Si no hay sesión iniciada, no audita cierre

  const ahora = new Date();
  const fecha = ahora.toISOString().split('T')[0];
  const hora = ahora.toLocaleTimeString();

  const payload = {
    registro: fecha,
    hora: hora,
    concepto: 'Cierre de sesión / Pestaña cerrada',
    accion: 'S',
    programa: 'Navegador Web',
    tabla: 'usuarios',
    usuario: usuarioActual,
    equipo: navigator.platform || 'Web'
  };

  // Usamos sendBeacon para asegurar que la petición se envíe a Supabase justo antes de cerrar la ventana
  const supabaseUrl = 'https://eejkrbehgkdvyafvxnr.supabase.co/rest/v1/auditoria';
  const supabaseKey = 'TU_ANON_KEY'; // Opcional según políticas públicas de inserción anónima
  
  navigator.sendBeacon(supabaseUrl, JSON.stringify(payload));
});