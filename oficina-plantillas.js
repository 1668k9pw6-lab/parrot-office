/* ============================================================
   Parrot Office — plantillas
   ------------------------------------------------------------
   Catálogo de plantillas para los tres programas. Cada plantilla
   es data pura: el programa la carga y queda como un documento
   normal (se puede editar y guardar igual).
   Uso desde la portada o desde el chat de Orión:
     localStorage['parrot-plantilla'] = 'hoja:presupuesto'
   y luego se abre la página del programa, que la aplica al arrancar.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- documentos ---------------- */
  var DOCS = {
    blanco: { nombre: 'Documento en blanco', icono: '📄', datos: { contenido: '' } },

    carta: {
      nombre: 'Carta formal', icono: '✉️',
      datos: {
        contenido:
          '<p>Ciudad y fecha: ______________</p>' +
          '<p>Señor/a<br>Nombre y apellido<br>Cargo · Empresa</p>' +
          '<p>De mi mayor consideración:</p>' +
          '<p>Me dirijo a usted a fin de <b>motivo de la carta</b>. ' +
          'Escribí acá el desarrollo con tus palabras: qué necesitás, ' +
          'desde cuándo, y qué respuesta esperás.</p>' +
          '<p>Sin otro particular, saludo a usted atentamente.</p>' +
          '<p>Firma<br>Nombre y apellido<br>Documento · Teléfono · Correo</p>'
      }
    },

    informe: {
      nombre: 'Informe', icono: '📑',
      datos: {
        contenido:
          '<h1>Informe: [título]</h1>' +
          '<p><b>Autor:</b> tu nombre · <b>Fecha:</b> ' + new Date().toLocaleDateString('es-AR') + ' · <b>Para:</b> destinatario</p>' +
          '<h2>1. Resumen</h2>' +
          '<p>En dos o tres líneas: qué se hizo, qué se encontró y qué se recomienda.</p>' +
          '<h2>2. Desarrollo</h2>' +
          '<p>El cuerpo del informe. Un párrafo por idea, con los datos que la sostienen.</p>' +
          '<blockquote>Dato o cita que quieras destacar.</blockquote>' +
          '<h2>3. Números</h2>' +
          '<ul><li>Primer resultado</li><li>Segundo resultado</li><li>Tercer resultado</li></ul>' +
          '<h2>4. Conclusión y próximos pasos</h2>' +
          '<p>Qué decidís hacer y para cuándo.</p>'
      }
    },

    minuta: {
      nombre: 'Minuta de reunión', icono: '🗓️',
      datos: {
        contenido:
          '<h1>Minuta de reunión</h1>' +
          '<p><b>Fecha:</b> __/__/____ · <b>Hora:</b> __:__ · <b>Lugar:</b> ________</p>' +
          '<p><b>Participantes:</b> ________________________</p>' +
          '<h2>Temas tratados</h2>' +
          '<ol><li>Primer tema</li><li>Segundo tema</li><li>Tercer tema</li></ol>' +
          '<h2>Acuerdos</h2>' +
          '<ul><li>Acuerdo 1 — responsable y fecha</li><li>Acuerdo 2 — responsable y fecha</li></ul>' +
          '<h2>Próxima reunión</h2>' +
          '<p>Fecha y temas pendientes.</p>'
      }
    },

    recibo: {
      nombre: 'Recibo de pago', icono: '🧾',
      datos: {
        contenido:
          '<h1>Recibo</h1>' +
          '<p><b>N°:</b> 0001-________ · <b>Fecha:</b> ' + new Date().toLocaleDateString('es-AR') + '</p>' +
          '<p>Recibí de <b>________________</b> la suma de <b>$__________</b> ' +
          '(________________ pesos) en concepto de ________________________.</p>' +
          '<p><b>Forma de pago:</b> efectivo / transferencia / cheque</p>' +
          '<p>Firma y aclaración</p>'
      }
    }
  };

  /* ---------------- hojas de cálculo ---------------- */
  var HOJAS = {
    blanco: { nombre: 'Hoja en blanco', icono: '📊', datos: { datos: {}, filas: 52 } },

    presupuesto: {
      nombre: 'Presupuesto', icono: '🧮',
      datos: {
        filas: 20,
        datos: {
          A1: { f: 'Presupuesto', b: true }, B1: { f: '' },
          A3: { f: 'Detalle', b: true }, B3: { f: 'Cantidad', b: true },
          C3: { f: 'Precio', b: true }, D3: { f: 'Subtotal', b: true },
          A4: { f: 'Producto o servicio 1' }, B4: { f: '2' }, C4: { f: '1500' }, D4: { f: '=B4*C4', fmt: -1 },
          A5: { f: 'Producto o servicio 2' }, B5: { f: '1' }, C5: { f: '3200' }, D5: { f: '=B5*C5', fmt: -1 },
          A6: { f: 'Producto o servicio 3' }, B6: { f: '4' }, C6: { f: '480' }, D6: { f: '=B6*C6', fmt: -1 },
          A8: { f: 'Subtotal', b: true }, D8: { f: '=SUMA(D4:D6)', fmt: -1 },
          A9: { f: 'IVA 21%' }, D9: { f: '=D8*0.21', fmt: -1 },
          A10: { f: 'TOTAL', b: true }, D10: { f: '=D8+D9', b: true, fmt: -1 },
          A12: { f: 'Validez: 30 días · Los precios incluyen IVA discriminado' }
        }
      }
    },

    gastos: {
      nombre: 'Control de gastos', icono: '💰',
      datos: {
        filas: 25,
        datos: {
          A1: { f: 'Gastos del mes', b: true },
          A3: { f: 'Concepto', b: true }, B3: { f: 'Monto', b: true }, C3: { f: 'Pagado', b: true },
          A4: { f: 'Alquiler' }, B4: { f: '180000', fmt: -1 }, C4: { f: 'Sí' },
          A5: { f: 'Servicios' }, B5: { f: '45000', fmt: -1 }, C5: { f: 'Sí' },
          A6: { f: 'Comida' }, B6: { f: '120000', fmt: -1 }, C6: { f: 'No' },
          A7: { f: 'Transporte' }, B7: { f: '30000', fmt: -1 }, C7: { f: 'No' },
          A9: { f: 'Total gastado', b: true }, B9: { f: '=SUMA(B4:B7)', b: true, fmt: -1 },
          A10: { f: 'Falta pagar' }, B10: { f: '=SUMAR.SI(C4:C7,"No",B4:B7)', fmt: -1 },
          A12: { f: 'Presupuesto del mes' }, B12: { f: '400000', fmt: -1 },
          A13: { f: 'Disponible' }, B13: { f: '=B12-B9', fmt: -1 }
        }
      }
    },

    inventario: {
      nombre: 'Inventario', icono: '📦',
      datos: {
        filas: 25,
        datos: {
          A1: { f: 'Inventario', b: true },
          A3: { f: 'Producto', b: true }, B3: { f: 'Stock', b: true },
          C3: { f: 'Costo', b: true }, D3: { f: 'Valor', b: true },
          A4: { f: 'Artículo 1' }, B4: { f: '10' }, C4: { f: '250', fmt: -1 }, D4: { f: '=B4*C4', fmt: -1 },
          A5: { f: 'Artículo 2' }, B5: { f: '25' }, C5: { f: '90', fmt: -1 }, D5: { f: '=B5*C5', fmt: -1 },
          A6: { f: 'Artículo 3' }, B6: { f: '4' }, C6: { f: '1800', fmt: -1 }, D6: { f: '=B6*C6', fmt: -1 },
          A8: { f: 'Total valorado', b: true }, D8: { f: '=SUMA(D4:D6)', b: true, fmt: -1 },
          A10: { f: 'Productos distintos' }, B10: { f: '=CONTAR(A4:A6)' }
        }
      }
    },

    agenda: {
      nombre: 'Agenda de contactos', icono: '📒',
      datos: {
        filas: 25,
        datos: {
          A1: { f: 'Agenda', b: true },
          A3: { f: 'Nombre', b: true }, B3: { f: 'Teléfono', b: true },
          C3: { f: 'Correo', b: true }, D3: { f: 'Ciudad', b: true },
          A4: { f: 'Contacto 1' }, B4: { f: '11 0000-0000' }, C4: { f: 'uno@correo.com' }, D4: { f: 'Buenos Aires' },
          A5: { f: 'Contacto 2' }, B5: { f: '11 1111-1111' }, C5: { f: 'dos@correo.com' }, D5: { f: 'Córdoba' },
          A7: { f: 'Contactos guardados', b: true }, B7: { f: '=CONTAR(A4:A5)' }
        }
      }
    }
  };

  /* ---------------- presentaciones ---------------- */
  var PRES = {
    blanco: { nombre: 'Presentación en blanco', icono: '🎬', datos: { pres: { diapositivas: [{ fondo: '#ffffff', elementos: [] }], actual: 0 }, contador: 1 } },

    titulo: {
      nombre: 'Portada', icono: '🎯',
      datos: {
        contador: 10,
        pres: {
          diapositivas: [{
            fondo: '#0d1015',
            elementos: [
              { id: 1, tipo: 'texto', x: 120, y: 180, w: 720, h: 90, texto: 'Título de la presentación', color: '#ffffff', bg: 'transparent', size: 44 },
              { id: 2, tipo: 'texto', x: 120, y: 290, w: 720, h: 50, texto: 'Subtítulo o tu nombre · fecha', color: '#17c98a', bg: 'transparent', size: 20 },
              { id: 3, tipo: 'rect', x: 120, y: 160, w: 120, h: 6, texto: '', color: '#ffffff', bg: '#ffc53d', size: 16 }
            ]
          }],
          actual: 0
        }
      }
    },

    tituloContenido: {
      nombre: 'Título y contenido', icono: '📝',
      datos: {
        contador: 10,
        pres: {
          diapositivas: [
            {
              fondo: '#ffffff',
              elementos: [
                { id: 1, tipo: 'texto', x: 80, y: 50, w: 800, h: 60, texto: 'Título de la diapositiva', color: '#111111', bg: 'transparent', size: 36 },
                { id: 2, tipo: 'rect', x: 80, y: 118, w: 90, h: 5, texto: '', color: '#ffffff', bg: '#17c98a', size: 16 },
                { id: 3, tipo: 'texto', x: 80, y: 150, w: 800, h: 320, texto: '· Primer punto\n· Segundo punto\n· Tercer punto', color: '#333333', bg: 'transparent', size: 22 }
              ]
            },
            { fondo: '#ffffff', elementos: [] }
          ],
          actual: 0
        }
      }
    },

    dosColumnas: {
      nombre: 'Dos columnas', icono: '📐',
      datos: {
        contador: 10,
        pres: {
          diapositivas: [{
            fondo: '#ffffff',
            elementos: [
              { id: 1, tipo: 'texto', x: 80, y: 50, w: 800, h: 60, texto: 'Comparar dos cosas', color: '#111111', bg: 'transparent', size: 34 },
              { id: 2, tipo: 'rect', x: 80, y: 140, w: 380, h: 300, texto: 'Columna izquierda', color: '#111111', bg: '#f2f7f4', size: 18 },
              { id: 3, tipo: 'rect', x: 500, y: 140, w: 380, h: 300, texto: 'Columna derecha', color: '#111111', bg: '#eef4f8', size: 18 }
            ]
          }],
          actual: 0
        }
      }
    },

    gracias: {
      nombre: 'Cierre / gracias', icono: '🙏',
      datos: {
        contador: 10,
        pres: {
          diapositivas: [{
            fondo: '#17c98a',
            elementos: [
              { id: 1, tipo: 'texto', x: 180, y: 210, w: 600, h: 90, texto: '¡Gracias!', color: '#ffffff', bg: 'transparent', size: 54 },
              { id: 2, tipo: 'texto', x: 180, y: 310, w: 600, h: 50, texto: '¿Preguntas? · tu@correo.com', color: '#06231a', bg: 'transparent', size: 20 }
            ]
          }],
          actual: 0
        }
      }
    }
  };

  /* ---------------- API ---------------- */
  window.ParrotPlantillas = {

    catalogos: function () {
      return {
        doc:  Object.keys(DOCS).map(function (k) { return { id: k, nombre: DOCS[k].nombre, icono: DOCS[k].icono }; }),
        hoja: Object.keys(HOJAS).map(function (k) { return { id: k, nombre: HOJAS[k].nombre, icono: HOJAS[k].icono }; }),
        pres:  Object.keys(PRES).map(function (k) { return { id: k, nombre: PRES[k].nombre, icono: PRES[k].icono }; })
      };
    },

    // devuelve los datos de la plantilla (copia profunda) o null
    datos: function (app, id) {
      var cat = app === 'doc' ? DOCS : app === 'hoja' ? HOJAS : app === 'pres' ? PRES : null;
      if (!cat || !cat[id]) return null;
      return JSON.parse(JSON.stringify(cat[id].datos));
    },

    nombre: function (app, id) {
      var cat = app === 'doc' ? DOCS : app === 'hoja' ? HOJAS : app === 'pres' ? PRES : null;
      return cat && cat[id] ? cat[id].nombre : (id || 'Plantilla');
    },

    // navega al programa con la plantilla pendiente
    usar: function (app, id) {
      try { localStorage.setItem('parrot-plantilla', app + ':' + id); } catch (e) {}
      var pagina = { doc: 'procesador.html', hoja: 'hoja.html', pres: 'presentaciones.html' }[app];
      location.href = pagina;
    },

    // la llama cada programa al arrancar: aplica la plantilla pendiente si la hay
    consumirPendiente: function (app, aplicar) {
      var pend = null;
      try { pend = localStorage.getItem('parrot-plantilla'); } catch (e) {}
      if (!pend) return null;
      var partes = pend.split(':');
      if (partes[0] !== app) return null;
      try { localStorage.removeItem('parrot-plantilla'); } catch (e) {}
      var d = this.datos(app, partes[1]);
      if (!d) return null;
      aplicar(d);
      return partes[1];
    }
  };
})();
