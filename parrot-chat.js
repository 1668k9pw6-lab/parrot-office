/* ============================================================
   Parrot Office — servidor del chat con Orión
   ------------------------------------------------------------
   Escucha en http://127.0.0.1:8790 (solo en esta computadora).
   La página chat.html le manda los mensajes y él los reenvía al
   proxy local de OpenRouter (127.0.0.1:8787), que es el que capa
   el tamaño de las respuestas.

   Arranque:  node parrot-chat.js        (o solo, desde el lanzador)
   Prueba:    curl -X POST http://127.0.0.1:8790/mensaje \
                -H "Content-Type: application/json" \
                -d "{\"texto\":\"hola\"}"
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = 8790;
const PROXY = { host: '127.0.0.1', port: 8787, path: '/api/v1/chat/completions' };
const MODELO = 'deepseek/deepseek-chat';

// ---- clave de OpenRouter: variable de entorno o archivo parrot-chat.key ----
function claveAPI() {
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 10) return process.env.OPENROUTER_API_KEY;
  try {
    const k = fs.readFileSync(path.join(__dirname, 'parrot-chat.key'), 'utf8').trim();
    if (k) return k;
  } catch (e) {}
  return '';
}

const SISTEMA = [
  'Sos Orión, el asistente dentro de Parrot Office, una suite de oficina',
  '(procesador de textos, hoja de cálculo y presentaciones) que funciona',
  'sin internet en la computadora del usuario, que es Sebastián ("Sebas").',
  '',
  'REGLAS:',
  '· Respondé siempre en español neutro, corto (máximo 120 palabras), claro y directo.',
  '· Sos práctico: si te pide algo concreto, decile exactamente dónde tocar.',
  '· Si te pide CREAR algo (documento, hoja, presentación, plantilla),',
  '  además de la respuesta humana, agregá AL FINAL una línea con este formato exacto:',
  '  [ACCION] {"app":"doc|hoja|pres","plantilla":"id"}',
  '  Los ids válidos son:',
  '   doc: blanco, carta, informe, minuta, recibo',
  '   hoja: blanco, presupuesto, gastos, inventario, agenda',
  '   pres: blanco, titulo, tituloContenido, dosColumnas, gracias',
  '· Si te pregunta por fórmulas, explicá la sintaxis con un ejemplo.',
  '· Nunca inventes funciones que Parrot Office no tiene.',
  '· Funciones reales de la hoja: =SUMA, =PROMEDIO, =MAX, =MIN, =CONTAR,',
  '  =CONTAR.SI, =SUMAR.SI, =SI, =Y, =O, =NO, =ABS, =REDONDEAR, =ENTERO,',
  '  =RAIZ, =CONCATENAR, =LARGO, =MAYUSC, =MINUSC, y operadores + - * / ^ % y comparaciones.',
  '· La hoja acepta selección de rangos (shift+clic), copiar (Ctrl+C) y',
  '  pegar desde Excel (Ctrl+V).',
  '· Todo se guarda en la PC; los .docx/.xlsx/.pptx son archivos reales.'
].join('\n');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const servidor = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/estado') {
    const key = claveAPI();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, conClave: !!key, modelo: MODELO }));
    return;
  }

  if (req.method === 'POST' && req.url === '/mensaje') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let cuerpo;
      try { cuerpo = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { res.writeHead(400); res.end('{"error":"JSON inválido"}'); return; }

      const texto = String(cuerpo.texto || '').slice(0, 2000);
      if (!texto.trim()) { res.writeHead(400); res.end('{"error":"mensaje vacío"}'); return; }

      const key = claveAPI();
      if (!key) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sin-clave' }));
        return;
      }

      const mensajes = [{ role: 'system', content: SISTEMA }];
      (Array.isArray(cuerpo.historial) ? cuerpo.historial.slice(-8) : []).forEach(m => {
        if (m && (m.rol === 'user' || m.rol === 'assistant') && m.texto) {
          mensajes.push({ role: m.rol, content: String(m.texto).slice(0, 1500) });
        }
      });
      mensajes.push({ role: 'user', content: texto });

      const payload = JSON.stringify({
        model: MODELO,
        max_tokens: 700,
        temperature: 0.4,
        messages: mensajes
      });

      const salida = http.request({
        hostname: PROXY.host, port: PROXY.port, path: PROXY.path, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
          'Content-Length': Buffer.byteLength(payload)
        }
      }, arriba => {
        const trozos = [];
        arriba.on('data', d => trozos.push(d));
        arriba.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          try {
            const j = JSON.parse(Buffer.concat(trozos).toString('utf8'));
            const contenido = j.choices && j.choices[0] && j.choices[0].message
              ? j.choices[0].message.content || ''
              : '';
            if (!contenido) {
              console.log('[chat] OpenRouter respondió sin contenido:', JSON.stringify(j).slice(0, 200));
              res.end(JSON.stringify({ error: 'sin-respuesta' }));
              return;
            }
            res.end(JSON.stringify({ respuesta: contenido }));
          } catch (e) {
            console.log('[chat] no pude leer la respuesta del proxy:', e.message);
            res.end(JSON.stringify({ error: 'respuesta-rota' }));
          }
        });
      });
      salida.on('error', e => {
        console.log('[chat] el proxy no responde (¿está corriendo or-proxy.js?): ' + e.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'proxy-caido' }));
      });
      salida.write(payload);
      salida.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('no encontrado');
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  const key = claveAPI();
  console.log('[chat] Orión escuchando en http://127.0.0.1:' + PUERTO);
  console.log('[chat] clave de OpenRouter: ' + (key ? 'OK (' + key.slice(0, 10) + '…)' : 'NO encontrada'));
  console.log('[chat] reenvía al proxy local 127.0.0.1:8787');
});
