/* Parrot Office — exportacion .xlsx real (OOXML) desde la hoja de calculo.
   Mantiene valores, formulas, negrita, cursiva, colores y formatos numericos. */
(function () {
  'use strict';
  const Z = window.ParrotZip;
  const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const SSML = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  function refAPos(ref) {
    const m = String(ref).toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    return { col: col, fila: parseInt(m[2], 10), letra: m[1] };
  }

  function generar(o) {
    const datos = o.datos || {};
    const valorReal = o.valorReal || function (r) { const c = datos[r]; return c ? String(c.f ?? '') : ''; };
    const nombreHoja = (o.nombreHoja || 'Hoja 1').replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31);

    // ---- shared strings ----
    const ssIndex = new Map();
    const ssLista = [];
    function ss(t) {
      const k = String(t);
      if (ssIndex.has(k)) return ssIndex.get(k);
      const i = ssLista.length;
      ssIndex.set(k, i);
      ssLista.push(k);
      return i;
    }

    // ---- estilos ----
    const NUMFMT = { '-1': 164, '0': 165, '2': 166 };
    const fuentes = [{ b: false, i: false, color: 'FF111111' }];
    const fills = [null, null];
    const fillsMap = new Map();
    const xfs = new Map();
    const xfsLista = [];
    function estiloDe(cel) {
      const b = !!cel.b, i = !!cel.i;
      const color = 'FF' + Z.color(cel.c, '111111');
      const bg = cel.bg ? Z.color(cel.bg, 'FFFFFF') : null;
      const fmt = (cel.fmt === null || cel.fmt === undefined) ? null : String(cel.fmt);
      const clave = [b, i, color, bg || '-', fmt || '-'].join('|');
      if (xfs.has(clave)) return xfs.get(clave);

      let fontId = 0;
      for (let k = 0; k < fuentes.length; k++) {
        if (fuentes[k].b === b && fuentes[k].i === i && fuentes[k].color === color) { fontId = k; break; }
        if (k === fuentes.length - 1) { fuentes.push({ b: b, i: i, color: color }); fontId = fuentes.length - 1; }
      }
      let fillId = 0;
      if (bg) {
        if (fillsMap.has(bg)) fillId = fillsMap.get(bg);
        else { fillId = fills.length; fills.push(bg); fillsMap.set(bg, fillId); }
      }
      const numFmtId = fmt && NUMFMT[fmt] ? NUMFMT[fmt] : 0;
      const id = xfsLista.length;
      xfsLista.push('<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="0" xfId="0" applyFont="1"' +
        (fillId ? ' applyFill="1"' : '') + (numFmtId ? ' applyNumberFormat="1"' : '') + ' applyAlignment="1"><alignment vertical="center"/></xf>');
      xfs.set(clave, id);
      return id;
    }

    // ---- celdas ----
    const filas = new Map();
    let refMin = null, refMax = null;
    for (const ref in datos) {
      const p = refAPos(ref);
      if (!p) continue;
      const cel = datos[ref];
      const crudo = String(cel.f ?? '');
      if (crudo === '') continue;
      const s = estiloDe(cel);
      let xml;
      if (crudo.charAt(0) === '=') {
        let v = null;
        try { v = valorReal(ref); } catch (e) { v = null; }
        const cache = (typeof v === 'number' && isFinite(v)) ? String(v) : Z.esc(v == null ? '' : String(v));
        const t = (typeof v === 'number') ? '' : ' t="str"';
        xml = '<c r="' + ref + '" s="' + s + '"' + t + '><f>' + Z.esc(crudo.slice(1)) + '</f><v>' + cache + '</v></c>';
      } else {
        const n = parseFloat(crudo);
        if (!isNaN(n) && crudo.trim() !== '') xml = '<c r="' + ref + '" s="' + s + '"><v>' + n + '</v></c>';
        else xml = '<c r="' + ref + '" s="' + s + '" t="s"><v>' + ss(crudo) + '</v></c>';
      }
      if (!filas.has(p.fila)) filas.set(p.fila, []);
      filas.get(p.fila).push({ col: p.col, xml: xml });
      if (!refMin || p.fila < refMin.fila) refMin = { fila: p.fila, col: p.col };
    }

    let filaMax = 0, colMax = 0;
    for (const [nf, cels] of filas) {
      cels.sort((a, b) => a.col - b.col);
      filaMax = Math.max(filaMax, nf);
      for (const c of cels) colMax = Math.max(colMax, c.col);
    }
    if (!filaMax) { filaMax = 1; colMax = 1; }
    const dimension = 'A1:' + colANombre(colMax) + filaMax;

    let sheetData = '';
    for (let f = 1; f <= filaMax; f++) {
      const cels = filas.get(f);
      if (!cels) continue;
      sheetData += '<row r="' + f + '">' + cels.map(c => c.xml).join('') + '</row>';
    }

    const colsXml = '<cols><col min="1" max="' + Math.max(colMax, 8) + '" width="13" customWidth="1"/></cols>';

    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="' + SSML + '" xmlns:r="' + PKG.replace('/relationships', '/officeDocument/2006/relationships') + '">' +
      '<sheetPr/><dimension ref="' + dimension + '"/>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' + colsXml +
      '<sheetData>' + sheetData + '</sheetData>' +
      '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';

    const fontsXml = fuentes.map(f =>
      '<font>' + (f.b ? '<b/>' : '') + (f.i ? '<i/>' : '') +
      '<sz val="11"/><color rgb="' + f.color + '"/><name val="Calibri"/><family val="2"/></font>').join('');

    const fillsXml = '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      fills.filter(function (c) { return !!c; }).map(c => '<fill><patternFill patternType="solid"><fgColor rgb="' + c + '"/><bgColor indexed="64"/></patternFill></fill>').join('');

    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="' + SSML + '">' +
      '<numFmts count="3">' +
      '<numFmt numFmtId="164" formatCode="#,##0"/>' +
      '<numFmt numFmtId="165" formatCode="0"/>' +
      '<numFmt numFmtId="166" formatCode="0.00"/>' +
      '</numFmts>' +
      '<fonts count="' + fuentes.length + '">' + fontsXml + '</fonts>' +
      '<fills count="' + fills.length + '">' + fillsXml + '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfsLista.length + '">' + xfsLista.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    const sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<sst xmlns="' + SSML + '" count="' + ssLista.length + '" uniqueCount="' + ssLista.length + '">' +
      ssLista.map(t => '<si><t xml:space="preserve">' + Z.esc(t) + '</t></si>').join('') + '</sst>';

    const wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="' + SSML + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<workbookPr/><bookViews><workbookView/></bookViews>' +
      '<sheets><sheet name="' + Z.esc(nombreHoja) + '" sheetId="1" r:id="rId1"/></sheets>' +
      '</workbook>';

    const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
      '</Relationships>';

    const raizRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="' + PKG + '/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>';

    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>';

    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>Hoja Parrot Office</dc:title><dc:creator>Parrot Office</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created>' +
      '</cp:coreProperties>';

    return Z.zip([
      { nombre: '[Content_Types].xml', datos: Z.texto(ct) },
      { nombre: '_rels/.rels', datos: Z.texto(raizRels) },
      { nombre: 'docProps/core.xml', datos: Z.texto(core) },
      { nombre: 'xl/workbook.xml', datos: Z.texto(wb) },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: Z.texto(wbRels) },
      { nombre: 'xl/styles.xml', datos: Z.texto(styles) },
      { nombre: 'xl/sharedStrings.xml', datos: Z.texto(sst) },
      { nombre: 'xl/worksheets/sheet1.xml', datos: Z.texto(sheet) }
    ]);
  }

  function colANombre(n) {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  window.ParrotXlsx = {
    blob: function (o) {
      return new Blob([generar(o)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
  };
})();
