/* ============================================================
   Parrot Office — activación por claves de un solo uso
   ------------------------------------------------------------
   · Las claves tienen la forma PARROT-XXXX-XXXX-XXXX
   · En el código SOLO se guarda el hash SHA-256 de cada clave
     (nadie puede leer la clave mirando el archivo)
   · Cada clave sirve UNA vez: al activarse queda marcada como
     usada en este equipo
   · 5 intentos fallidos → bloqueo temporal de 30 segundos
   · SIN INTERNET: todo se valida en tu propia computadora

   AVISO HONESTO: esta es una cerradura de puerta, no una caja
   fuerte. Alguien que sepa de computadoras podría saltársela
   mirando el código. Para algo más serio haría falta un
   servidor que valide las claves.
   ============================================================ */
(function () {
  'use strict';

  var LS_ACTIVO = 'parrot-activado';
  var LS_USADAS = 'parrot-claves-usadas';
  var LS_INTENTOS = 'parrot-claves-intentos';
  var MAX_INTENTOS = 5;
  var ESPERA_MS = 30000;

  /* ---------- SHA-256 puro (sin librerías) ---------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var msg = unescape(encodeURIComponent(ascii)); // bytes UTF-8
    var l = msg.length;
    var withPad = msg + String.fromCharCode(0x80);
    while (withPad.length % 64 !== 56) withPad += String.fromCharCode(0);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    // longitud en bits al final: palabra alta (0) + palabra baja (bits)
    var bits = l * 8;
    withPad += String.fromCharCode(0) + String.fromCharCode(0) + String.fromCharCode(0) + String.fromCharCode(0);
    for (var i = 0; i < 4; i++) withPad += String.fromCharCode((bits >>> (24 - i * 8)) & 0xff);

    var w = new Array(64);
    for (var b = 0; b < withPad.length; b += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (withPad.charCodeAt(b + t * 4) << 24) | (withPad.charCodeAt(b + t * 4 + 1) << 16) |
               (withPad.charCodeAt(b + t * 4 + 2) << 8) | withPad.charCodeAt(b + t * 4 + 3);
      }
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rr(w[t2 - 15], 7) ^ rr(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = rr(w[t2 - 2], 17) ^ rr(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        var maj = (a & bb) ^ (a & c) ^ (bb & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = bb; bb = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var hex = '';
    for (var k = 0; k < 8; k++) {
      for (var s = 28; s >= 0; s -= 4) hex += ((H[k] >>> s) & 0xf).toString(16);
    }
    return hex;
  }

  /* ---------- almacenamiento ---------- */
  function leer(clave, porDefecto) {
    try { var v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto; }
    catch (e) { return porDefecto; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }

  /* ---------- API ---------- */
  var API = {
    sha256: sha256,

    // id corto de una clave = primeros 8 caracteres de su hash
    idDe: function (clave) { return sha256(clave).slice(0, 8); },

    estado: function () {
      var act = leer(LS_ACTIVO, null);
      var usadas = leer(LS_USADAS, []);
      var conocidas = Object.keys(API.HASHES || {});
      return {
        activado: !!act,
        clave: act ? act.clave : null,
        fecha: act ? act.fecha : null,
        usadas: usadas,
        restantes: conocidas.filter(function (id) { return usadas.indexOf(id) < 0; }).length,
        total: conocidas.length
      };
    },

    activar: function (claveCruda) {
      var clave = String(claveCruda || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!clave) return { ok: false, msg: 'Escribí una clave.' };

      // bloqueo temporal por intentos fallidos
      var intentos = leer(LS_INTENTOS, { n: 0, hasta: 0 });
      if (intentos.hasta && Date.now() < intentos.hasta) {
        var seg = Math.ceil((intentos.hasta - Date.now()) / 1000);
        return { ok: false, msg: 'Demasiados intentos fallidos. Esperá ' + seg + ' segundos.' };
      }

      if (!/^PARROT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clave)) {
        return API._fallo(intentos, 'El formato no es válido. Debe ser PARROT-XXXX-XXXX-XXXX.');
      }

      var id = API.idDe(clave);
      var hash = sha256(clave);
      var valido = API.HASHES && API.HASHES[id] === hash;
      if (!valido) return API._fallo(intentos, 'Esa clave no existe.');

      var usadas = leer(LS_USADAS, []);
      if (usadas.indexOf(id) >= 0) {
        return API._fallo(intentos, 'Esa clave ya fue usada en este equipo. Cada clave sirve una sola vez.');
      }

      usadas.push(id);
      if (!guardar(LS_USADAS, usadas)) {
        return { ok: false, msg: 'No pude guardar la activación (almacenamiento lleno).' };
      }
      guardar(LS_ACTIVO, { clave: clave, id: id, fecha: new Date().toISOString() });
      guardar(LS_INTENTOS, { n: 0, hasta: 0 });
      var e2 = API.estado();
      return { ok: true, msg: '¡Parrot Office activado! Te quedan ' + e2.restantes + ' claves sin usar en este equipo.', restantes: e2.restantes };
    },

    _fallo: function (intentos, msg) {
      var n = (intentos.n || 0) + 1;
      var hasta = 0;
      if (n >= MAX_INTENTOS) { hasta = Date.now() + ESPERA_MS; n = 0; }
      guardar(LS_INTENTOS, { n: n, hasta: hasta });
      if (hasta) return { ok: false, msg: msg + ' Bloqueo 30 segundos por intentos fallidos.' };
      return { ok: false, msg: msg + ' (' + (MAX_INTENTOS - n) + ' intentos antes del bloqueo)' };
    },

    // solo para pruebas: olvida la activación de este navegador
    olvidar: function () {
      try { localStorage.removeItem(LS_ACTIVO); return true; } catch (e) { return false; }
    },

    /* Hashes SHA-256 de las 5 claves generadas (la clave en sí NO está aquí).
       Formato: id-corto -> hash completo. */
    HASHES: {
      'bbd35777': 'bbd35777d0e29add472d13ec688f7798631602129216bc753e90970817fb16f8',
      'fbe29639': 'fbe29639a1ee55687634acca41775c1b47aaeff24e8d2a4cba1ef9ec59fd0c4d',
      '855df867': '855df867aa5005325a80e26da270f5163310fba36b0f4c15cb0f1dc128792399',
      '016739a2': '016739a258170f27eb6fc10fa7aa99b91afd117069da1922c58f6a62b22a3fa1',
      '922ae280': '922ae2800490ec83fa5f6cdd0f8efc35bff998c899657e661b94265af5e470dd'
    }
  };

  window.ParrotClaves = API;
})();
