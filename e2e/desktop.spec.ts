import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Pantallas de portátil/PC (≥1024px): menú lateral, tablas y formularios centrados.
test.describe("escritorio", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("menú lateral, tablero y Nuevo movimiento como ventana centrada", async ({ page }) => {
    await login(page, "dueno@finanzasapp.test");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Movimientos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reportes" })).toBeVisible();
    await expect(page.getByText("Saldo en cuentas")).toBeVisible();
    // En escritorio no hay botón flotante; la acción vive en el encabezado.
    await expect(page.getByRole("button", { name: "Agregar movimiento" })).toBeHidden();

    await page.getByRole("button", { name: /nuevo movimiento/i }).first().click();
    await page.getByRole("menuitem", { name: /gasto/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("movimientos se ven como tabla", async ({ page }) => {
    await login(page, "dueno@finanzasapp.test");
    await page.goto("/movimientos");
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Monto" })).toBeVisible();
  });
});
