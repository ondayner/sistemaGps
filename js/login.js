import { supabase } from './supabaseClient.js';
import { registrarAuditoria } from './components/auditoriaService.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('form');
  const authAlert = document.getElementById('authAlert');
  const alertMessage = document.getElementById('alertMessage');

  function mostrarAlerta(mensaje) {
    if (alertMessage && authAlert) {
      alertMessage.textContent = mensaje;
      authAlert.classList.remove('hidden');
      setTimeout(() => {
        authAlert.classList.add('hidden');
      }, 4000);
    }
  }
  
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authAlert) authAlert.classList.add('hidden');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) {
        mostrarAlerta('Correo o contraseña incorrectos.');
        return;
      }

      // Guardar el nombre real del usuario en lugar de "ADMINISTRADOR"
      const nombreUsuario = data.nombre || email;
      localStorage.setItem('usuario_galax', nombreUsuario);

      // Registrar la entrada ('I') de forma segura sin bloquear el flujo si hay algún inconveniente de red
      try {
        await registrarAuditoria('Ingreso exitoso al sistema', 'I', 'Módulo Login');
      } catch (errAudit) {
        console.warn('Aviso de auditoría:', errAudit);
      }

      // Redirección exitosa
      window.location.href = './views/operacionesGPS/operaciones.html';
      
    } catch (err) {
      console.error('Error en el login:', err);
      mostrarAlerta('Ocurrió un error de conexión con el servidor.');
    }
  });
});