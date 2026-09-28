import CONFIG from '../config/config.js'; // Ajusta la ruta si es necesario

export function mostrarAlerta(mensaje, tituloPersonalizado = null) {
  return new Promise((resolve) => {
    // Buscar o crear dinámicamente el modal de alerta en el DOM
    let modalAlerta = document.getElementById('globalModalAlerta');
    
    if (!modalAlerta) {
      const div = document.createElement('div');
      div.id = 'globalModalAlerta';
      div.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
      div.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 transform transition-all">
          <div class="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h3 id="globalTituloAlerta" class="font-bold text-white text-sm mb-1"></h3>
            <p id="globalTextoAlerta" class="text-xs text-slate-400 mt-1"></p>
          </div>
          <button id="globalBtnCerrarAlerta" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20">Aceptar</button>
        </div>
      `;
      document.body.appendChild(div);
      modalAlerta = div;
    }

    // Definir el título usando CONFIG por defecto o el personalizado
    const tituloHtml = tituloPersonalizado || `
      <span class="font-black tracking-wider text-slate-100 text-sm truncate">
          ${CONFIG.SYSTEM_NAME.split(' ')[0]}<span class="text-amber-500"> ${CONFIG.SYSTEM_NAME.split(' ')[1] || ''}</span>
      </span>
    `;

    document.getElementById('globalTituloAlerta').innerHTML = tituloHtml;
    document.getElementById('globalTextoAlerta').textContent = mensaje;
    modalAlerta.classList.remove('hidden');

    const btnCerrar = document.getElementById('globalBtnCerrarAlerta');
    const nuevoBtn = btnCerrar.cloneNode(true);
    btnCerrar.parentNode.replaceChild(nuevoBtn, btnCerrar);

    document.getElementById('globalBtnCerrarAlerta').addEventListener('click', () => {
      modalAlerta.classList.add('hidden');
      resolve(true);
    }, { once: true });
  });
}

export function mostrarConfirmacion(mensaje, tituloPersonalizado = null) {
  return new Promise((resolve) => {
    let modalConfirmar = document.getElementById('globalModalConfirmar');
    
    if (!modalConfirmar) {
      const div = document.createElement('div');
      div.id = 'globalModalConfirmar';
      div.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4';
      div.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 transform transition-all">
          <div class="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-xl">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <h3 id="globalConfirmarTitulo" class="font-bold text-white text-sm mb-1"></h3>
            <p id="globalConfirmarMensaje" class="text-xs text-slate-400 mt-1"></p>
          </div>
          <div class="flex items-center gap-2 pt-2">
            <button id="globalBtnCancelConf" class="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all">Cancelar</button>
            <button id="globalBtnOkConf" class="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20">Sí, eliminar</button>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      modalConfirmar = div;
    }

    const tituloHtml = tituloPersonalizado || `
      <span class="font-black tracking-wider text-slate-100 text-sm truncate">
          ${CONFIG.SYSTEM_NAME.split(' ')[0]}<span class="text-amber-500"> ${CONFIG.SYSTEM_NAME.split(' ')[1] || ''}</span> - Confirmación
      </span>
    `;

    document.getElementById('globalConfirmarTitulo').innerHTML = tituloHtml;
    document.getElementById('globalConfirmarMensaje').textContent = mensaje;
    modalConfirmar.classList.remove('hidden');

    const btnOk = document.getElementById('globalBtnOkConf');
    const btnCancel = document.getElementById('globalBtnCancelConf');

    const nuevoBtnOk = btnOk.cloneNode(true);
    const nuevoBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(nuevoBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(nuevoBtnCancel, btnCancel);

    document.getElementById('globalBtnOkConf').addEventListener('click', () => {
      modalConfirmar.classList.add('hidden');
      resolve(true);
    }, { once: true });

    document.getElementById('globalBtnCancelConf').addEventListener('click', () => {
      modalConfirmar.classList.add('hidden');
      resolve(false);
    }, { once: true });
  });
}