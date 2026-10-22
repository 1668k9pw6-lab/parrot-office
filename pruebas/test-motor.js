#!/usr/bin/env node
/* ============================================================
   Parrot Office — pruebas del motor de fórmulas
   ------------------------------------------------------------
   Extrae el motor (tokenizer + parser + evaluador) de hoja.html
   y corre 44 casos: aritmética, precedencia, comparaciones,
   funciones, rangos, ciclos, formatos de número español e
   ignorado de texto en agregados (como Excel).

   Uso:  node pruebas/test-motor.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

// ---- extraer el motor de hoja.html ----
const html = fs.readFileSync(path.join(__dirname, '..', 'hoja.html'), 'utf8');
const ini = html.indexOf('// ============ TOKENIZER');
const fin = html.indexOf('// valor mostrado en una celda');
if (ini < 0 || fin < 0) {
  console.error('No encontré el motor dentro de hoja.html');
  process.exit(1);
}
let motor = html.slice(ini, fin);
motor = 'let datos = {};\n' + motor + '\n' +
  'global.__test = function (datosObj, expr) {\n' +
  '  datos = Object.assign({}, datosObj, { ZZ1: { f: expr } });\n' +
  '  try { return String(getValor("ZZ1")); } catch (e) { return "ERR:" + e.message; }\n' +
  '};\n';
new Function(motor)();

let pasan = 0, fallan = 0;
function t(expr, esperado, datos) {
  const real = global.__test(datos || { ZZ1: { f: expr } }, expr);
  const ok = real === String(esperado);
  if (ok) pasan++; else fallan++;
  console.log((ok ? 'OK   ' : 'FALLA') + ' ' + String(expr).padEnd(44) + ' => ' + real +
    (ok ? '' : '   (esperado: ' + esperado + ')'));
}

// ---- aritmética y precedencia ----
t('=2+3*4', 14);
t('=(2+3)*4', 20);
t('=2^10', 1024);
t('=10/4', 2.5);
t('=10%3', 1);
t('=-5+2', -3);
t('="ho"+"la"', 'hola');
t('=2^-1', 0.5);

// ---- comparaciones ----
t('=5>3', 'true');
t('="a"="a"', 'true');
t('=1<>2', 'true');
t('=3>=3', 'true');

// ---- funciones ----
t('=REDONDEAR(3.14159,2)', 3.14);
t('=ENTERO(3.9)', 3);
t('=RAIZ(144)', 12);
t('=ABS(-7)', 7);
t('=CONCATENAR("a","b","c")', 'abc');
t('=LARGO("parrot")', 6);
t('=MAYUSC("hola")', 'HOLA');
t('=MINUSC("HOLA")', 'hola');
t('=SI(1>0,"sí","no")', 'sí');
t('=SI(1<0,"sí","no")', 'no');
t('=SI(1<0,"sí")', 'false');
t('=Y(1>0,2>1)', 'true');
t('=Y(1>0,2>0,3>5)', 'false');
t('=O(1<0,2>1)', 'true');
t('=NO(1>0)', 'false');
t('=SUMA(1,2,3)', 6);

// ---- referencias, rangos, ciclos, formatos ----
const hoja = {
  A1: { f: '10' }, A2: { f: '20' }, A3: { f: '30' },
  B1: { f: 'Sí' }, B2: { f: 'No' }, B3: { f: 'Sí' },
  C1: { f: '100' }, C2: { f: '200' }, C3: { f: '300' },
  D1: { f: '=A1*2' }, D2: { f: '=SUMA(A1:A3)' }
};
t('=SUMA(A1:A3)', 60, hoja);
t('=PROMEDIO(A1:A3)', 20, hoja);
t('=MAX(A1:A3)', 30, hoja);
t('=MIN(A1:A3)', 10, hoja);
t('=CONTAR(A1:A3)', 3, hoja);
t('=CONTAR.SI(B1:B3,"Sí")', 2, hoja);
t('=SUMAR.SI(B1:B3,"No",C1:C3)', 200, hoja);
t('=SUMAR.SI(B1:B3,"Sí",C1:C3)', 400, hoja);
t('=PROMEDIO(A1:A3)*CONTAR(A1:A3)', 60, hoja);
t('=D2+D1', 80, hoja);
t('=SI(A1>5,"grande","chico")', 'grande', hoja);
t('=1/0', 'ERR:#DIV/0!', hoja);
t('=ZZ1', 'ERR:#CICLO!', { A1: { f: '=ZZ1' }, ZZ1: { f: '=A1' } });
t('=A1*2', 2469.12, { A1: { f: '1.234,56' } });
t('=SUMA(A1:A2)', 10, { A1: { f: '10' }, A2: { f: 'texto' } });   // el texto se ignora, como Excel

// punto flotante: 3,14+1 se guarda como 4.140000000000001; la celda lo muestra redondeado
const r41 = global.__test({ A1: { f: '3,14' }, ZZ1: { f: '=A1+1' } }, '=A1+1');
const ok41 = Math.round(parseFloat(r41) * 100) / 100 === 4.14;
if (ok41) pasan++; else fallan++;
console.log((ok41 ? 'OK   ' : 'FALLA') + ' =A1+1 (float)'.padEnd(44) + ' => ' + r41);

console.log('\n' + pasan + ' pasan, ' + fallan + ' fallan');
process.exit(fallan ? 1 : 0);
