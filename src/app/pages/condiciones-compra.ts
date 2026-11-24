import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VERSION_TERMINOS_COMPRA } from '../services/pedidos';

@Component({
  imports: [RouterLink],
  template: `
    <main class="container py-4 py-lg-5">
      <article class="documento mx-auto">
        <header class="p-3 p-sm-4">
          <p class="mb-1">Zeli Creativa · Demostración académica</p>
          <h1 class="mb-0">{{ titulo }}</h1>
        </header>
        <div class="p-3 p-sm-4 contenido">
          @switch (documento) {
            @case ('privacidad') {
              <p>Usa cuentas y datos ficticios para participar en la demostración.</p>
              <h2>Datos usados en la compra</h2>
              <p>La cuenta usa un nombre y correo. En el checkout se registra una dirección y un teléfono de entrega.
                Estos datos permiten asociar el pedido a la cuenta, consultar el seguimiento y gestionar solicitudes de devolución.</p>
              <h2>Acceso a los pedidos</h2>
              <p>El comprador puede consultar sus pedidos. Las cuentas administradoras autorizadas pueden ver la información necesaria para operar la demostración.
                Los comprobantes muestran el nombre y los detalles de la compra.</p>
              <p>Para consultar o pedir la corrección de datos de prueba, contacta al equipo de la demostración.</p>
            }
            @case ('devoluciones') {
              <p>Los cambios y devoluciones de este sitio forman parte del ejercicio académico.</p>
              <h2>Solicitar una devolución</h2>
              <ol>
                <li>Abre <a routerLink="/mis-pedidos">Mis pedidos</a> y consulta un pedido marcado como entregado.</li>
                <li>Elige <strong>Solicitar devolución</strong>, selecciona partidas y cantidades, y explica el motivo.</li>
                <li>Guarda el número de solicitud. Vuelve al seguimiento para consultar su estado y resolución.</li>
              </ol>
              <p>El equipo de la demostración revisa la solicitud y registra su resolución. Si recibe las partidas, puede registrar su reposición en inventario.
                La solicitud de devolución no genera por sí misma un reembolso.</p>
              <p>Para un cambio de producto, describe lo que solicitas en el motivo. El sistema registra devoluciones y su resolución.</p>
            }
            @case ('envios') {
              <p>La paquetería, las guías y la entrega son simuladas. Introduce una dirección ficticia.</p>
              <h2>Costo y plazo</h2>
              <p>En el checkout puedes consultar el método de entrega y su plazo estimado. El servidor calcula el costo según el código postal de la dirección guardada y lo incluye en la cotización antes de confirmar.</p>
              <h2>Seguimiento y dudas</h2>
              <p>En <a routerLink="/mis-pedidos">Mis pedidos</a> puedes consultar el estado, los cambios y, cuando se registren, la paquetería y el número de guía de demostración.</p>
            }
            @case ('contacto') {
              <p>Para dudas sobre la demostración, puedes usar el correo publicado por la tienda.</p>
              <p><a href="mailto:hola@zelicreativa.com">hola@zelicreativa.com</a></p>
              <p>Si tu consulta es sobre un pedido de prueba, indica su folio. Evita enviar contraseñas, datos bancarios o datos personales reales.</p>
              <p>También puedes consultar el estado de tus solicitudes en <a routerLink="/mis-pedidos">Mis pedidos</a>.</p>
            }
            @default {
              <p>Versión {{ version }}. Esta tienda es un proyecto académico. Las operaciones se realizan con cuentas y datos ficticios.</p>
              <h2>Confirmación de la compra</h2>
              <p>Revisa el total en pesos mexicanos que calcula el servidor, el método de entrega y tus datos de prueba antes de aceptar estas condiciones.
                La confirmación genera un folio y descuenta existencias de prueba.</p>
              <h2>Pago y entrega simulados</h2>
              <p>Las compras usan pago simulado y no requieren datos bancarios. El comprobante documenta la operación de prueba y carece de validez fiscal.</p>
              <p>Consulta las páginas de envíos y devoluciones para conocer cómo funcionan esos procesos en la demostración.</p>
            }
          }
        </div>
        <nav class="p-3 p-sm-4 d-flex flex-wrap gap-3" aria-label="Información de la tienda">
          <a routerLink="/privacidad">Aviso de privacidad</a>
          <a routerLink="/terminos">Términos y condiciones</a>
          <a routerLink="/cambios-y-devoluciones">Cambios y devoluciones</a>
          <a routerLink="/envios">Envíos</a>
          <a routerLink="/contacto">Contacto</a>
        </nav>
      </article>
    </main>
  `,
  styles: [`
    .documento { max-width: 46rem; border: 1px solid var(--zeli-line); border-radius: 1rem; overflow: hidden; }
    header { background: var(--zeli-pink); }
    h1 { font-size: clamp(1.65rem, 4vw, 2.5rem); }
    h2 { font-size: 1.2rem; margin-top: 1.4rem; }
    nav { background: var(--zeli-blush); }
    a { color: var(--zeli-berry); }
  `],
})
export class CondicionesCompra {
  private readonly ruta = inject(ActivatedRoute);
  readonly documento = this.ruta.snapshot.data['documento'] as string;
  readonly titulo = this.ruta.snapshot.data['titulo'] as string;
  readonly version = VERSION_TERMINOS_COMPRA;
}
