/* Parrot Office — exportacion .docx real (OOXML) desde HTML del procesador.
   Recorre el DOM y mapea etiquetas + estilos inline a runs de Word. */
(function () {
  'use strict';
  const Z = window.ParrotZip;
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  const EMU_CM = 360000, MAX_ANCHO = 15.5 * EMU_CM;

  function rPr(f) {
    let s = '<w:rPr>';
    if (f.font) s += '<w:rFonts w:ascii="' + Z.esc(f.font) + '" w:hAnsi="' + Z.esc(f.font) + '"/>';
    if (f.b) s += '<w:b/>';
    if (f.i) s += '<w:i/>';
    if (f.u) s += '<w:u w:val="' + f.u + '"/>';
    if (f.s) s += '<w:strike/>';
    if (f.color) s += '<w:color w:val="' + f.color + '"/>';
    if (f.sz) s += '<w:sz w:val="' + f.sz + '"/><w:szCs w:val="' + f.sz + '"/>';
    return s + '</w:rPr>';
  }

  function jc(a) {
    if (a === 'center') return '<w:jc w:val="center"/>';
    if (a === 'right' || a === 'end') return '<w:jc w:val="right"/>';
    if (a === 'justify') return '<w:jc w:val="both"/>';
    return '<w:jc w:val="left"/>';
  }

  function convertir(html) {
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const raiz = doc.getElementById('r');
    const media = [], usados = {};
    let cuerpo = '', nId = 1;

    function imagen(el) {
      const src = el.getAttribute('src') || '';
      if (src.indexOf('data:image/') !== 0) return '';
      if (usados[src]) return usados[src];
      const part = Z.dataURL(src);
      const ext = Z.extensionDe(part.mime);
      const d = Z.dimensiones(part.bytes);
      let cx = 12 * EMU_CM, cy = 8 * EMU_CM;
      if (d.w && d.h) {
        cx = d.w * 9525; cy = d.h * 9525;
        if (cx > MAX_ANCHO) { cy = Math.round(cy * MAX_ANCHO / cx); cx = MAX_ANCHO; }
      }
      const idx = media.length + 1, rid = 'rIdImg' + idx, id = 100 + idx;
      media.push({ nombre: 'word/media/imagen' + idx + '.' + ext, datos: part.bytes, rid: rid });
      const xml = '<w:r>' + rPr({}) + '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
        '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
        '<wp:docPr id="' + id + '" name="Imagen ' + id + '"/>' +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="' + A + '" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
        '<a:graphic xmlns:a="' + A + '"><a:graphicData uri="' + PIC + '"><pic:pic xmlns:pic="' + PIC + '">' +
        '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="Imagen ' + id + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
        '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
        '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
      usados[src] = xml;
      return xml;
    }

    function estilos(el) {
      const st = {};
      const s = el.getAttribute('style');
      if (s) s.split(';').forEach(function (par) {
        const i = par.indexOf(':');
        if (i > 0) st[par.slice(0, i).trim().toLowerCase()] = par.slice(i + 1).trim();
      });
      return st;
    }

    function runs(nodo, f, alinea) {
      let out = '';
      for (const n of nodo.childNodes) {
        if (n.nodeType === 3) {
          const t = n.nodeValue;
          if (t && t.length) out += '<w:r>' + rPr(f) + '<w:t xml:space="preserve">' + Z.esc(t) + '</w:t></w:r>';
        } else if (n.nodeType === 1) {
          const tag = n.tagName;
          if (tag === 'BR') { out += '<w:r>' + rPr(f) + '<w:br/></w:r>'; continue; }
          if (tag === 'IMG') { const im = imagen(n); if (im) out += im; continue; }
          const g = Object.assign({}, f);
          if (tag === 'B' || tag === 'STRONG') g.b = true;
          if (tag === 'I' || tag === 'EM') g.i = true;
          if (tag === 'U') g.u = 'single';
          if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') g.s = true;
          if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') g.font = 'Consolas';
          if (tag === 'A') g.color = g.color || '1155CC';
          const st = estilos(n);
          if (st['font-weight'] === 'bold' || st['font-weight'] === 'bolder' || parseInt(st['font-weight']) >= 600) g.b = true;
          if (st['font-style'] === 'italic' || st['font-style'] === 'oblique') g.i = true;
          if (st['text-decoration'] && st['text-decoration'].indexOf('underline') >= 0) g.u = 'single';
          if (st['text-decoration'] && st['text-decoration'].indexOf('line-through') >= 0) g.s = true;
          if (st.color) g.color = Z.color(st.color, g.color);
          if (st['font-size']) {
            const v = parseFloat(st['font-size']);
            const pts = st['font-size'].indexOf('pt') >= 0 ? v : v * 0.75;
            if (pts >= 5 && pts <= 160) g.sz = Math.round(pts * 2);
          }
          if (st['font-family']) g.font = st['font-family'].split(',')[0].replace(/['"]/g, '').trim();
          if (st['text-align']) alinea.v = st['text-align'];
          out += runs(n, g, alinea);
        }
      }
      return out;
    }

    const ENCABEZADOS = { H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', H4: 'Heading4', H5: 'Heading4', H6: 'Heading4' };

    function parrafo(el, estilo, indent, extra) {
      const st = estilos(el);
      const alinea = { v: st['text-align'] || '' };
      let inner = '';
      if (el.tagName === 'IMG') inner = imagen(el);
      else if (el.tagName === 'HR') { cuerpo += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFC9CA"/></w:pBdr></w:pPr></w:p>'; return; }
      else inner = runs(el, {}, alinea);
      let ppr = '<w:pPr>';
      if (estilo) ppr += '<w:pStyle w:val="' + estilo + '"/>';
      ppr += jc(alinea.v);
      if (indent) ppr += '<w:ind w:left="' + indent + '" w:hanging="' + Math.round(indent / 2) + '"/>';
      if (extra) ppr += extra;
      ppr += '</w:pPr>';
      cuerpo += '<w:p>' + ppr + inner + '</w:p>';
    }

    function recorrer(nodo) {
      for (const n of nodo.childNodes) {
        if (n.nodeType === 3) {
          if (n.nodeValue && n.nodeValue.trim()) parrafo({ tagName: 'P', childNodes: [n], getAttribute: function () { return null; } }, 'Normal', 0, '');
          continue;
        }
        if (n.nodeType !== 1) continue;
        const tag = n.tagName;
        if (ENCABEZADOS[tag]) parrafo(n, ENCABEZADOS[tag], 0, '');
        else if (tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'HEADER' || tag === 'FOOTER' || tag === 'FIGURE' || tag === 'MAIN' || tag === 'ASIDE' || tag === 'BLOCKQUOTE' || tag === 'PRE' || tag === 'FIGCAPTION') {
          const est = tag === 'BLOCKQUOTE' ? 'ParrotQuote' : (tag === 'PRE' ? 'ParrotCode' : null);
          if ((tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'MAIN' || tag === 'FIGURE') && n.querySelector('p,h1,h2,h3,h4,ul,ol,table,hr,img,div')) { recorrer(n); continue; }
          parrafo(n, est || 'Normal', 0, '');
        }
        else if (tag === 'UL' || tag === 'OL') {
          let k = 1;
          for (const li of n.children) {
            if (li.tagName !== 'LI') continue;
            const marca = tag === 'UL' ? '\u2022  ' : (k++ + '.  ');
            cuerpo += '<w:p><w:pPr>' + jc('left') + '<w:ind w:left="720" w:hanging="360"/></w:pPr>' +
              '<w:r>' + rPr({}) + '<w:t xml:space="preserve">' + Z.esc(marca) + '</w:t></w:r>' + runs(li, {}, { v: '' }) + '</w:p>';
          }
        }
    else if (tag === 'TABLE') cuerpo += hacerTabla(n, imagen, runs, jc) + '<w:p/>';
    else if (tag === 'IMG') parrafo(n, 'Normal', 0, '<w:jc w:val="center"/>');
    else if (tag === 'HR') parrafo(n, 'Normal', 0, '');
    else if (tag === 'BR') cuerpo += '<w:p/>';
    else parrafo(n, 'Normal', 0, '');
      }
    }

    recorrer(raiz);
    if (!cuerpo) cuerpo = '<w:p/>';

    const rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'];
    media.forEach(function (m, i) {
      rels.push('<Relationship Id="' + m.rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/imagen' + (i + 1) + '.' + m.nombre.split('.').pop() + '"/>');
    });

    const archivos = [
      { nombre: '[Content_Types].xml', datos: Z.texto(CT_DOCX(media)) },
      { nombre: '_rels/.rels', datos: Z.texto(RELS_RAIZ) },
      { nombre: 'word/document.xml', datos: Z.texto(DOC_XML(cuerpo)) },
      { nombre: 'word/_rels/document.xml.rels', datos: Z.texto('<Relationships xmlns="' + PKG + '">' + rels.join('') + '</Relationships>') },
      { nombre: 'word/styles.xml', datos: Z.texto(STYLES_XML()) },
      { nombre: 'docProps/core.xml', datos: Z.texto(CORE_XML()) },
      { nombre: 'docProps/app.xml', datos: Z.texto(APP_XML()) }
    ];
    media.forEach(function (m) { archivos.push({ nombre: m.nombre, datos: m.datos }); });
    return archivos;
  }

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

  const RELS_RAIZ = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="' + PKG + '">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="' + PKG + '/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  function CT_DOCX(media) {
    const exts = {};
    media.forEach(function (m) { exts[m.nombre.split('.').pop()] = 1; });
    let def = '';
    for (const e in exts) def += '<Default Extension="' + e + '" ContentType="image/' + (e === 'jpg' ? 'jpeg' : e) + '"/>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' + def +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';
  }

  function DOC_XML(cuerpo) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="' + W_NS + '" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
      'xmlns:a="' + A + '" xmlns:pic="' + PIC + '">' +
      '<w:body>' + cuerpo +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
  }

  function STYLES_XML() {
    const b = 'w:val="single" w:sz="4" w:space="0" w:color="9AA5A5"';
    const bi = 'w:val="single" w:sz="4" w:space="0" w:color="C8D2D2"';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="' + W_NS + '">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
      '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>' +
      '<w:rPr><w:b/><w:color w:val="14833B"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>' +
      '<w:rPr><w:b/><w:color w:val="14833B"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="260" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr>' +
      '<w:rPr><w:b/><w:color w:val="1F2933"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      '<w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="3"/></w:pPr>' +
      '<w:rPr><w:b/><w:i/><w:color w:val="1F2933"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ParrotCode"><w:name w:val="Parrot Code"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F4F4"/>' +
      '<w:spacing w:before="80" w:after="160" w:line="240" w:lineRule="auto"/>' +
      '<w:pBdr><w:top ' + b + '/><w:left ' + b + '/><w:bottom ' + b + '/><w:right ' + b + '/></w:pBdr></w:pPr>' +
      '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1F2933"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ParrotQuote"><w:name w:val="Parrot Quote"/><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:ind w:left="567" w:right="284"/><w:spacing w:before="120" w:after="160"/>' +
      '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="1DB954"/></w:pBdr></w:pPr>' +
      '<w:rPr><w:i/><w:color w:val="4E5D6C"/></w:rPr></w:style>' +
      '</w:styles>';
  }

  function hacerTabla(t, imagen, runs, jc) {
    let x = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' +
      '<w:top w:val="single" w:sz="4" w:space="0" w:color="9AA5A5"/>' +
      '<w:left w:val="single" w:sz="4" w:space="0" w:color="9AA5A5"/>' +
      '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="9AA5A5"/>' +
      '<w:right w:val="single" w:sz="4" w:space="0" w:color="9AA5A5"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="C8D2D2"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="C8D2D2"/>' +
      '</w:tblBorders></w:tblPr>';
    const primera = t.rows && t.rows[0] ? t.rows[0].children.length : 1;
    const ancho = Math.floor(9070 / Math.max(1, primera));
    x += '<w:tblGrid>' + new Array(Math.max(1, primera) + 1).join('<w:gridCol w:w="' + ancho + '"/>') + '</w:tblGrid>';
    for (const tr of t.querySelectorAll('tr')) {
      x += '<w:tr>';
      for (const td of tr.children) {
        const esHead = td.tagName === 'TH';
        const alinea = { v: '' };
        let inner = td.tagName === 'IMG' ? imagen(td) : runs(td, esHead ? { b: true } : {}, alinea);
        if (!inner) inner = '<w:p/>';
        x += '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>' +
          (esHead ? '<w:shd w:val="clear" w:color="auto" w:fill="EAF7EF"/>' : '') + '</w:tcPr>' +
          '<w:p><w:pPr>' + jc(alinea.v || 'left') + '<w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>' +
          inner + '</w:p></w:tc>';
      }
      x += '</w:tr>';
    }
    return x + '</w:tbl>';
  }

  function CORE_XML() {
    const ahora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>Documento Parrot Office</dc:title><dc:creator>Parrot Office</dc:creator>' +
      '<cp:lastModifiedBy>Parrot Office</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + ahora + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + ahora + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function APP_XML() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Parrot Office</Application></Properties>';
  }

  window.ParrotDocx = {
    blob: function (html) {
      return new Blob([Z.zip(convertir(html))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
  };
})();
