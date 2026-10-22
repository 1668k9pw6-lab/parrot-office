/* ============================================================
   Parrot Office — menú Archivo centralizado + Compartir + Orión
   ------------------------------------------------------------
   Un solo botón "Archivo" reúne todo lo que antes estaba suelto
   en la barra: Nuevo (con plantillas), Abrir, Guardar, Importar,
   Exportar (TODOS los formatos, con descripción) e Imprimir.
   Además: botón "Compartir" (WhatsApp, correo, copiar, descargar,
   Web Share) y botón "Orión" que abre el chat de ayuda.

   Uso desde cada programa:
     ParrotMenu.montar({
       contenedor: document.querySelector('.acciones'),
       app: 'doc',
       callbacks: { nuevo, abrir, guardar, imprimir,
                    exportar: fn, importar: fn, infoCompartir: fn }
     });
   ============================================================ */
(function () {
  'use strict';

  var menuAbierto = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function cerrarTodo() {
    if (menuAbierto) { menuAbierto.remove(); menuAbierto = null; }
    var hoja = document.getElementById('parrot-share');
    if (hoja) hoja.remove();
  }

  document.addEventListener('click', function (e) {
    if (menuAbierto && !e.target.closest('#parrot-menu') && !e.target.closest('[data-menu-btn]')) cerrarTodo();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarTodo(); });

  /* ---------------- menú desplegable ---------------- */
  function armarMenu(op) {
    var cbs = op.callbacks;
    var caja = el('div', 'parrot-menu', '');

    function seccion(titulo) {
      caja.appendChild(el('div', 'pm-sep', titulo));
    }
    function item(icono, texto, desc, fn, peligro) {
      var b = el('button', 'pm-item' + (peligro ? ' peligro' : ''));
      b.innerHTML = '<span class="pm-ico">' + icono + '</span><span class="pm-txt"><b>' + texto + '</b>' +
        (desc ? '<i>' + desc + '</i>' : '') + '</span>';
      b.addEventListener('click', function () { cerrarTodo(); fn(); });
      caja.appendChild(b);
    }

    // NUEVO
    seccion('Nuevo');
    item('📄', 'En blanco', 'empezar de cero', function () { cbs.nuevo(); });
    (op.plantillas || []).forEach(function (p) {
      item(p.icono, p.nombre, 'plantilla', function () { cbs.plantilla(p.id); });
    });

    // ARCHIVO
    seccion('Archivo');
    item('📂', 'Abrir…', 'traer un archivo de tu PC', function () { cbs.abrir(); });
    item('💾', 'Guardar', 'guarda en este equipo (Ctrl+S)', function () { cbs.guardar(); });

    // IMPORTAR
    if (op.importar && op.importar.length) {
      seccion('Importar');
      op.importar.forEach(function (f) {
        item(f.icono || '📥', f.etiqueta, f.desc || '', function () { cbs.importar(f.id); });
      });
    }

    // EXPORTAR
    if (op.exportar && op.exportar.length) {
      seccion('Exportar');
      op.exportar.forEach(function (f) {
        item(f.icono || '📤', f.etiqueta, f.desc || '', function () { cbs.exportar(f.id); });
      });
    }

    // IMPRIMIR
    seccion('Imprimir');
    item('🖨️', 'Imprimir / PDF', 'o guardar como PDF desde el diálogo', function () { cbs.imprimir(); });

    // COMPARTIR
    seccion('Compartir');
    item('📤', 'Compartir…', 'WhatsApp, correo, copiar, descargar', function () { API.compartir(op); });

    return caja;
  }

  /* ---------------- hoja de compartir ---------------- */
  function compartir(op) {
    cerrarTodo();
    var info = { titulo: 'Documento Parrot', texto: '' };
    try { info = op.callbacks.infoCompartir() || info; } catch (e) {}

    var fondo = el('div', 'parrot-share-fondo');
    fondo.id = 'parrot-share';
    var hoja = el('div', 'parrot-share');
    hoja.innerHTML =
      '<div class="ps-cabeza"><b>Compartir</b><button class="ps-x" title="Cerrar">✕</button></div>' +
      '<div class="ps-sub">' + (info.titulo || 'Documento Parrot') + '</div>';

    function fila(icono, nombre, desc, fn) {
      var b = el('button', 'ps-item');
      b.innerHTML = '<span class="ps-ico">' + icono + '</span><span class="ps-txt"><b>' + nombre + '</b><i>' + desc + '</i></span>';
      b.addEventListener('click', function () { fn(); });
      hoja.appendChild(b);
    }

    fila('💬', 'WhatsApp', 'enviar el texto por WhatsApp', function () {
      var url = 'https://wa.me/?text=' + encodeURIComponent(info.texto || info.titulo || '');
      window.open(url, '_blank');
      fondo.remove();
    });
    fila('✉️', 'Correo', 'abre tu programa de correo', function () {
      location.href = 'mailto:?subject=' + encodeURIComponent(info.titulo || 'Documento Parrot') +
        '&body=' + encodeURIComponent(info.texto || '');
      fondo.remove();
    });
    fila('📋', 'Copiar al portapapeles', 'copiar el texto', function () {
      var listo = function () { flash('Texto copiado al portapapeles'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(info.texto || '').then(listo, function () { flash('No pude copiar'); });
      } else { flash('Este navegador no deja copiar automático'); }
      fondo.remove();
    });
    if (info.archivo && info.archivo.blob) {
      fila('💾', 'Descargar archivo', (info.archivo.nombre || 'archivo') + ' — se abre con doble clic', function () {
        window.ParrotZip.descargar(info.archivo.nombre || 'parrot-archivo', info.archivo.blob);
        flash('Descargado: ' + (info.archivo.nombre || 'archivo') + ' ( Abrilo con doble clic en Excel/Word)');
        fondo.remove();
      });
    }
    if (navigator.share) {
      fila('📲', 'Otras aplicaciones', 'usar el compartir del sistema', function () {
        var datos = { title: info.titulo || 'Parrot Office', text: info.texto || '' };
        if (info.archivo && info.archivo.blob && window.File && navigator.canShare && navigator.canShare({ files: [new File([info.archivo.blob], info.archivo.nombre || 'archivo')] })) {
          datos.files = [new File([info.archivo.blob], info.archivo.nombre || 'archivo')];
        }
        navigator.share(datos).catch(function () {});
        fondo.remove();
      });
    }
    var nota = el('div', 'ps-nota',
      'Para abrir directamente en Excel o Word: descargá el archivo y abrilo con doble clic — Windows lo abre con el programa que corresponda.');
    hoja.appendChild(nota);

    hoja.querySelector('.ps-x').addEventListener('click', function () { fondo.remove(); });
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    fondo.appendChild(hoja);
    document.body.appendChild(fondo);
  }

  function flash(msg) {
    var e = document.getElementById('estado');
    if (!e) return;
    e.textContent = msg;
    setTimeout(function () { e.textContent = 'Listo'; }, 2600);
  }

  /* ---------------- API ---------------- */
  var API = {

    montar: function (op) {
      var cont = op.contenedor || document.querySelector('.acciones');
      if (!cont) return;

      // botón Archivo
      var bArchivo = el('button', 'pm-btn', '📂 Archivo');
      bArchivo.setAttribute('data-menu-btn', '1');
      bArchivo.addEventListener('click', function (e) {
        e.stopPropagation();
        if (menuAbierto) { cerrarTodo(); return; }
        var m = armarMenu(op);
        m.id = 'parrot-menu';
        var r = bArchivo.getBoundingClientRect();
        m.style.top = (r.bottom + 6) + 'px';
        m.style.left = Math.max(8, r.left) + 'px';
        document.body.appendChild(m);
        menuAbierto = m;
      });
      cont.insertBefore(bArchivo, cont.firstChild);

      // botón Compartir
      var bComp = el('button', 'pm-btn', '↗ Compartir');
      bComp.addEventListener('click', function (e) { e.stopPropagation(); compartir(op); });
      cont.insertBefore(bComp, bArchivo.nextSibling);

      // botón Orión
      var bOri = el('button', 'pm-btn orion', '💬 Orión');
      bOri.title = 'Chatear con Orión: pedir ayuda, crear documentos, hojas o presentaciones';
      bOri.addEventListener('click', function () {
        window.open('chat.html', 'orion_chat', 'width=480,height=720,popup=yes');
      });
      cont.insertBefore(bOri, bComp.nextSibling);
    },

    compartir: compartir,
    cerrar: cerrarTodo
  };

  window.ParrotMenu = API;
})();
