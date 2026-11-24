import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { PedidoGuardado } from '../../services/pedidos';

const ancho = 595.28;
const alto = 841.89;
const margen = 42;
const derecha = ancho - margen;
const tinta = rgb(.22, .13, .18);
const rosa = rgb(1, .88, .93);
const acento = rgb(.57, .18, .34);
const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Matamoros' });

function envolver(texto: string, fuente: PDFFont, tamano: number, anchoMaximo: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const candidata = actual ? actual + ' ' + palabra : palabra;
    if (fuente.widthOfTextAtSize(candidata, tamano) <= anchoMaximo) {
      actual = candidata;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = '';
    for (const caracter of palabra) {
      if (fuente.widthOfTextAtSize(actual + caracter, tamano) > anchoMaximo) {
        lineas.push(actual);
        actual = '';
      }
      actual += caracter;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function generarComprobante(pedido: PedidoGuardado, logo: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Comprobante de compra de Zeli Creativa');
  pdf.setLanguage('es-MX');
  const [regular, negrita, marca] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedPng(logo),
  ]);
  const caracteres = new Set(regular.getCharacterSet());
  const seguro = (texto: string) => Array.from(texto.normalize('NFC'), caracter =>
    /\s/u.test(caracter) ? ' ' : caracteres.has(caracter.codePointAt(0)!) ? caracter : '?',
  ).join('');
  const proporcion = Math.min(126 / marca.width, 56 / marca.height);
  let pagina: PDFPage;
  let y = 0;

  function escribir(texto: string, x: number, nivel: number, tamano = 10, fuente = regular): void {
    pagina.drawText(texto, { x, y: nivel, size: tamano, font: fuente, color: tinta });
  }

  function alinear(texto: string, borde: number, nivel: number, fuente = regular): void {
    escribir(texto, borde - fuente.widthOfTextAtSize(texto, 10), nivel, 10, fuente);
  }

  function abrirPagina(primera = false): void {
    pagina = pdf.addPage([ancho, alto]);
    pagina.drawRectangle({ x: 0, y: alto - 112, width: ancho, height: 112, color: rosa });
    pagina.drawImage(marca, {
      x: margen, y: alto - 84, width: marca.width * proporcion, height: marca.height * proporcion,
    });
    escribir('Comprobante de compra', 202, alto - 55, 21, negrita);
    pagina.drawText('PAGO SIMULADO', { x: 203, y: alto - 76, size: 10, font: negrita, color: acento });
    y = alto - 143;
    escribir('Folio: ' + seguro(pedido.folio), margen, y, 11, negrita);
    y -= 19;
    if (primera) {
      escribir('Fecha: ' + seguro(fecha.format(new Date(pedido.creado_en))), margen, y);
      alinear('Estado: ' + seguro(pedido.estado).toLocaleUpperCase('es-MX'), derecha, y, negrita);
      y -= 17;
      const nombre = seguro(pedido.cliente?.nombre?.trim() || 'Nombre no disponible');
      for (const linea of envolver('Cliente: ' + nombre, regular, 10, derecha - margen)) {
        escribir(linea, margen, y);
        y -= 14;
      }
    }
    y -= 20;
  }

  function encabezadoPartidas(): void {
    pagina.drawRectangle({ x: margen, y: y - 7, width: derecha - margen, height: 24, color: rosa });
    escribir('Producto / variante / SKU', margen + 8, y, 10, negrita);
    alinear('Cant.', 347, y, negrita);
    alinear('Precio unitario', 448, y, negrita);
    alinear('Importe', derecha - 8, y, negrita);
    y -= 29;
  }

  abrirPagina(true);
  encabezadoPartidas();
  for (const partida of pedido.detalle_pedido) {
    const nombre = envolver(seguro(partida.nombre_producto), negrita, 10, 265);
    const varianteSku = envolver(
      seguro(partida.nombre_variante + ' · SKU: ' + partida.sku), regular, 10, 265,
    );
    if (y - (nombre.length + varianteSku.length) * 14 < 70 && y < alto - 260) {
      abrirPagina();
      encabezadoPartidas();
    }
    alinear(String(partida.cantidad), 347, y, negrita);
    alinear(moneda.format(partida.precio_unitario), 448, y);
    alinear(moneda.format(partida.subtotal), derecha - 8, y);
    for (const [lineas, fuente] of [[nombre, negrita], [varianteSku, regular]] as const) {
      for (const linea of lineas) {
        if (y < 70) {
          abrirPagina();
          encabezadoPartidas();
        }
        escribir(linea, margen + 8, y, 10, fuente);
        y -= 14;
      }
    }
    pagina!.drawLine({ start: { x: margen, y: y + 2 }, end: { x: derecha, y: y + 2 }, color: rosa });
    y -= 14;
  }

  if (y < 226) abrirPagina();
  y -= 12;
  for (const [etiqueta, importe] of [
    ['Subtotal', pedido.subtotal], ['IVA', pedido.iva], ['Descuentos', -pedido.descuento || 0],
    ['Envío', pedido.envio], ['Total definitivo', pedido.total],
  ] as const) {
    const total = etiqueta === 'Total definitivo';
    if (total) pagina!.drawRectangle({ x: 314, y: y - 6, width: derecha - 314, height: 23, color: rosa });
    escribir(etiqueta, 324, y, 10, total ? negrita : regular);
    alinear(moneda.format(importe) + (total ? ' MXN' : ''), derecha - 8, y, total ? negrita : regular);
    y -= 18;
  }
  escribir('Gracias por tu compra en Zeli Creativa.', margen, y - 13, 12, negrita);
  escribir('Compra de demostración con pago simulado. Este comprobante no es una factura fiscal.', margen, y - 32);

  for (const [indice, hoja] of pdf.getPages().entries()) {
    pagina = hoja;
    pagina.drawLine({ start: { x: margen, y: 48 }, end: { x: derecha, y: 48 }, color: rosa });
    escribir('Zeli Creativa · Comprobante académico', margen, 33, 9);
    alinear((indice + 1) + ' / ' + pdf.getPageCount(), derecha, 33);
  }
  return pdf.save();
}
