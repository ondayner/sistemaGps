(function () {
  window.addEventListener('DOMContentLoaded', () => {
    const barraAcciones = document.querySelector('.flex.flex-wrap.gap-3') || 
                          document.querySelector('#btnExportarCsv')?.parentElement ||
                          document.querySelector('button#btnExportarExcel')?.parentElement;

    const botonHtml = `
      <button id="btnSyncGlobal" title="Sincronizar datos con GPSWOX" style="
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        border: 1px solid rgba(59, 130, 246, 0.4);
        padding: 8px 16px;
        border-radius: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      ">
        <i id="iconoSync" class="fa-solid fa-rotate" style="font-size: 13px;"></i>
        <span>Sincronizar Servidor</span>
      </button>
    `;

    if (barraAcciones) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = botonHtml;
      barraAcciones.appendChild(wrapper.firstElementChild);
    } else {
      const contenedorAlternativo = document.createElement('div');
      contenedorAlternativo.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999;';
      contenedorAlternativo.innerHTML = botonHtml;
      document.body.appendChild(contenedorAlternativo);
    }

    // Crear la estructura HTML del Modal Personalizado Oculto
    const modalHtml = `
      <div id="modalSyncOverlay" style="
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        z-index: 99999;
        justify-content: center;
        align-items: center;
      ">
        <div style="
          background: #1e293b;
          border: 1px solid #334155;
          padding: 24px;
          border-radius: 16px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          color: #f8fafc;
          font-family: inherit;
          text-align: center;
        ">
          <div style="font-size: 32px; color: #3b82f6; margin-bottom: 12px;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <h3 id="modalSysName" style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #ffffff;">Sistema Administrativo</h3>
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
            ¡Sincronización masiva completada con éxito! Por favor, revise las tablas y los registros para verificar los cambios actualizados.
          </p>
          <button id="modalBtnCerrar" style="
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
          ">Entendido y Recargar</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const boton = document.getElementById('btnSyncGlobal');
    const icono = document.getElementById('iconoSync');
    const overlay = document.getElementById('modalSyncOverlay');
    const btnCerrar = document.getElementById('modalBtnCerrar');
    const sysNameEl = document.getElementById('modalSysName');

    // Cargar el nombre del sistema desde el backend al iniciar
    fetch('http://localhost:3000/api/config-sistema')
      .then(res => res.json())
      .then(config => {
        if (config && config.SYSTEM_NAME) {
          sysNameEl.textContent = config.SYSTEM_NAME;
        }
      })
      .catch(err => console.log('Usando nombre por defecto en modal.'));

    if (boton) {
      boton.addEventListener('click', async () => {
        if (boton.disabled) return;
        
        boton.disabled = true;
        boton.style.opacity = '0.7';
        icono.classList.add('fa-spin');
        boton.querySelector('span').textContent = 'Sincronizando...';

        try {
          const baseUrl = 'http://localhost:3000/api';
          
          await fetch(`${baseUrl}/sincronizar-clientes`);
          await fetch(`${baseUrl}/sincronizar-equipos`);
          await fetch(`${baseUrl}/sincronizar-lineas`);
          await fetch(`${baseUrl}/sincronizar-vehiculos`);

          // Mostrar modal personalizado en lugar de alert
          overlay.style.display = 'flex';
        } catch (error) {
          console.error('Error en sincronización:', error);
          alert('Hubo un error al conectar con el servidor backend.');
          resetBoton();
        }
      });
    }

    function resetBoton() {
      if (boton) {
        boton.disabled = false;
        boton.style.opacity = '1';
        icono.classList.remove('fa-spin');
        boton.querySelector('span').textContent = 'Sincronizar Servidor';
      }
    }

    btnCerrar?.addEventListener('click', () => {
      overlay.style.display = 'none';
      window.location.reload();
    });
  });
})();