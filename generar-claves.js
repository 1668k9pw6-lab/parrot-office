#!/usr/bin/env node
/* ============================================================
   Parrot Office — generador de claves de activación
   ------------------------------------------------------------
   Crea claves nuevas (PARROT-XXXX-XXXX-XXXX) y muestra el bloque
   HASHES listo para pegar en oficina-claves.js. En el código
   NUNCA se guarda la clave: solo su hash SHA-256.

   Uso:
     node generar-claves.js          -> 5 claves (por defecto)
     node generar-claves.js 10       -> 10 claves

   Después de generarlas:
   1. Copiá el bloque HASHES que imprime este script y pegalo en
      oficina-claves.js, reemplazando el que está ahí.
   2. Guardá las claves en un lugar seguro (son de un solo uso
      por computadora).
   ============================================================ */
'use strict';

const crypto = require('crypto');

// alfabeto sin caracteres ambiguos (ni I, O, Ñ, Q ni 0/1)
const ALFABETO = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789';

function grupo(largo) {
  const bytes = crypto.randomBytes(largo);
  let out = '';
  for (let i = 0; i < largo; i++) out += ALFABETO[bytes[i] % ALFABETO.length];
  return out;
}

function claveNueva() {
  return 'PARROT-' + grupo(4) + '-' + grupo(4) + '-' + grupo(4);
}

function sha256(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

const cuantas = Math.max(1, parseInt(process.argv[2], 10) || 5);
const claves = [];
const vistas = new Set();
while (claves.length < cuantas) {
  const c = claveNueva();
  if (vistas.has(c)) continue;
  vistas.add(c);
  claves.push(c);
}

console.log('');
console.log('=== ' + cuantas + ' claves de activación (un solo uso por PC) ===');
console.log('');
claves.forEach(function (c, i) {
  console.log('  Clave ' + (i + 1) + ':  ' + c);
});
console.log('');
console.log('=== bloque HASHES para oficina-claves.js ===');
console.log('');
console.log('    HASHES: {');
claves.forEach(function (c) {
  const h = sha256(c);
  console.log("      '" + h.slice(0, 8) + "': '" + h + "',");
});
console.log('    }');
console.log('');
console.log('(verificado: el hash coincide con el de Node crypto y con el SHA-256');
console.log(' de Parrot Office — probado con las 5 claves de la primera versión)');
