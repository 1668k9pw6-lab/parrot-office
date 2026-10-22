/* Parrot Office — exportacion .pptx real (OOXML) desde el editor de presentaciones.
   Cada diapositiva se convierte en un slide con textos, formas e imagenes posicionados. */
(function () {
  'use strict';
  const Z = window.ParrotZip;
  const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const EMU = 9525; // 1 px a 96 dpi

  const THEME = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="' + A + '" name="Parrot"><a:themeElements>' +
    '<a:clrScheme name="Parrot">' +
    '<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1F2933"/></a:dk2><a:lt2><a:srgbClr val="EAF7EF"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="1DB954"/></a:accent1><a:accent2><a:srgbClr val="14833B"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="FFD60A"/></a:accent3><a:accent4><a:srgbClr val="0EA5E9"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="F43F5E"/></a:accent5><a:accent6><a:srgbClr val="8B5CF6"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="1155CC"/></a:hlink><a:folHlink><a:srgbClr val="7B341E"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Parrot"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Parrot">' +
    '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst>' +
    '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>' +
    '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>' +
    '<a:ln w="28575" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>' +
    '</a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
    '</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';

  const SP_TREE_CAB = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

  function n(v) { v = Math.round(Number(v) || 0); return v < 0 ? 0 : v; }

  function formaTexto(el, id) {
    const sz = Math.max(600, Math.round((el.size || 16) * 75));
    const algn = el.tipo === 'texto' ? 'l' : 'ctr';
    const ancla = 'ctr';
    const lineas = String(el.texto || '').split('\n');
    let paras = '';
    for (const l of lineas) {
      paras += '<a:p><a:pPr algn="' + algn + '"/>' +
        '<a:r><a:rPr lang="es-AR" sz="' + sz + '" dirty="0">' +
        '<a:solidFill><a:srgbClr val="' + Z.color(el.color, '111111') + '"/></a:solidFill>' +
        '<a:latin typeface="Segoe UI"/></a:rPr>' +
        '<a:t>' + Z.esc(l) + '</a:t></a:r></a:p>';
    }
    const bg = (el.bg && el.bg !== 'transparent') ? '<a:solidFill><a:srgbClr val="' + Z.color(el.bg, 'FFFFFF') + '"/></a:solidFill>' : '<a:noFill/>';
    const geom = el.tipo === 'circulo' ? 'ellipse' : 'rect';
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Forma ' + id + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="' + n(el.x * EMU) + '" y="' + n(el.y * EMU) + '"/>' +
      '<a:ext cx="' + n(Math.max(1, el.w) * EMU) + '" cy="' + n(Math.max(1, el.h) * EMU) + '"/></a:xfrm>' +
      '<a:prstGeom prst="' + geom + '"><a:avLst/></a:prstGeom>' + bg + '</p:spPr>' +
      '<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="' + ancla + '" inset="45720"><a:normAutofit/></a:bodyPr>' +
      '<a:lstStyle/>' + paras + '</p:txBody></p:sp>';
  }

  function formaImagen(el, id, rid) {
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Imagen ' + id + '" descr="' + Z.esc(String(el.texto || 'Imagen').slice(0, 60)) + '"/>' +
      '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
      '<p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
      '<p:spPr><a:xfrm><a:off x="' + n(el.x * EMU) + '" y="' + n(el.y * EMU) + '"/>' +
      '<a:ext cx="' + n(Math.max(1, el.w) * EMU) + '" cy="' + n(Math.max(1, el.h) * EMU) + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }

  function generar(pres) {
    const diapositivas = (pres && pres.diapositivas) || [{ fondo: '#ffffff', elementos: [] }];
    const media = [];
    const usados = {};
    const slides = [];

    diapositivas.forEach(function (d, i) {
      const fondo = Z.color(d.fondo, 'FFFFFF');
      let shapes = '', id = 2;
      const relsExtra = [];
      (d.elementos || []).forEach(function (el) {
        if (!el) return;
        if (el.tipo === 'imagen') {
          const src = el.src || '';
          if (src.indexOf('data:image/') !== 0) { shapes += formaTexto(el, id++); return; }
          let rid = usados[src];
          if (!rid) {
            const part = Z.dataURL(src);
            const ext = Z.extensionDe(part.mime);
            const idx = media.length + 1;
            rid = 'rIdImg' + idx;
            media.push({ nombre: 'ppt/media/imagen' + idx + '.' + ext, datos: part.bytes, ext: ext });
            usados[src] = rid;
          }
          relsExtra.push(rid);
          shapes += formaImagen(el, id++, rid);
        } else {
          shapes += formaTexto(el, id++);
        }
      });
      const slide = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<p:sld xmlns:a="' + A + '" xmlns:r="' + R + '" xmlns:p="' + P + '"><p:cSld>' +
        '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + fondo + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
        '<p:spTree>' + SP_TREE_CAB + shapes + '</p:spTree></p:cSld>' +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
      slides.push({ n: i + 1, xml: slide, rels: relsExtra });
    });

    // presentation.xml
    let sldIds = '';
    slides.forEach(function (s, i) { sldIds += '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>'; });
    const presentation = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentation xmlns:a="' + A + '" xmlns:r="' + R + '" xmlns:p="' + P + '" saveSubsetFonts="1">' +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
      '<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>' +
      '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>';

    let presRels = '<Relationship Id="rId1" Type="' + R + '/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
    slides.forEach(function (s, i) {
      presRels += '<Relationship Id="rId' + (i + 2) + '" Type="' + R + '/slide" Target="slides/slide' + s.n + '.xml"/>';
    });

    const master = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldMaster xmlns:a="' + A + '" xmlns:r="' + R + '" xmlns:p="' + P + '"><p:cSld>' +
      '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
      '<p:spTree>' + SP_TREE_CAB + '</p:spTree></p:cSld>' +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';

    const layout = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldLayout xmlns:a="' + A + '" xmlns:r="' + R + '" xmlns:p="' + P + '" type="blank" preserve="1">' +
      '<p:cSld name="En blanco"><p:spTree>' + SP_TREE_CAB + '</p:spTree></p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

    // content types
    const exts = {};
    media.forEach(function (m) { exts[m.ext] = 'image/' + (m.ext === 'jpg' ? 'jpeg' : m.ext); });
    let defExt = '';
    for (const e in exts) defExt += '<Default Extension="' + e + '" ContentType="' + exts[e] + '"/>';
    let ov = '';
    slides.forEach(function (s) { ov += '<Override PartName="/ppt/slides/slide' + s.n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'; });
    const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' + defExt +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + ov +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';

    const raizRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' +
      '<Relationship Id="rId1" Type="' + R + '/officeDocument" Target="ppt/presentation.xml"/>' +
      '<Relationship Id="rId2" Type="' + PKG + '/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="' + R + '/extended-properties" Target="docProps/app.xml"/></Relationships>';

    const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>Presentacion Parrot Office</dc:title><dc:creator>Parrot Office</dc:creator>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created>' +
      '</cp:coreProperties>';

    const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Parrot Office</Application><PresentationFormat>Panoramico</PresentationFormat>' +
      '<Slides>' + slides.length + '</Slides></Properties>';

    const archivos = [
      { nombre: '[Content_Types].xml', datos: Z.texto(ct) },
      { nombre: '_rels/.rels', datos: Z.texto(raizRels) },
      { nombre: 'docProps/core.xml', datos: Z.texto(core) },
      { nombre: 'docProps/app.xml', datos: Z.texto(app) },
      { nombre: 'ppt/presentation.xml', datos: Z.texto(presentation) },
      { nombre: 'ppt/_rels/presentation.xml.rels', datos: Z.texto('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' + presRels + '</Relationships>') },
      { nombre: 'ppt/slideMasters/slideMaster1.xml', datos: Z.texto(master) },
      { nombre: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', datos: Z.texto('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' +
        '<Relationship Id="rId1" Type="' + R + '/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        '<Relationship Id="rId2" Type="' + R + '/theme" Target="../theme/theme1.xml"/></Relationships>') },
      { nombre: 'ppt/slideLayouts/slideLayout1.xml', datos: Z.texto(layout) },
      { nombre: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', datos: Z.texto('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' +
        '<Relationship Id="rId1" Type="' + R + '/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>') },
      { nombre: 'ppt/theme/theme1.xml', datos: Z.texto(THEME) }
    ];
    slides.forEach(function (s) {
      archivos.push({ nombre: 'ppt/slides/slide' + s.n + '.xml', datos: Z.texto(s.xml) });
      let r = '<Relationship Id="rIdL" Type="' + R + '/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
      s.rels.forEach(function (rid, i) {
        const idx = rid.replace('rIdImg', '');
        r += '<Relationship Id="' + rid + '" Type="' + R + '/image" Target="../media/imagen' + idx + '.' + (media[idx - 1] ? media[idx - 1].ext : 'png') + '"/>';
      });
      archivos.push({ nombre: 'ppt/slides/_rels/slide' + s.n + '.xml.rels', datos: Z.texto('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + PKG + '">' + r + '</Relationships>') });
    });
    media.forEach(function (m) { archivos.push({ nombre: m.nombre, datos: m.datos }); });
    return Z.zip(archivos);
  }

  window.ParrotPptx = {
    blob: function (pres) {
      return new Blob([generar(pres)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    }
  };
})();
