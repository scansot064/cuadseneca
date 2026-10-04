// ==UserScript==
// @name         Séneca Cuaderno de clase - Navegación mejorada
// @namespace    colako-seneca-mejoras
// @version      0.2
// @description  Pestañas para grupos + persistencia de la evaluación seleccionada al cambiar de grupo
// @match        https://seneca.juntadeandalucia.es/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'senecaCuaderno_ultimaEvaluacion';
  const POLL_MS = 150;
  const POLL_TIMEOUT_MS = 8000;

  function log(...args) {
    console.log('[Cuaderno-mejoras]', ...args);
  }

  function getJQuery() {
    // El sitio carga jQuery; lo usamos si está disponible para disparar
    // 'change' de forma compatible con select2 y otros plugins.
    return window.jQuery || window.$ || null;
  }

  function fireChange(select) {
    const $ = getJQuery();
    if ($) {
      $(select).trigger('change');
    } else {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function getSelects() {
    return {
      grupo: document.querySelector('select[name="X_GRUALUPROMAT"]'),
      evaluacion: document.querySelector('select[name="X_CONVCENTRO"]'),
      refrescarBtn: document.querySelector('#REFRESCAR, button[name="REFRESCAR"]'),
    };
  }

  function optionLabel(option) {
    return (option.textContent || '').trim();
  }

  function saveEvaluacionLabel(label) {
    if (!label) return;
    localStorage.setItem(STORAGE_KEY, label);
  }

  function loadEvaluacionLabel() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function selectEvaluacionByLabel(select, label) {
    const match = Array.from(select.options).find(
      (o) => optionLabel(o) === label
    );
    if (!match) return false;
    if (select.value === match.value) return 'already'; // ya estaba correcta
    select.value = match.value;
    fireChange(select);
    return true;
  }

  // Estado de una restauración pendiente tras cambiar de grupo. En vez de
  // comprobar el <select> inmediatamente (Séneca puede tardar en terminar
  // su propia recarga AJAX, y comprobar demasiado pronto nos hace leer
  // datos todavía no actualizados), esperamos a que el DOM deje de
  // cambiar durante SETTLE_MS antes de evaluar nada.
  let pendingLabel = null;
  let armed = false;
  let armedSince = 0;
  let settleTimer = null;
  const SETTLE_MS = 300;

  function requestRestore() {
    const wanted = loadEvaluacionLabel();
    if (!wanted) return;
    pendingLabel = wanted;
    armed = true;
    armedSince = Date.now();
    log('Restauración armada, esperando a que el DOM se estabilice:', wanted);
    scheduleSettleCheck();
  }

  function scheduleSettleCheck() {
    if (!armed) return;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      performRestoreCheck();
    }, SETTLE_MS);
  }

  function performRestoreCheck() {
    if (!armed) return;

    if (Date.now() - armedSince > POLL_TIMEOUT_MS) {
      log('Se agotó el tiempo esperando que el selector de evaluación se estabilizara.');
      armed = false;
      return;
    }

    const { evaluacion, refrescarBtn } = getSelects();
    if (!evaluacion) {
      scheduleSettleCheck(); // todavía no existe el selector, seguimos esperando
      return;
    }

    const hasRealOptions = Array.from(evaluacion.options).some(
      (o) => o.value !== '-1' && o.value !== ''
    );
    if (!hasRealOptions) {
      scheduleSettleCheck(); // aún sin opciones reales, seguimos esperando
      return;
    }

    const result = selectEvaluacionByLabel(evaluacion, pendingLabel);
    armed = false;

    if (result === false) {
      log('La evaluación "' + pendingLabel + '" no existe en este grupo.');
      return;
    }

    const label = pendingLabel;
    if (result === 'already') {
      log('La evaluación ya era "' + label + '"; pulsando Refrescar de todos modos.');
    } else {
      log('Evaluación restaurada:', label);
    }
    setTimeout(() => {
      if (refrescarBtn) {
        refrescarBtn.click();
        log('Refrescar pulsado automáticamente.');
      }
    }, 200);
  }

  function onGrupoChanged() {
    requestRestore();
  }

  function wireEvaluacionListener(evaluacionSelect) {
    if (evaluacionSelect.dataset.mejorasWired) return;
    evaluacionSelect.dataset.mejorasWired = '1';
    evaluacionSelect.addEventListener('change', () => {
      const opt = evaluacionSelect.options[evaluacionSelect.selectedIndex];
      const label = optionLabel(opt);
      if (opt.value !== '-1') {
        saveEvaluacionLabel(label);
        log('Evaluación guardada como preferida:', label);
      }
    });
  }

  // ---------- Pestañas para el selector de grupo ----------

  // Contenedor real donde vive "Número total de registros" (confirmado
  // por inspección): <div class="pag-summary-info ...">. Se usa como vía
  // rápida y precisa; la búsqueda por texto queda como reserva por si
  // Séneca cambiara esa clase en el futuro.
  function findRegistrosContainer() {
    return document.querySelector('.pag-summary-info');
  }

  function findRegistrosAnchor() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (/Número total de registros/i.test(node.textContent)) {
        return node.parentElement;
      }
    }
    return null;
  }

  function getGrupoLabel() {
    return document.querySelector('label[for="X_GRUALUPROMAT"]');
  }

  function placeTabBar(bar, grupoSelect) {
    const container = findRegistrosContainer();
    const label = getGrupoLabel();
    if (container) {
      container.prepend(bar);
      if (label) container.prepend(label);
      bar.style.visibility = 'visible';
      return;
    }
    const anchor = findRegistrosAnchor();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(bar, anchor);
      if (label) anchor.parentNode.insertBefore(label, bar);
      bar.style.visibility = 'visible';
    } else {
      // Todavía no hay lista de alumnado cargada: colocación provisional
      // junto al select oculto, hasta que repositionTabBar() la mueva.
      // Se mantiene invisible un instante para evitar el "salto" visual;
      // si el ancla tarda demasiado en aparecer, se muestra igualmente.
      grupoSelect.insertAdjacentElement('beforebegin', bar);
      setTimeout(() => {
        bar.style.visibility = 'visible';
      }, 400);
    }
  }

  // Se llama en cada mutación del DOM para mover la barra de pestañas (y
  // la etiqueta "Alumnado de:") si la lista de alumnado se (re)carga
  // después de la colocación inicial.
  function repositionTabBar() {
    const bar = document.getElementById('mejoras-tabs');
    if (!bar) return;
    const label = getGrupoLabel();

    const container = findRegistrosContainer();
    if (container) {
      const correctlyPlaced =
        bar.parentElement === container &&
        (label
          ? bar.previousElementSibling === label && label.parentElement === container
          : container.firstElementChild === bar);
      if (correctlyPlaced) return;
      container.prepend(bar);
      if (label) container.prepend(label);
      bar.style.visibility = 'visible';
      return;
    }

    const anchor = findRegistrosAnchor();
    if (!anchor || !anchor.parentNode) return;
    const correctlyPlaced =
      bar.nextElementSibling === anchor && (!label || bar.previousElementSibling === label);
    if (correctlyPlaced) return;
    anchor.parentNode.insertBefore(bar, anchor);
    if (label) anchor.parentNode.insertBefore(label, bar);
    bar.style.visibility = 'visible';
  }

  // Referencia compartida y siempre actualizada al <select> de grupo real
  // (Séneca puede sustituirlo por un nodo nuevo en cada recarga del
  // formulario). Los clics en las pestañas leen esta variable en el
  // momento del clic, no una referencia capturada al crear la barra, para
  // poder reutilizar la misma barra sin reconstruirla.
  let currentGrupoSelect = null;

  function buildTabBar(grupoSelect) {
    if (document.getElementById('mejoras-tabs')) {
      document.getElementById('mejoras-tabs').remove();
    }

    const bar = document.createElement('div');
    bar.id = 'mejoras-tabs';
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.gap = '4px';
    bar.style.margin = '8px 0';
    bar.style.visibility = 'hidden';

    Array.from(grupoSelect.options).forEach((opt) => {
      if (opt.value === '-1') return; // opción en blanco, se omite
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.textContent = optionLabel(opt);
      tab.dataset.value = opt.value;
      tab.style.padding = '6px 12px';
      tab.style.border = '1px solid #ccc';
      tab.style.borderBottom = 'none';
      tab.style.borderRadius = '6px 6px 0 0';
      tab.style.cursor = 'pointer';
      tab.style.background = opt.selected ? '#0d6efd' : '#f0f0f0';
      tab.style.color = opt.selected ? '#fff' : '#333';
      tab.addEventListener('click', () => {
        if (!currentGrupoSelect) return;
        currentGrupoSelect.value = opt.value;
        fireChange(currentGrupoSelect);
        highlightActiveTab(bar, opt.value);
        requestRestore();
      });
      bar.appendChild(tab);
    });

    placeTabBar(bar, grupoSelect);
  }

  function highlightActiveTab(bar, value) {
    Array.from(bar.children).forEach((tab) => {
      const active = tab.dataset.value === value;
      tab.style.background = active ? '#0d6efd' : '#f0f0f0';
      tab.style.color = active ? '#fff' : '#333';
    });
  }

  // ---------- Inicialización / observación de la página ----------

  function trySetup() {
    const { grupo, evaluacion } = getSelects();
    if (!grupo || !evaluacion) return false;

    if (!grupo.dataset.mejorasWired) {
      grupo.dataset.mejorasWired = '1';
      grupo.addEventListener('change', onGrupoChanged);
      grupo.style.display = 'none';
      currentGrupoSelect = grupo;

      const existingBar = document.getElementById('mejoras-tabs');
      if (existingBar) {
        // El formulario se ha regenerado pero la barra ya existe y está
        // bien colocada: no la recreamos, solo la resincronizamos con el
        // nuevo <select> (evita el parpadeo de quitarla y reinsertarla).
        highlightActiveTab(existingBar, grupo.value);
      } else {
        buildTabBar(grupo);
      }
    } else {
      currentGrupoSelect = grupo;
    }
    wireEvaluacionListener(evaluacion);
    return true;
  }

  // La página de Séneca recarga el formulario dinámicamente al navegar
  // entre pantallas, así que observamos el DOM en vez de ejecutar una
  // sola vez al cargar.
  const observer = new MutationObserver(() => {
    trySetup();
    repositionTabBar();
    if (armed) scheduleSettleCheck(); // sigue habiendo cambios: retrasamos la comprobación
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  trySetup();
})();