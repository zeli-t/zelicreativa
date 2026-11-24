import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { AppModule } from './app-module';
import { Administracion } from './services/administracion';
import { Autenticacion } from './services/autenticacion';
import { CierreSesion } from './services/cierre-sesion';
import { autenticacionDePrueba, catalogoDePrueba } from './testing/entorno-pruebas';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [catalogoDePrueba(), autenticacionDePrueba()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-header')).not.toBeNull();
  });

  it('should render the storefront title on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/inicio')).toBe(true);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const titulo = compiled.querySelector('main app-inicio h1');
    expect(titulo?.firstChild?.textContent?.trim()).toBe('Dale color a');
    expect(titulo?.querySelector('br')).not.toBeNull();
    expect(titulo?.querySelector('span')?.textContent?.trim()).toBe('tus ideas.');
  });

  for (const permite of [true, false]) {
    it(permite ? 'carga el panel de administración desde /admin' : 'deniega /admin a un cliente', async () => {
      TestBed.overrideProvider(Autenticacion, {
        useValue: {
          sesion: signal({ user: { id: 'usuario-ficticio', user_metadata: {} } }),
          iniciar: async () => {},
        },
      });
      TestBed.overrideProvider(Administracion, {
        useValue: {
          habilitado: true,
          esAdmin: signal(permite),
          comprobarRol: async () => permite,
          pedidos: async () => [],
          pagos: async () => [],
          productos: async () => [],
          existencias: async () => [],
          variantes: async () => [],
          partidas: async () => [],
          devoluciones: async () => [],
        },
      });
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      expect(await router.navigateByUrl('/admin')).toBe(true);
      await fixture.whenStable();
      const html = fixture.nativeElement as HTMLElement;
      expect(router.url).toBe(permite ? '/admin' : '/acceso-admin');
      if (permite) {
        expect(html.querySelector('main.admin h1')?.textContent).toBe('Administración');
      } else {
        expect(html.querySelector('main.admin')).toBeNull();
        expect(html.textContent).toContain('Tu cuenta no tiene permiso');
      }
    });
  }

  it('retira la pantalla protegida durante la confirmación y vuelve a mostrar el inicio', async () => {
    const sesion = signal<{ user: { id: string; email: string } } | null>({
      user: { id: 'cliente-ficticio', email: 'cliente@example.test' },
    });
    TestBed.overrideProvider(Autenticacion, {
      useValue: { sesion, iniciar: async () => {}, salir: async () => sesion.set(null) },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/mis-direcciones')).toBe(true);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-root main h1, main h1')?.textContent).toContain('Mis direcciones');

    const cierre = TestBed.inject(CierreSesion);
    await cierre.salir();
    fixture.detectChanges();
    expect(html.querySelector('router-outlet')).toBeNull();
    expect(html.querySelector('.cierre-confirmado h1')?.textContent).toContain('¡Sesión cerrada correctamente!');
    expect(html.querySelector('.acceso-cuenta')?.textContent).toContain('Iniciar sesión');

    await cierre.irAlInicio();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toBe('/inicio');
    expect(html.querySelector('app-inicio')).not.toBeNull();
    expect(html.querySelector('.cierre-confirmado')).toBeNull();
  });

  it('permite volver a navegar sin sesión al cerrar desde Inicio', async () => {
    const sesion = signal<{ user: { id: string } } | null>({ user: { id: 'cliente-ficticio' } });
    TestBed.overrideProvider(Autenticacion, {
      useValue: { sesion, iniciar: async () => {}, salir: async () => sesion.set(null) },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/inicio')).toBe(true);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    const cierre = TestBed.inject(CierreSesion);

    await cierre.salir();
    fixture.detectChanges();
    expect(html.querySelector('.cierre-confirmado')).not.toBeNull();
    await cierre.irAlInicio();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(html.querySelector('.cierre-confirmado')).toBeNull();
    expect(html.querySelector('app-inicio')).not.toBeNull();

    for (const [ruta, pantalla] of [
      ['/catalogo', 'app-catalogo-pagina'],
      ['/categoria/libretas', 'app-catalogo-pagina'],
      ['/envios', 'main article h1'],
      ['/inicio', 'app-inicio'],
    ]) {
      const enlace = html.querySelector<HTMLAnchorElement>('a[href="' + ruta + '"]');
      expect(enlace).not.toBeNull();
      enlace?.click();
      await fixture.whenStable();
      expect(router.url).toBe(ruta);
      expect(html.querySelector(pantalla)).not.toBeNull();
    }

    await router.navigateByUrl('/mis-direcciones');
    expect(router.url).toBe('/iniciar-sesion?volver=mis-direcciones');
  });
});
