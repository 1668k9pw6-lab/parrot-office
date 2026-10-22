/* ============================================================
   Parrot Office — historial de documentos (estilo Office)
   ------------------------------------------------------------
   Guarda en esta PC (localStorage) un registro de lo que fuiste
   creando o abriendo, con vista previa, tamaño y fecha.
   · registrar(): llama cada programa cuando guardás o abrís algo
   · listar():   la portada arma la sección "Recientes"
   · fijar():    un documento clavado arriba (como el pin de Office)
   · quitar() / limpiar(): sacar del historial (no borra el archivo)
   Cupo: máximo 30 documentos en total; si el almacenamiento se
   llena, se descartan los más viejos que no estén fijados.
   ============================================================ */
(function () {
  'use strict';

  var LS = 'parrot-historial';
  var MAX_TOTAL = 30;
  var MAX_PREVIA = 90;

  var APPS = {
    doc:  { nombre: 'Documento',      icono: '📄', pagina: 'procesador.html' },
    hoja: { nombre: 'Hoja de cálculo', icono: '📊', pagina: 'hoja.html' },
    pres: { nombre: 'Presentación',   icono: '🎬', pagina: 'presentaciones.html' }
  };

  function leer() {
    try { var v = localStorage.getItem(LS); var a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function escribir(lista) {
    // si no entra todo, descartar los más viejos sin fijar hasta que entre
    while (true) {
      try { localStorage.setItem(LS, JSON.stringify(lista)); return true; }
      catch (e) {
        var i = ultimaSinFijar(lista);
        if (i < 0) return false;
        lista.splice(i, 1);
      }
    }
  }
  function ultimaSinFijar(lista) {
    for (var i = lista.length - 1; i >= 0; i--) if (!lista[i].fijado) return i;
    return -1;
  }

  function textoDe(item) {
    try {
      if (item.app === 'doc') {
        var d = document.createElement('div');
        d.innerHTML = item.datos.contenido || '';
        return (d.innerText || '').replace(/\s+/g, ' ').trim();
      }
      if (item.app === 'hoja') {
        var vals = Object.keys(item.datos.datos || {}).map(function (r) { return String(item.datos.datos[r].f || ''); });
        return vals.join(' · ').replace(/\s+/g, ' ').trim();
      }
      if (item.app === 'pres') {
        var t = [];
        (item.datos.pres.diapositivas || []).forEach(function (d) {
          d.elementos.forEach(function (el) { if (el.texto) t.push(el.texto); });
        });
        return t.join(' · ').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}
    return '';
  }

  function bytes(item) {
    try { return JSON.stringify(item.datos).length; } catch (e) { return 0; }
  }

  function tamano(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function fechaRelativa(iso) {
    var f = new Date(iso);
    var dif = Date.now() - f.getTime();
    var min = Math.round(dif / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return 'hace ' + min + ' min';
    var hs = Math.round(min / 60);
    if (hs < 24) return 'hace ' + hs + ' h';
    var dias = Math.round(hs / 24);
    if (dias === 1) return 'ayer';
    if (dias < 30) return 'hace ' + dias + ' días';
    return f.toLocaleDateString('es-AR');
  }

  var API = {

    apps: APPS,

    /* registrar o actualizar: {app, nombre, datos, id?} */
    registrar: function (item) {
      if (!item || !APPS[item.app] || !item.datos) return null;
      var lista = leer();
      var ahora = new Date().toISOString();
      var id = item.id || ('h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      var previo = null;
      for (var i = 0; i < lista.length; i++) if (lista[i].id === id) previo = lista[i];

      var registro = {
        id: id,
        app: item.app,
        nombre: (item.nombre || 'Sin nombre').slice(0, 80),
        fecha: ahora,
        fijado: previo ? previo.fijado : false,
        datos: item.datos
      };
      registro.previa = textoDe(registro).slice(0, MAX_PREVIA) || '(vacío)';
      registro.bytes = bytes(registro);

      // reemplazar si ya existía
      var nueva = lista.filter(function (x) { return x.id !== id; });
      nueva.unshift(registro);
      // recortar por app (máximo 12 por programa)
      var porApp = {};
      nueva = nueva.filter(function (x) {
        porApp[x.app] = (porApp[x.app] || 0) + 1;
        return porApp[x.app] <= 12;
      });
      // recortar total
      while (nueva.length > MAX_TOTAL) {
        var k = ultimaSinFijar(nueva);
        if (k < 0) break;
        nueva.splice(k, 1);
      }
      escribir(nueva);
      return registro;
    },

    listar: function (filtroApp) {
      var lista = leer();
      if (filtroApp) lista = lista.filter(function (x) { return x.app === filtroApp; });
      return lista.map(function (x) {
        return {
          id: x.id, app: x.app, nombre: x.nombre, fecha: x.fecha,
          fijado: !!x.fijado, previa: x.previa, bytes: x.bytes,
          icono: (APPS[x.app] || {}).icono || '📄',
          appNombre: (APPS[x.app] || {}).nombre || x.app,
          pagina: (APPS[x.app] || {}).pagina || 'index.html',
          fechaTexto: fechaRelativa(x.fecha),
          tamanoTexto: tamano(x.bytes || 0)
        };
      });
    },

    porId: function (id) {
      var lista = leer();
      for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
      return null;
    },

    fijar: function (id) {
      var lista = leer();
      for (var i = 0; i < lista.length; i++) if (lista[i].id === id) lista[i].fijado = !lista[i].fijado;
      escribir(lista);
    },

    quitar: function (id) {
      escribir(leer().filter(function (x) { return x.id !== id; }));
    },

    limpiar: function (filtroApp) {
      if (!filtroApp) { escribir([]); return; }
      escribir(leer().filter(function (x) { return x.app !== filtroApp; }));
    }
  };

  window.ParrotHistorial = API;
})();
