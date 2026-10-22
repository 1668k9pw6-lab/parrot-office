# Parrot Office

Suite de ofimática propia, hecha desde cero. Sin copiar nada de Office:
conceptos generales (procesador de textos, hoja de cálculo, presentaciones)
e implementación propia, código 100% original.

## Cómo abrir

Doble clic en `index.html` y listo (se abre en tu navegador).

En Windows, para tenerlo como aplicación de escritorio:

```
powershell -ExecutionPolicy Bypass -File instalar.ps1
```

Crea el acceso **Parrot Office** en el escritorio, que abre la suite como
aplicación de verdad (ventana propia, sin barra de direcciones ni pestañas)
y arranca solo el servidor del chat de Orión si no está corriendo.

Todo funciona sin internet, directo del disco.

## Activación por claves (un solo uso)

La primera vez que se abre, pide una **clave de activación**. Son 5 claves
`PARROT-XXXX-XXXX-XXXX`, están en `claves-publicas.txt` (en la carpeta del
proyecto) y **cada una sirve una sola vez** en esta computadora.

- En el código solo se guarda el **hash SHA-256** de cada clave (escrito a
  mano en `oficina-claves.js`, verificado contra Python): nadie puede leer la
  clave mirando el archivo.
- 5 intentos fallidos → bloqueo de 30 segundos.
- Sin internet: la validación se hace en tu PC.

**Honesto**: es una cerradura de puerta, no una caja fuerte. Como todo se
valida en la propia computadora, alguien que sepa de computadoras podría
saltárselo. Para algo más serio haría falta un servidor que valide las claves.

## Formatos que lee y escribe

| Formato | Leer | Escribir |
|---|---|---|
| .docx (Word) | ✓ | ✓ |
| .xlsx (Excel) | ✓ | ✓ |
| .pptx (PowerPoint) | ✓ | ✓ |
| .pdf | ✓ (texto) | ✓ |
| .md / .html / .txt | ✓ | ✓ |
| .csv | ✓ | ✓ |
| .json (Parrot) | ✓ | ✓ |

La lectura de formatos reales está en `oficina-leer.js` y usa
`oficina-inflate.js`, un inflate (deflate/zlib) escrito desde cero. No hace
falta internet ni ninguna librería: se abren los archivos que genera Word,
Excel y PowerPoint de verdad.

Detalles del lector de PDF, que es el más complicado:
- Decodifica los streams según el `/Filter` real del diccionario:
  `FlateDecode`, `ASCII85Decode` y `ASCIIHexDecode` (los tres que usa la
  industria; `LZWDecode` y los de imagen devuelan aviso honesto).
- Mapea los códigos de carácter con el CMap `ToUnicode` **de la fuente que
  está activa** en ese momento (`/Fx N Tf`), no con uno global. Si se mezclan
  los mapas de varias fuentes, el texto sale con símbolos desplazados.
- Respeta `/Length` cuando es válido y recorta el salto de línea final.
- Probado con PDFs de ReportLab (ASCII85+Flate), de Chrome (Identity-H con
  CMaps por fuente) y de otras herramientas: texto y acentos correctos.

## Lo nuevo (versión 2)

### Menú de inicio (`index.html`)
- **Recientes**: todo lo que fuiste guardando o abriendo, con nombre, fecha,
  tamaño y vista previa del contenido, como el historial de Office. Se pueden
  **fijar** arriba (📌) y buscar por nombre o contenido.
- **Crear nuevo**: los tres programas y **15 plantillas** (carta, informe,
  minuta, recibo, presupuesto, control de gastos, inventario, agenda,
  portada, título y contenido, dos columnas, cierre…).
- **Accesos rápidos**: abrir archivo de la PC (según el tipo te lleva al
  programa correcto y abre el diálogo), importar CSV, activar otra clave,
  ver atajos, acerca de.

### Menú Archivo centralizado (`oficina-menu.js`)
Un solo botón **📂 Archivo** en cada programa reúne: Nuevo (con plantillas),
Abrir, Guardar, **Importar** (todos los formatos que lee), **Exportar**
(todos los formatos, con descripción de cada uno) e Imprimir. Al lado,
**↗ Compartir** y **💬 Orión**.

### Compartir con otros programas
WhatsApp (abre el chat con el texto), correo (abre tu programa de mail),
copiar al portapapeles, descargar el archivo real (.docx/.xlsx/.pptx, que se
abre con doble clic en Word/Excel/PowerPoint) y el compartir del sistema
cuando el navegador lo permite.

### Chat con Orión (`chat.html` + `parrot-chat.js`)
Botón 💬 en todas las pantallas. Ventana emergente para pedir ayuda o
directamente **"crear una hoja de cálculo con presupuesto"**: Orión responde
y la hoja se crea de verdad con la plantilla. Si el servidor no está
corriendo, el chat queda en **modo local**: entiende lo básico (crear con
plantillas, fórmulas, atajos, exportaciones) sin necesidad del modelo.
El servidor (`parrot-chat.js`, puerto 8790) reenvía al proxy local de
OpenRouter (8787) y se autoarranca desde el lanzador del escritorio.

### Módulos

### 1. Procesador de textos — `procesador.html`
- Formato: negrita, cursiva, subrayado, tachado, listas, citas,
  alineación, 5 fuentes, 6 tamaños, color de texto (Ctrl+B/I/U incluidos)
- **Buscar y reemplazar** (Ctrl+F / Ctrl+H): resalta las coincidencias,
  navega entre ellas (F3 o ↑↓) y reemplaza todo de una vez
- Guardado automático cada 10 s (localStorage) + botón Guardar (Ctrl+S)
- Abrir .json de Parrot, .html, .txt y .md (markdown básico)
- Exportar a .html (con formato), .txt, **.docx real (Word)**, **.md
  (Markdown)** y **.pdf** (por el diálogo de impresión, con la hoja en
  blanco y sin la interfaz)
- Contador de palabras, caracteres, párrafos y tiempo de lectura en vivo
- Nombre del documento editable (clic en la barra de abajo)
- Insertar imágenes desde archivo · insertar la fecha de hoy (📅)
- Plantillas: carta formal, informe, minuta de reunión, recibo de pago

### 2. Hoja de cálculo — `hoja.html`
Motor de fórmulas propio (tokenizer + parser + evaluador):
- Aritmética con precedencia y paréntesis: `+ - * / ^ %`
- Comparaciones: `= <> < > <= >=` · concatenado con `+`
- Referencias de celda (`A1`) y rangos (`A1:B10`)
- Funciones: SUMA, PROMEDIO, MAX, MIN, CONTAR, **CONTAR.SI**,
  **SUMAR.SI**, SI, **Y**, **O**, **NO**, ABS, REDONDEAR, **ENTERO**,
  **RAIZ**, CONCATENAR, LARGO, MAYUSC, MINUSC
- Recálculo en vivo, detección de ciclos (#CICLO!) y errores
  (#DIV/0!, #REF!, #VALOR!)
- Negrita/cursiva/alineación por celda, decimales, separador de miles,
  **formato moneda**, color de texto y fondo
- **Selección de rango** (shift+clic), con suma y cantidad de celdas en la
  barra de estado · **Copiar** (Ctrl+C) y **pegar desde Excel** (Ctrl+V,
  texto tabulado) · **Vaciar** el rango (Supr)
- Acepta números en formato español ("1.234,56") e internacional (3.14)
- Barra de fórmulas, Enter avanza, Tab navega
- Agregar/eliminar filas y columnas (+10 filas, +fila, -fila, +col, -col)
- Guardar/Abrir JSON · **Importar .csv** · Exportar CSV y HTML
- **Exportar .xlsx real (Excel)** con fórmulas vivas, formatos numéricos,
  negritas y colores preservados
- Plantillas: presupuesto, control de gastos, inventario, agenda

### 3. Presentaciones — `presentaciones.html`
- Diapositivas 16:9 con miniaturas, añadir/duplicar/eliminar y
  **reordenar** (← →)
- Elementos de texto (editables), rectángulos, círculos e **imágenes**
  (arrastrables y redimensionables, viajan en el JSON, se ven en las
  miniaturas y en el modo presentar; se reducen solas antes de guardar)
- **Alineación** de elementos (izquierda, centrado, derecha, arriba,
  medio, abajo) y **orden de capas** (traer al frente / enviar al fondo)
- Color de texto/fondo por elemento, tamaño de fuente, fondo por diapo
- Modo presentación a pantalla completa (← → para navegar, Esc para salir)
- Guardar/Abrir JSON (Ctrl+S) · Exportar .json
- Plantillas de diapositiva: portada, título y contenido, dos columnas,
  cierre
- **Exportar .pptx real (PowerPoint)**: cada diapositiva con sus textos,
  formas e imágenes en la posición y tamaño originales
- **Exportar .html**: presentación navegable de un solo archivo
  (flechas, clic en los costados, Inicio/Fin), ideal para compartir

## Exportación real: cómo funciona

Los .docx / .xlsx / .pptx se generan **en la propia computadora**, sin
internet y sin librerías externas, con cuatro archivos JS originales:

- `oficina-zip.js` — empaquetador ZIP (con CRC32) que arma los contenedores OOXML
- `oficina-docx.js` — recorre el documento del procesador y lo convierte a
  Word: estilos de título, citas, código, listas, tablas, colores e imágenes
- `oficina-xlsx.js` — vuelca la hoja a Excel: valores, **fórmulas vivas**,
  formatos numéricos, negrita, cursiva y colores
- `oficina-pptx.js` — convierte cada diapositiva en un slide de PowerPoint
  con textos, formas e imágenes posicionadas al pixel

Verificado con las librerías oficiales (python-docx, openpyxl, python-pptx):
los tres formatos abren, se leen y mantienen el contenido.

## Apariencia

`oficina-tema.css` es el tema compartido por las cuatro páginas. Se carga
después del `<style>` de cada una, así que pisa las variables y pule lo que
ya existe sin romper la maqueta.

La idea es **serio y minimalista, pero que llame la atención**:
- Tinta oscura (`#0d1015`) y paneles planos con bordes de 1 px: nada de
  sombras pesadas ni degradados de fondo.
- Un solo color que "grita": el **verde loro** (`#17c98a`), con mango
  (`#ffc53d`) y coral (`#ff6b52`) como acentos de segunda.
- La firma visual es la **pluma de loro**: una línea de 3 px arriba de todo
  con degradado verde → mango → coral. Esté donde esté, se reconoce.
- En la portada, los chips de formato (.docx .xlsx .pptx .pdf .md .csv
  .html .txt) comunican de un golpe qué sabe hacer la suite.
- Botón principal por barra (Guardar, Presentar) en verde sólido; el resto
  plano, para que la acción importante se vea sin pensar.

## Decisiones técnicas

- Web pura (HTML + CSS + JS vanilla): corre en cualquier lado, sin instalar
- Motor de fórmulas escrito desde cero y probado con 43 casos automáticos
  (incluyen ciclos, errores, formatos de número y agregados con texto)
- Edición sobre `contenteditable` + `document.execCommand` (procesador):
  suficiente para esta etapa; si pide más control, se migra a motor propio
- Estilo oscuro con verde/amarillo loro
- `oficina-historial.js` guarda los recientes en localStorage con tope de 30
  documentos: si el almacenamiento se llena, descarta los más viejos que no
  estén fijados (probado con manejo de error de cuota)
- El acceso del escritorio es un `.vbs` que lanza Chrome en modo app
  (`--app=` + `--user-data-dir` propio). El perfil dedicado es la clave: si
  se usa el perfil por defecto y Chrome ya está abierto, el `--app` se pierde
  y abre como ventana común. Un `.lnk` hecho a mano no sirvió porque le falta
  el `LinkTargetIDList`, que solo se puede construir con APIs de shell.

## Roadmap futuro (cuando quieras)

- [ ] Versión escritorio con Electron
- [ ] Sincronizar archivos entre tus PCs
- [ ] Leer .pptx con imágenes ya incrustadas (hoy las lee, pero el contenido
      de `word/media` se recupera solo cuando el ZIP lo guarda sin comprimir)
