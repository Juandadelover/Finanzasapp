import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const ADMIN = "admin@finanzasapp.test";

// La persona administradora de la plataforma usa una consola aparte, no la app de clientes.
test.describe("consola de administración (escritorio)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("al entrar aterriza en /admin y el menú es el de la consola", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const name of ["Resumen", "Pagos", "Clientes", "Ingresos", "Configuración"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Movimientos" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /nuevo movimiento/i })).toHaveCount(0);
  });

  test("las rutas de la app de clientes redirigen a /admin", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/movimientos");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("ficha del cliente muestra sus negocios", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/clientes");
    await page.getByRole("link", { name: "Daniela Dueña" }).first().click();
    await expect(page).toHaveURL(/\/admin\/clientes\/[0-9a-f-]+$/);
    await expect(page.getByText("Tienda Demo").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Por privacidad no se muestran montos ni movimientos del cliente.")).toBeVisible();
  });

  test("ingresos muestra las gráficas", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/admin/ingresos");
    await expect(page.getByRole("region", { name: "Gráficas de ingresos" })).toBeVisible();
    await expect(page.getByText("Ingresos del periodo")).toBeVisible();
  });
});

test.describe("consola de administración (móvil)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la barra inferior muestra las secciones de la consola", async ({ page }) => {
    await login(page, ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Pagos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Movimientos" })).toHaveCount(0);
  });
});
