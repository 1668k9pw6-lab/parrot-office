/* Parrot Office — inflate (RFC 1951) + zlib (RFC 1950), implementacion propia.
   Necesario para LEER .docx / .xlsx / .pptx reales, que comprimen con deflate. */
(function () {
  'use strict';

  function InflateError(m) { this.message = m; this.name = 'InflateError'; }
  InflateError.prototype = Object.create(Error.prototype);

  // ---------- lector de bits ----------
  function BitReader(u8) {
    this.d = u8; this.p = 0; this.bit = 0; this.word = 0; this.has = 0;
  }
  BitReader.prototype._cargar = function () {
    while (this.has <= 24) {
      if (this.p >= this.d.length) { this.word |= 0 << this.has; this.has += 8; return; }
      this.word |= this.d[this.p++] << this.has;
      this.has += 8;
    }
  };
  BitReader.prototype.bits = function (n) {
    while (this.has < n) this._cargar();
    const v = this.word & ((1 << n) - 1);
    this.word >>>= n; this.has -= n;
    return v;
  };
  BitReader.prototype.alinear = function () {
    const descartar = this.has & 7;
    this.word >>>= descartar; this.has -= descartar;
  };
  BitReader.prototype.bytes = function (n) {
    this.alinear();
    const out = new Uint8Array(n);
    let k = 0;
    while (this.has > 0 && k < n) { out[k++] = this.word & 0xFF; this.word >>>= 8; this.has -= 8; }
    while (k < n) {
      if (this.p >= this.d.length) throw new InflateError('fin de datos');
      out[k++] = this.d[this.p++];
    }
    return out;
  };

  // ---------- Huffman (tabla canonica precalculada) ----------
  function decodificar(br, t) {
    let codigo = 0;
    for (let l = 1; l <= t.maxL; l++) {
      codigo = (codigo << 1) | br.bits(1);
      const idx = codigo - t.primerCodigo[l];
      if (idx >= 0 && idx < t.conteo[l]) return t.simbolos[t.base[l] + idx];
    }
    throw new InflateError('codigo huffman invalido');
  }

  function tablaHuff(largos) {
    const maxL = Math.max.apply(null, largos);
    const conteo = new Array(maxL + 2).fill(0);
    for (const l of largos) if (l) conteo[l]++;
    const base = new Array(maxL + 2).fill(0);
    let acc = 0;
    for (let l = 1; l <= maxL; l++) { base[l] = acc; acc += conteo[l]; }
    const primerCodigo = new Array(maxL + 2).fill(0);
    let codigo = 0;
    for (let l = 1; l <= maxL; l++) { codigo = (codigo + conteo[l - 1]) << 1; primerCodigo[l] = codigo; }
    // simbolos ordenados por (longitud, simbolo)
    const simbolos = new Array(largos.length).fill(0);
    const offs = base.slice();
    for (let s = 0; s < largos.length; s++) if (largos[s]) simbolos[offs[largos[s]]++] = s;
    return { largos: largos, simbolos: simbolos, primerCodigo: primerCodigo, conteo: conteo, base: base, maxL: maxL };
  }

  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CLEN_ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  function inflarCrudo(u8) {
    const br = new BitReader(u8);
    const salida = [];
    let final = false;
    while (!final) {
      final = br.bits(1);
      const tipo = br.bits(2);
      if (tipo === 0) {
        const resto = br.bytes(4);
        const len = resto[0] | resto[1] << 8;
        salida.push(br.bytes(len));
      } else if (tipo === 1 || tipo === 2) {
        let tLitro, tDist;
        if (tipo === 1) {
          const largos = new Array(288).fill(0);
          for (let i = 0; i < 144; i++) largos[i] = 8;
          for (let i = 144; i < 256; i++) largos[i] = 9;
          for (let i = 256; i < 280; i++) largos[i] = 7;
          for (let i = 280; i < 288; i++) largos[i] = 8;
          tLitro = tablaHuff(largos);
          tDist = tablaHuff(new Array(30).fill(5));
        } else {
          const hlit = br.bits(5) + 257;
          const hdist = br.bits(5) + 1;
          const hclen = br.bits(4) + 4;
          const clLargos = new Array(19).fill(0);
          for (let i = 0; i < hclen; i++) clLargos[CLEN_ORD[i]] = br.bits(3);
          const tCl = tablaHuff(clLargos);
          const largos = new Array(hlit + hdist).fill(0);
          let i = 0;
          while (i < hlit + hdist) {
            const s = decodificar(br, tCl);
            if (s < 16) largos[i++] = s;
            else if (s === 16) { const r = br.bits(2) + 3; const v = largos[i - 1]; for (let k = 0; k < r; k++) largos[i++] = v; }
            else if (s === 17) { const r = br.bits(3) + 3; for (let k = 0; k < r; k++) largos[i++] = 0; }
            else { const r = br.bits(7) + 11; for (let k = 0; k < r; k++) largos[i++] = 0; }
          }
          tLitro = tablaHuff(largos.slice(0, hlit));
          tDist = tablaHuff(largos.slice(hlit));
        }
        // ventana deslizante
        const ventana = [];
        for (;;) {
          const s = decodificar(br, tLitro);
          if (s < 256) { ventana.push(s); if (ventana.length > 32768) ventana.splice(0, ventana.length - 32768); continue; }
          if (s === 256) break;
          const li = s - 257;
          if (li >= LBASE.length) throw new InflateError('simbolo largo invalido');
          let largo = LBASE[li];
          if (LEXT[li]) largo += br.bits(LEXT[li]);
          const ds = decodificar(br, tDist);
          if (ds >= DBASE.length) throw new InflateError('simbolo dist invalido');
          let dist = DBASE[ds];
          if (DEXT[ds]) dist += br.bits(DEXT[ds]);
          if (dist > ventana.length) throw new InflateError('distancia mayor a la ventana');
          for (let k = 0; k < largo; k++) { ventana.push(ventana[ventana.length - dist]); }
          if (ventana.length > 32768) ventana.splice(0, ventana.length - 32768);
        }
        salida.push(Uint8Array.from(ventana));
      } else throw new InflateError('tipo de bloque invalido');
    }
    // unir
    let total = 0;
    for (const t of salida) total += t.length;
    const out = new Uint8Array(total);
    let p = 0;
    for (const t of salida) { out.set(t, p); p += t.length; }
    return out;
  }

  // zlib wrapper: 2 bytes de cabecera, luego deflate, luego adler32
  function inflarZlib(u8) {
    if (u8.length < 2) throw new InflateError('zlib muy corto');
    const cmf = u8[0], flg = u8[1];
    if ((cmf & 0x0F) !== 8) throw new InflateError('metodo de compresion no soportado');
    if (((cmf << 8) | flg) % 31 !== 0) throw new InflateError('cabecera zlib invalida');
    const cuerpo = u8.subarray(2);
    return inflarCrudo(cuerpo);
  }

  // En ZIP, method 8 puede traer deflate CRUDO (sin cabecera zlib) o con wrapper.
  // Se detecta solo: si parece zlib valido se usa el wrapper; si no, crudo.
  function auto(datos) {
    if (datos.length >= 2 && (datos[0] & 0x0F) === 8 && (((datos[0] << 8) | datos[1]) % 31 === 0)) {
      try { return inflarZlib(datos); } catch (e) { /* seguir a crudo */ }
    }
    return inflarCrudo(datos);
  }

  window.ParrotInflate = { inflar: inflarCrudo, zlib: inflarZlib, auto: auto, InflateError: InflateError };
})();
