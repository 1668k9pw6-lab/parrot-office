/* Parrot Office — lectura de formatos reales: ZIP, DOCX, XLSX, PPTX, PDF.
   Usa oficina-inflate.js (deflate propio) para abrir archivos hechos por
   Word, Excel y PowerPoint de verdad. */
(function () {
  'use strict';
  const INF = window.ParrotInflate;

  function bytesABase64(u8) {
    let s = '';
    const trozo = 0x8000;
    for (let i = 0; i < u8.length; i += trozo) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + trozo));
    }
    return btoa(s);
  }

  // ---------- ZIP ----------
  function leerZip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('No es un archivo ZIP valido');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const archivos = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const nombre = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      const lnlen = dv.getUint16(lho + 26, true);
      const lelen = dv.getUint16(lho + 28, true);
      const inicio = lho + 30 + lnlen + lelen;
      const datos = u8.subarray(inicio, inicio + csize);
      archivos[nombre] = { metodo: metodo, datos: datos };
      p += 46 + nlen + elen + clen;
    }
    return archivos;
  }

  function zipATexto(z, nombre) {
    if (!z[nombre]) throw new Error('Falta ' + nombre);
    const e = z[nombre];
    const plano = e.metodo === 8 ? INF.auto(e.datos) : e.datos;
    return new TextDecoder().decode(plano);
  }

  function zipABytes(z, nombre) {
    if (!z[nombre]) throw new Error('Falta ' + nombre);
    const e = z[nombre];
    return e.metodo === 8 ? INF.auto(e.datos) : e.datos;
  }

  // ---------- XML helpers ----------
  function parseXML(xml) {
    return new DOMParser().parseFromString(xml, 'application/xml');
  }
  function hijos(n, tag) {
    const out = [];
    for (const c of n.children) if (c.tagName === tag) out.push(c);
    return out;
  }
  function textoDe(n) {
    if (!n) return '';
    if (n.textContent !== undefined) return n.textContent;
    return '';
  }

  // ---------- DOCX -> HTML ----------
  function docxAHTML(buf) {
    const z = leerZip(buf);
    const docXml = parseXML(zipATexto(z, 'word/document.xml'));
    // relaciones de imagenes
    const media = {};
    try {
      const rels = parseXML(zipATexto(z, 'word/_rels/document.xml.rels'));
      for (const r of rels.getElementsByTagName('*')) {
        const id = r.getAttribute('Id'), tipo = r.getAttribute('Type') || '', tgt = r.getAttribute('Target') || '';
        if (tipo.indexOf('/image') >= 0 && id) media[id] = tgt.replace(/^\/?/, '');
      }
    } catch (e) {}
    const imagenes = {};
    for (const id in media) {
      try {
        const bytes = zipABytes(z, 'word/' + media[id]);
        const mime = /\.png$/i.test(media[id]) ? 'image/png' : /\.jpe?g$/i.test(media[id]) ? 'image/jpeg' : /\.gif$/i.test(media[id]) ? 'image/gif' : 'image/png';
        imagenes[id] = 'data:' + mime + ';base64,' + bytesABase64(bytes);
      } catch (e) {}
    }

    function runHTML(rPr, contenido) {
      let est = '';
      if (rPr) {
        if (hijos(rPr, 'w:b').length || rPr.getElementsByTagName('w:b').length) est += 'font-weight:700;';
        if (rPr.getElementsByTagName('w:i').length) est += 'font-style:italic;';
        if (rPr.getElementsByTagName('w:u').length) est += 'text-decoration:underline;';
        if (rPr.getElementsByTagName('w:strike').length) est += 'text-decoration:line-through;';
        const col = rPr.getElementsByTagName('w:color')[0];
        if (col && col.getAttribute('w:val')) est += 'color:#' + col.getAttribute('w:val') + ';';
        const sz = rPr.getElementsByTagName('w:sz')[0];
        if (sz && sz.getAttribute('w:val')) est += 'font-size:' + (parseInt(sz.getAttribute('w:val'), 10) / 2) + 'pt;';
        const fu = rPr.getElementsByTagName('w:rFonts')[0];
        if (fu && fu.getAttribute('w:ascii')) est += "font-family:'" + fu.getAttribute('w:ascii') + "',sans-serif;";
      }
      return est ? '<span style="' + est + '">' + contenido + '</span>' : contenido;
    }

    function parrafoHTML(p) {
      const pPr = p.getElementsByTagName('w:pPr')[0];
      let tag = 'p', estilo = '';
      if (pPr) {
        const st = pPr.getElementsByTagName('w:pStyle')[0];
        if (st) {
          const v = st.getAttribute('w:val') || '';
          if (/^Heading1$/i.test(v)) tag = 'h1';
          else if (/^Heading2$/i.test(v)) tag = 'h2';
          else if (/^Heading3$/i.test(v)) tag = 'h3';
          else if (/^Heading4$/i.test(v)) tag = 'h4';
          else if (/Title/i.test(v)) tag = 'h1';
          else if (/Quote/i.test(v)) estilo += 'font-style:italic;color:#4e5d6c;border-left:3px solid #1db954;padding-left:12px;';
          else if (/Code/i.test(v)) estilo += "font-family:Consolas,monospace;background:#f2f4f4;border:1px solid #d5dbdb;padding:6px 10px;font-size:10.5pt;";
        }
        const jc = pPr.getElementsByTagName('w:jc')[0];
        if (jc && jc.getAttribute('w:val')) {
          const v = jc.getAttribute('w:val');
          estilo += 'text-align:' + (v === 'center' ? 'center' : v === 'right' ? 'right' : v === 'both' ? 'justify' : 'left') + ';';
        }
        if (pPr.getElementsByTagName('w:numPr').length) estilo += 'margin-left:26px;';
      }
      let inner = '';
      for (const n of p.childNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === 'w:r') {
          const rPr = n.getElementsByTagName('w:rPr')[0];
          // imagen?
          const blip = n.getElementsByTagName('a:blip')[0];
          if (blip && blip.getAttribute('r:embed') && imagenes[blip.getAttribute('r:embed')]) {
            inner += '<img src="' + imagenes[blip.getAttribute('r:embed')] + '" style="max-width:100%">';
            continue;
          }
          let txt = '';
          for (const t of n.getElementsByTagName('w:t')) txt += textoDe(t);
          for (const br of n.getElementsByTagName('w:br')) txt += '<br>';
          if (txt) inner += runHTML(rPr, txt.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
        } else if (n.tagName === 'w:hyperlink') {
          let txt = '';
          for (const t of n.getElementsByTagName('w:t')) txt += textoDe(t);
          if (txt) inner += '<span style="color:#1155cc">' + txt.replace(/&/g, '&amp;') + '</span>';
        }
      }
      if (!inner.trim()) inner = '&nbsp;';
      return '<' + tag + (estilo ? ' style="' + estilo + '"' : '') + '>' + inner + '</' + tag + '>';
    }

    function tablaHTML(tbl) {
      let h = '<table style="border-collapse:collapse;width:100%">';
      for (const tr of tbl.getElementsByTagName('w:tr')) {
        h += '<tr>';
        for (const tc of tr.getElementsByTagName('w:tc')) {
          const esHead = tc.getElementsByTagName('w:tblHeader').length > 0;
          let celdas = '';
          for (const p of tc.getElementsByTagName('w:p')) celdas += parrafoHTML(p);
          h += '<' + (esHead ? 'th' : 'td') + ' style="border:1px solid #9aa5a5;padding:5px 9px' + (esHead ? ';background:#eaf7ef;font-weight:700' : '') + '">' + celdas + '</' + (esHead ? 'th' : 'td') + '>';
        }
        h += '</tr>';
      }
      return h + '</table><p><br></p>';
    }

    const body = docXml.getElementsByTagName('w:body')[0];
    let html = '';
    if (!body) throw new Error('El documento no tiene cuerpo');
    for (const n of body.children) {
      if (n.tagName === 'w:p') html += parrafoHTML(n);
      else if (n.tagName === 'w:tbl') html += tablaHTML(n);
    }
    return html || '<p>(documento vacio)</p>';
  }

  // ---------- XLSX -> modelo de la hoja ----------
  function xlsxADatos(buf) {
    const z = leerZip(buf);
    const ss = [];
    try {
      const sst = parseXML(zipATexto(z, 'xl/sharedStrings.xml'));
      for (const si of sst.getElementsByTagName('si')) {
        let t = '';
        for (const r of si.getElementsByTagName('t')) t += textoDe(r);
        ss.push(t);
      }
    } catch (e) {}
    const xfs = [];
    try {
      const st = parseXML(zipATexto(z, 'xl/styles.xml'));
      const fonts = [], fills = [];
      for (const f of st.getElementsByTagName('fonts')[0] ? st.getElementsByTagName('fonts')[0].children : []) {
        const col = f.getElementsByTagName('color')[0];
        fonts.push({
          b: f.getElementsByTagName('b').length > 0,
          i: f.getElementsByTagName('i').length > 0,
          c: col && col.getAttribute('rgb') ? '#' + col.getAttribute('rgb').slice(-6) : null
        });
      }
      for (const f of st.getElementsByTagName('fills')[0] ? st.getElementsByTagName('fills')[0].children : []) {
        const fg = f.getElementsByTagName('fgColor')[0];
        fills.push(fg && fg.getAttribute('rgb') ? '#' + fg.getAttribute('rgb').slice(-6) : null);
      }
      const cellXfs = st.getElementsByTagName('cellXfs')[0];
      if (cellXfs) for (const xf of cellXfs.children) {
        const nf = xf.getAttribute('numFmtId');
        let fmt = null;
        if (nf === '164' || nf === '3') fmt = -1;
        else if (nf === '165' || nf === '1') fmt = 0;
        else if (nf === '166' || nf === '2' || nf === '9' || nf === '10') fmt = 2;
        const fi = parseInt(xf.getAttribute('fontId') || '0', 10);
        const fli = parseInt(xf.getAttribute('fillId') || '0', 10);
        const fu = fonts[fi] || {};
        xfs.push({ b: fu.b || undefined, i: fu.i || undefined, c: fu.c || undefined, bg: fills[fli] || undefined, fmt: fmt });
      }
    } catch (e) {}

    const datos = {};
    let filaMax = 0;
    // buscar la primer hoja
    let sheetNombre = 'xl/worksheets/sheet1.xml';
    try {
      const wb = parseXML(zipATexto(z, 'xl/workbook.xml'));
      const rels = parseXML(zipATexto(z, 'xl/_rels/workbook.xml.rels'));
      const rid = wb.getElementsByTagName('sheet')[0] && wb.getElementsByTagName('sheet')[0].getAttribute('r:id');
      if (rid) for (const r of rels.getElementsByTagName('*')) {
        if (r.getAttribute('Id') === rid) {
          let t = (r.getAttribute('Target') || '').replace(/^\.\//, '').replace(/^\//, '');
          sheetNombre = /^xl\//.test(t) ? t : 'xl/' + t;
        }
      }
    } catch (e) {}

    const sheet = parseXML(zipATexto(z, sheetNombre));
    for (const row of sheet.getElementsByTagName('row')) {
      for (const c of row.getElementsByTagName('c')) {
        const ref = c.getAttribute('r');
        if (!ref) continue;
        const t = c.getAttribute('t');
        const st = xfs[parseInt(c.getAttribute('s') || '0', 10)] || {};
        const fEl = c.getElementsByTagName('f')[0];
        const vEl = c.getElementsByTagName('v')[0];
        let valor = vEl ? textoDe(vEl) : '';
        const cel = {};
        if (fEl) cel.f = '=' + textoDe(fEl);
        else if (t === 's') { const idx = parseInt(valor, 10); cel.f = ss[idx] !== undefined ? ss[idx] : ''; }
        else if (t === 'str') cel.f = valor;
        else if (t === 'b') cel.f = valor === '1' ? 'VERDADERO' : 'FALSO';
        else if (t === 'inlineStr') { let s = ''; for (const tt of c.getElementsByTagName('t')) s += textoDe(tt); cel.f = s; }
        else cel.f = valor;
        if (cel.f === '' || cel.f === undefined) continue;
        if (st.b) cel.b = true;
        if (st.i) cel.i = true;
        if (st.c) cel.c = st.c;
        if (st.bg) cel.bg = st.bg;
        if (st.fmt !== null && st.fmt !== undefined) cel.fmt = st.fmt;
        datos[ref] = cel;
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        if (m) filaMax = Math.max(filaMax, parseInt(m[2], 10));
      }
    }
    return { datos: datos, filas: Math.max(filaMax + 5, 52) };
  }

  // ---------- PPTX -> modelo de presentaciones ----------
  function pptxAPres(buf) {
    const z = leerZip(buf);
    const EMU = 9525;
    const presRels = parseXML(zipATexto(z, 'ppt/_rels/presentation.xml.rels'));
    const mapa = {};
    for (const r of presRels.getElementsByTagName('*')) {
      if ((r.getAttribute('Type') || '').indexOf('/slide') >= 0) mapa[r.getAttribute('Id')] = r.getAttribute('Target');
    }
    const presXml = parseXML(zipATexto(z, 'ppt/presentation.xml'));
    const diapositivas = [];
    let contador = 1;
    for (const sld of presXml.getElementsByTagName('p:sldId')) {
      const rid = sld.getAttribute('r:id');
      let ruta = (mapa[rid] || '').replace(/^\.\//, '').replace(/^\//, '');
      if (!ruta) continue;
      const slideXml = parseXML(zipATexto(z, 'ppt/' + ruta));
      // relaciones de imagen del slide
      const imgs = {};
      const relRuta = 'ppt/slides/_rels/' + ruta.split('/').pop() + '.rels';
      if (z[relRuta]) {
        const rels = parseXML(zipATexto(z, relRuta));
        for (const r of rels.getElementsByTagName('*')) {
          if ((r.getAttribute('Type') || '').indexOf('/image') >= 0) imgs[r.getAttribute('Id')] = r.getAttribute('Target').replace(/^\.\//, '').replace(/^\//, '');
        }
      }
      function imgDataURL(rid2) {
        try {
          const p = imgs[rid2];
          if (!p) return null;
          const bytes = zipABytes(z, 'ppt/media/' + p.split('/').pop());
          const mime = /\.png$/i.test(p) ? 'image/png' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/gif';
          return 'data:' + mime + ';base64,' + bytesABase64(bytes);
        } catch (e) { return null; }
      }
      // fondo
      let fondo = '#ffffff';
      const bg = slideXml.getElementsByTagName('p:bg')[0];
      if (bg) {
        const clr = bg.getElementsByTagName('a:srgbClr')[0];
        if (clr && clr.getAttribute('val')) fondo = '#' + clr.getAttribute('val');
      }
      const elementos = [];
      for (const sp of slideXml.getElementsByTagName('p:sp')) {
        const xfrm = sp.getElementsByTagName('a:xfrm')[0];
        const off = xfrm ? xfrm.getElementsByTagName('a:off')[0] : null;
        const ext = xfrm ? xfrm.getElementsByTagName('a:ext')[0] : null;
        if (!off || !ext) continue;
        const geom = sp.getElementsByTagName('a:prstGeom')[0];
        const prst = geom ? geom.getAttribute('prst') : 'rect';
        const solid = sp.getElementsByTagName('a:solidFill')[0];
        const clrBg = solid ? solid.getElementsByTagName('a:srgbClr')[0] : null;
        // color de texto
        let color = '#111111';
        const rPr = sp.getElementsByTagName('a:rPr')[0];
        if (rPr) { const c = rPr.getElementsByTagName('a:srgbClr')[0]; if (c && c.getAttribute('val')) color = '#' + c.getAttribute('val'); }
        // tamaño de fuente
        let size = 16;
        if (rPr && rPr.getAttribute('sz')) size = Math.round(parseInt(rPr.getAttribute('sz'), 10) / 75);
        // texto
        let texto = '';
        const ps = sp.getElementsByTagName('a:p');
        const lineas = [];
        for (const p of ps) {
          let l = '';
          for (const r of p.getElementsByTagName('a:r')) { const t = r.getElementsByTagName('a:t')[0]; if (t) l += textoDe(t); }
          lineas.push(l);
        }
        texto = lineas.join('\n');
        if (!texto.trim() && prst !== 'rect' && prst !== 'roundRect') continue;
        const el = {
          id: contador++,
          tipo: prst === 'ellipse' ? 'circulo' : (prst === 'rect' || prst === 'roundRect' ? 'rect' : 'texto'),
          x: Math.round(parseInt(off.getAttribute('x') || '0', 10) / EMU),
          y: Math.round(parseInt(off.getAttribute('y') || '0', 10) / EMU),
          w: Math.max(20, Math.round(parseInt(ext.getAttribute('cx') || '100', 10) / EMU)),
          h: Math.max(20, Math.round(parseInt(ext.getAttribute('cy') || '100', 10) / EMU)),
          texto: texto,
          color: color,
          bg: (prst === 'rect' || prst === 'roundRect' || prst === 'ellipse') && clrBg && clrBg.getAttribute('val') ? '#' + clrBg.getAttribute('val') : 'transparent',
          size: size
        };
        elementos.push(el);
      }
      for (const pic of slideXml.getElementsByTagName('p:pic')) {
        const xfrm = pic.getElementsByTagName('a:xfrm')[0];
        const off = xfrm ? xfrm.getElementsByTagName('a:off')[0] : null;
        const ext = xfrm ? xfrm.getElementsByTagName('a:ext')[0] : null;
        const blip = pic.getElementsByTagName('a:blip')[0];
        if (!off || !ext || !blip) continue;
        const src = imgDataURL(blip.getAttribute('r:embed'));
        if (!src) continue;
        elementos.push({
          id: contador++, tipo: 'imagen', src: src,
          x: Math.round(parseInt(off.getAttribute('x') || '0', 10) / EMU),
          y: Math.round(parseInt(off.getAttribute('y') || '0', 10) / EMU),
          w: Math.max(20, Math.round(parseInt(ext.getAttribute('cx') || '100', 10) / EMU)),
          h: Math.max(20, Math.round(parseInt(ext.getAttribute('cy') || '100', 10) / EMU)),
          texto: '', color: '#111111', bg: 'transparent', size: 16
        });
      }
      diapositivas.push({ fondo: fondo, elementos: elementos });
    }
    if (!diapositivas.length) diapositivas.push({ fondo: '#ffffff', elementos: [] });
    return { diapositivas: diapositivas, actual: 0, contador: contador };
  }

  // ---------- PDF -> texto (basico pero honrado) ----------
  // Estrategia: abrir el PDF como objetos, decodificar cada stream segun su
  // /Filter real (Flate, ASCII85, ASCIIHex), y mapear los codigos de caracter
  // con el CMap ToUnicode de LA FUENTE que esta activa en ese momento (Tf).
  function pdfATexto(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const latin = new TextDecoder('latin1');
    const texto = latin.decode(u8);

    // ===== decodificadores de filtros PDF =====
    function a85(datos) {
      const t = latin.decode(datos);
      let s = '';
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c !== '\n' && c !== '\r' && c !== ' ' && c !== '\t' && c !== '\f' && c !== '\0') s += c;
      }
      const fin = s.indexOf('~>');
      if (fin >= 0) s = s.slice(0, fin);
      const out = [];
      let grupo = [];
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === 'z' && grupo.length === 0) { out.push(0, 0, 0, 0); continue; }
        const v = c.charCodeAt(0) - 33;
        if (v < 0 || v > 84) continue;
        grupo.push(v);
        if (grupo.length === 5) {
          let x = 0;
          for (let k = 0; k < 5; k++) x = x * 85 + grupo[k];
          out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
          grupo = [];
        }
      }
      if (grupo.length) {
        const faltan = 5 - grupo.length;
        while (grupo.length < 5) grupo.push(84);
        let x = 0;
        for (let k = 0; k < 5; k++) x = x * 85 + grupo[k];
        const b = [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255];
        for (let k = 0; k < faltan - 1; k++) out.push(b[k]);
      }
      return new Uint8Array(out);
    }
    function aHex(datos) {
      const t = latin.decode(datos).replace(/[^0-9A-Fa-f]/g, '');
      const out = [];
      for (let i = 0; i + 1 < t.length; i += 2) out.push(parseInt(t.substr(i, 2), 16));
      return new Uint8Array(out);
    }
    // filtros declarados en el diccionario que precede al stream
    function filtrosDe(posStream) {
      let ini = texto.lastIndexOf('<<', posStream);
      if (ini < 0 || posStream - ini > 900) return [];
      const m = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(texto.slice(ini, posStream));
      if (!m) return [];
      return (m[1].match(/\/[A-Za-z0-9]+/g) || []);
    }
    function decodificar(trozo, filtros) {
      let datos = trozo;
      for (let i = 0; i < filtros.length; i++) {
        const f = filtros[i];
        if (f === '/FlateDecode') {
          try { datos = INF.auto(datos); } catch (e) { return null; }
        } else if (f === '/ASCII85Decode') {
          datos = a85(datos);
        } else if (f === '/ASCIIHexDecode') {
          datos = aHex(datos);
        } else if (f === '/LZWDecode' || f === '/DCTDecode' || f === '/CCITTFaxDecode' || f === '/JBIG2Decode' || f === '/JPXDecode') {
          return null;
        }
      }
      return datos;
    }
    function pareceTexto(datos) {
      if (!datos || !datos.length) return false;
      let buenos = 0;
      const t = latin.decode(datos.subarray(0, Math.min(datos.length, 500)));
      for (const c of t) {
        const k = c.charCodeAt(0);
        if ((k >= 32 && k < 127) || k === 10 || k === 13 || k === 9) buenos++;
      }
      return buenos / t.length > 0.85;
    }

    // ===== 1) objetos del PDF: diccionario + stream decodificado =====
    const marcaObj = [];
    const reObj = /(\d+)\s+\d+\s+obj\b/g;
    let mo;
    while ((mo = reObj.exec(texto)) !== null) {
      marcaObj.push({ num: parseInt(mo[1], 10), ini: mo.index, pos: mo.index + mo[0].length });
    }
    const objs = {};
    for (let k = 0; k < marcaObj.length; k++) {
      const mk = marcaObj[k];
      const e1 = texto.indexOf('endobj', mk.pos);
      const e2 = k + 1 < marcaObj.length ? marcaObj[k + 1].ini : texto.length;
      const corte = e1 < 0 ? e2 : Math.min(e1, e2);
      objs[mk.num] = { dict: texto.slice(mk.pos, corte), plano: '' };
    }

    let pos = 0, cuenta = 0;
    while (cuenta < 900) {
      const i = texto.indexOf('stream', pos);
      if (i < 0) break;
      if (i >= 3 && texto.slice(i - 3, i) === 'end') { pos = i + 6; continue; }
      let j = i + 6;
      if (texto[j] === '\r') j++;
      if (texto[j] !== '\n') { pos = i + 6; continue; }
      const inicio = j + 1;
      let fin = texto.indexOf('endstream', inicio);
      if (fin < 0) break;
      let ini = texto.lastIndexOf('<<', i);
      if (ini >= 0 && i - ini < 900) {
        const mL = /\/Length\s+(\d+)/.exec(texto.slice(ini, i));
        if (mL) {
          const L = parseInt(mL[1], 10);
          if (L > 0 && inicio + L <= fin) fin = inicio + L;
        }
      }
      while (fin > inicio && (texto[fin - 1] === '\n' || texto[fin - 1] === '\r')) fin--;
      const trozo = u8.subarray(inicio, fin);
      pos = fin;
      while (texto[pos] === '\n' || texto[pos] === '\r') pos++;
      cuenta++;
      let num = 0;
      for (let k = marcaObj.length - 1; k >= 0; k--) { if (marcaObj[k].pos <= inicio) { num = marcaObj[k].num; break; } }
      let plano = decodificar(trozo, filtrosDe(i));
      if (plano === null || !pareceTexto(plano)) {
        const intentos = [
          function () { return INF.auto(trozo); },
          function () { return INF.auto(a85(trozo)); },
          function () { return INF.auto(aHex(trozo)); },
          function () { return a85(trozo); },
          function () { return aHex(trozo); }
        ];
        plano = null;
        for (let q = 0; q < intentos.length; q++) {
          try { const r = intentos[q](); if (r && pareceTexto(r)) { plano = r; break; } } catch (e) {}
        }
        if (plano === null) continue;
      }
      if (!objs[num]) objs[num] = { dict: ini >= 0 ? texto.slice(ini, inicio) : '', plano: '' };
      objs[num].plano = latin.decode(plano);
    }

    // ===== 2) CMaps ToUnicode, uno por objeto =====
    function parseCMap(txt) {
      const m = {};
      let g;
      // OJO: hay que acotar a los bloques beginbfchar/endbfchar y
      // beginbfrange/endbfrange. Si no, el regex de 3 grupos se come las
      // entradas bfchar (estan separadas por saltos de linea) y las pisa.
      const reB = /beginbfchar([\s\S]*?)endbfchar/g;
      while ((g = reB.exec(txt)) !== null) {
        const cuerpo = g[1];
        const reChar = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
        let c;
        while ((c = reChar.exec(cuerpo)) !== null) {
          if (c[2].length <= 4) m[parseInt(c[1], 16)] = parseInt(c[2], 16);
        }
      }
      const reR = /beginbfrange([\s\S]*?)endbfrange/g;
      while ((g = reR.exec(txt)) !== null) {
        const cuerpo = g[1];
        const reRange = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
        let c;
        while ((c = reRange.exec(cuerpo)) !== null) {
          const a = parseInt(c[1], 16), b = parseInt(c[2], 16), d = parseInt(c[3], 16);
          for (let k = a; k <= b && k - a < 65536; k++) m[k] = d + (k - a);
        }
      }
      return m;
    }
    const cidPorObj = {};
    for (const n in objs) {
      const t = objs[n].plano;
      if (t && /beginbfchar|beginbfrange/.test(t)) cidPorObj[n] = parseCMap(t);
    }

    // ===== 3) fuentes: numero de objeto -> su CMap y su ancho de codigo =====
    const fuentePorObj = {};
    for (const n in objs) {
      const m = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(objs[n].dict);
      if (m && cidPorObj[m[1]]) {
        fuentePorObj[n] = { mapa: cidPorObj[m[1]], ancho: /\/Encoding\s*\/Identity-[HV]/.test(objs[n].dict) ? 2 : 1 };
      }
    }
    // fuentes sin ToUnicode: se usa el nombre base como ultimo recurso
    function fuentesDe(dict) {
      const out = {};
      const re = /\/Font\s*<<([\s\S]*?)>>/g;
      let g;
      while ((g = re.exec(dict)) !== null) {
        const reA = /\/([A-Za-z0-9_+#]+)\s+(\d+)\s+\d+\s+R/g;
        let a;
        while ((a = reA.exec(g[1])) !== null) out[a[1]] = parseInt(a[2], 10);
      }
      return out;
    }
    function resolverFuentes(num, prof) {
      if (prof > 8 || !objs[num]) return {};
      const d = objs[num].dict;
      const inline = fuentesDe(d);
      if (Object.keys(inline).length) return inline;
      const mR = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(d);
      if (mR) return fuentesDe(objs[mR[1]] ? objs[mR[1]].dict : '');
      const mP = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(d);
      if (mP) return resolverFuentes(parseInt(mP[1], 10), prof + 1);
      return {};
    }

    // ===== 4) contenido de cada pagina =====
    const contenidos = [];
    for (const n in objs) {
      const d = objs[n].dict;
      if (!/\/Type\s*\/Page(?![A-Za-z])/.test(d)) continue;
      const nums = [];
      const mArr = /\/Contents\s*\[([^\]]*)\]/.exec(d);
      if (mArr) {
        const reC = /(\d+)\s+\d+\s+R/g;
        let c;
        while ((c = reC.exec(mArr[1])) !== null) nums.push(parseInt(c[1], 10));
      } else {
        const mC = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(d);
        if (mC) nums.push(parseInt(mC[1], 10));
      }
      let txt = '';
      for (let q = 0; q < nums.length; q++) if (objs[nums[q]] && objs[nums[q]].plano) txt += objs[nums[q]].plano + '\n';
      if (txt.trim()) contenidos.push({ txt: txt, fuentes: resolverFuentes(parseInt(n, 10), 0) });
    }
    if (!contenidos.length) {
      for (const n in objs) {
        const t = objs[n].plano;
        if (t && /BT|TJ|Tj/.test(t) && /\/[A-Za-z0-9_]+\s+[\d.]+\s+Tf/.test(t)) contenidos.push({ txt: t, fuentes: {} });
      }
    }

    // ===== 5) extraer el texto =====
    function mapear(s, mapa, ancho) {
      let out = '';
      if (ancho === 2) {
        for (let i = 0; i + 1 < s.length; i += 2) {
          const cid = (s.charCodeAt(i) << 8) | s.charCodeAt(i + 1);
          const u = mapa[cid];
          out += u !== undefined ? String.fromCharCode(u) : '';
        }
        return out;
      }
      for (let i = 0; i < s.length; i++) {
        const u = mapa[s.charCodeAt(i)];
        out += u !== undefined ? String.fromCharCode(u) : s[i];
      }
      return out;
    }
    function hexAStr(hex, mapa, ancho) {
      const limpio = hex.replace(/[^0-9A-Fa-f]/g, '');
      if (ancho === 2) {
        let s = '';
        for (let i = 0; i + 3 < limpio.length + 1; i += 4) {
          if (i + 4 > limpio.length) break;
          const cid = parseInt(limpio.substr(i, 4), 16);
          const u = mapa ? mapa[cid] : undefined;
          s += u !== undefined ? String.fromCharCode(u) : '';
        }
        if (s.trim()) return s;
      }
      if (mapa) {
        let s = '';
        for (let i = 0; i + 3 < limpio.length; i += 4) {
          const cid = parseInt(limpio.substr(i, 4), 16);
          const u = mapa[cid];
          if (u !== undefined) s += String.fromCharCode(u);
        }
        if (s.trim()) return s;
      }
      let s = '';
      for (let i = 0; i + 1 < limpio.length; i += 2) {
        const cid = parseInt(limpio.substr(i, 2), 16);
        const u = mapa ? mapa[cid] : undefined;
        s += u !== undefined ? String.fromCharCode(u) : String.fromCharCode(cid);
      }
      return s;
    }
    function puntaje(t) {
      if (!t) return -1;
      let buenos = 0;
      for (const c of t) {
        const k = c.charCodeAt(0);
        if ((k >= 32 && k < 127) || k === 10 || k === 13 || k > 160) buenos++;
      }
      return buenos / t.length;
    }
    function extraer(usarMapa) {
      let salida = '';
      for (const cont of contenidos) {
        const txt = cont.txt;
        let out = '', pendiente = '', fuente = null;
        const re = /\/([A-Za-z0-9_+#]+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bTJ\b|\bTj\b|\bTd\b|\bTD\b|\bT\*\b|\bET\b|\bTm\b|'/g;
        let mm;
        while ((mm = re.exec(txt)) !== null) {
          const tok = mm[0];
          if (mm[1] !== undefined) {
            const nf = cont.fuentes[mm[1]];
            fuente = (usarMapa && nf && fuentePorObj[nf]) ? fuentePorObj[nf] : null;
          } else if (tok === 'TJ' || tok === 'Tj') {
            if (pendiente) { out += pendiente; pendiente = ''; }
          } else if (tok === 'Td' || tok === 'TD' || tok === 'T*' || tok === 'ET' || tok === 'Tm') {
            if (pendiente) { out += pendiente + '\n'; pendiente = ''; }
            else if (out && !out.endsWith('\n')) out += '\n';
          } else if (tok[0] === '(') {
            let s = tok.slice(1, -1);
            s = s.replace(/\\([nrtbf()\\])/g, function (a, c) {
              return c === 'n' || c === 'r' ? '\n' : c === 't' ? '\t' : (c === 'b' || c === 'f') ? '' : c;
            });
            s = s.replace(/\\([0-7]{1,3})/g, function (a, o) { return String.fromCharCode(parseInt(o, 8)); });
            pendiente += fuente ? mapear(s, fuente.mapa, fuente.ancho) : s;
          } else if (tok[0] === '<') {
            pendiente += hexAStr(tok.slice(1, -1), fuente ? fuente.mapa : null, fuente ? fuente.ancho : 0);
          }
        }
        if (pendiente) out += pendiente;
        if (out.trim()) salida += out.trim() + '\n\n';
      }
      return salida;
    }
    const conMapa = extraer(true);
    const sinMapa = extraer(false);
    let salida = puntaje(conMapa) >= puntaje(sinMapa) ? conMapa : sinMapa;
    if (!salida.trim()) salida = '(no se pudo extraer texto: el PDF puede ser una imagen escaneada o usar una compresion no soportada)';
    return salida;
  }

  window.ParrotLeer = {
    zip: leerZip,
    zipATexto: zipATexto,
    zipABytes: zipABytes,
    docxAHTML: docxAHTML,
    xlsxADatos: xlsxADatos,
    pptxAPres: pptxAPres,
    pdfATexto: pdfATexto,
    base64: bytesABase64
  };
})();
