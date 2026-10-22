/* Parrot Office — nucleo: ZIP (store), CRC32, helpers.
   Sin librerias externas, funciona offline (file://). */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function b64aBytes(b64) {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  function partirDataURL(dataURL) {
    const i = dataURL.indexOf(',');
    const cabeza = dataURL.slice(0, i);
    const mime = (cabeza.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    return { mime: mime, bytes: b64aBytes(dataURL.slice(i + 1)) };
  }

  function extensionDe(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/gif') return 'gif';
    if (mime === 'image/bmp') return 'bmp';
    if (mime === 'image/webp') return 'webp';
    return 'bin';
  }

  // dimensiones reales sin decodificar la imagen
  function dimensiones(u) {
    if (u.length > 24 && u[0] === 0x89 && u[1] === 0x50) {
      return { w: (u[16] << 24 | u[17] << 16 | u[18] << 8 | u[19]) >>> 0, h: (u[20] << 24 | u[21] << 16 | u[22] << 8 | u[23]) >>> 0 };
    }
    if (u.length > 10 && u[0] === 0x47 && u[1] === 0x49) return { w: u[6] | u[7] << 8, h: u[8] | u[9] << 8 };
    if (u.length > 4 && u[0] === 0x42 && u[1] === 0x4D) return { w: u[18] | u[19] << 8 | u[20] << 16 | u[21] << 24, h: u[22] | u[23] << 8 | u[24] << 16 | u[25] << 24 };
    if (u.length > 4 && u[0] === 0xFF && u[1] === 0xD8) {
      let i = 2;
      while (i + 9 < u.length) {
        if (u[i] !== 0xFF) { i++; continue; }
        const m = u[i + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { h: u[i + 5] << 8 | u[i + 6], w: u[i + 7] << 8 | u[i + 8] };
        }
        i += 2 + (u[i + 2] << 8 | u[i + 3]);
      }
    }
    return { w: 0, h: 0 };
  }

  function normalizarColor(c, porDefecto) {
    if (!c) return porDefecto || '000000';
    c = String(c).trim().toLowerCase();
    let m = c.match(/^#([0-9a-f]{3})$/);
    if (m) return (m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2]).toUpperCase();
    m = c.match(/^#([0-9a-f]{6})$/);
    if (m) return m[1].toUpperCase();
    m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      const h = n => ('0' + Math.max(0, Math.min(255, n | 0)).toString(16)).slice(-2);
      return (h(+m[1]) + h(+m[2]) + h(+m[3])).toUpperCase();
    }
    const nombres = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080', transparent: 'FFFFFF' };
    return nombres[c] || porDefecto || '000000';
  }

  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function concatenar(trozos) {
    let n = 0;
    for (const t of trozos) n += t.length;
    const out = new Uint8Array(n);
    let p = 0;
    for (const t of trozos) { out.set(t, p); p += t.length; }
    return out;
  }

  function dosFecha(d) { return (((d.getFullYear() - 1980) & 0x7F) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); }
  function dosHora(d) { return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); }

  // archivos: [{ nombre, datos: Uint8Array }] -> Uint8Array (ZIP sin compresion, valido para Office)
  function zip(archivos) {
    const enc = new TextEncoder();
    const ahora = new Date();
    const f = dosFecha(ahora), h = dosHora(ahora);
    const trozos = [], centro = [];
    let offset = 0;

    for (const a of archivos) {
      const nombre = enc.encode(a.nombre);
      const datos = a.datos;
      const crc = crc32(datos);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // nombres en UTF-8
      lh.setUint16(8, 0, true);      // store
      lh.setUint16(10, h, true);
      lh.setUint16(12, f, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, datos.length, true);
      lh.setUint32(22, datos.length, true);
      lh.setUint16(26, nombre.length, true);
      lh.setUint16(28, 0, true);
      trozos.push(new Uint8Array(lh.buffer), nombre, datos);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, h, true);
      ch.setUint16(14, f, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, datos.length, true);
      ch.setUint32(24, datos.length, true);
      ch.setUint16(28, nombre.length, true);
      ch.setUint32(42, offset, true);
      centro.push(new Uint8Array(ch.buffer), nombre);
      offset += 30 + nombre.length + datos.length;
    }

    const cd = concatenar(centro);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, archivos.length, true);
    eocd.setUint16(10, archivos.length, true);
    eocd.setUint32(12, cd.length, true);
    eocd.setUint32(16, offset, true);
    return concatenar(trozos.concat([cd, new Uint8Array(eocd.buffer)]));
  }

  function textoA(texto) { return new TextEncoder().encode(texto); }

  function descargarBlob(nombre, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  window.ParrotZip = {
    esc: esc,
    zip: zip,
    texto: textoA,
    bytes: b64aBytes,
    dataURL: partirDataURL,
    extensionDe: extensionDe,
    dimensiones: dimensiones,
    color: normalizarColor,
    descargar: descargarBlob
  };
})();
