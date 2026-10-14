import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("público", () => {
  test("/precios muestra los planes", async ({ page }) => {
    await page.goto("/precios");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const plan of ["Gratis", "Emprendedor", "Negocio", "Pro"]) {
      await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
    }
  });

  test("/legal/privacidad se muestra", async ({ page }) => {
    await page.goto("/legal/privacidad");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/login ofrece recuperar la contraseña", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toBeVisible();
  });
});

test.describe("dueño", () => {
  test("Inicio muestra saldo y negocio", async ({ page }) => {
    await login(page, "dueno@finanzasapp.test");
    await expect(page.getByText("Saldo en cuentas")).toBeVisible();
    await expect(page.getByText("Tienda Demo").first()).toBeVisible();
  });

  test("registra un gasto y aparece en movimientos", async ({ page }) => {
    const description = `E2E gasto ${Date.now()}`;
    await login(page, "dueno@finanzasapp.test");
    await page.getByRole("button", { name: "Agregar movimiento" }).click();
    await page.getByRole("button", { name: "Gasto" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Monto").fill("12345");
    await dialog.getByRole("button", { name: "Otros gastos" }).click();
    await dialog.getByLabel("Descripción").fill(description);
    await dialog.getByRole("button", { name: "Guardar movimiento" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/movimientos");
    const row = page.getByText(description);
    await expect(row).toBeVisible();

    // Limpieza para poder repetir la prueba.
    await row.click();
    await page.getByRole("button", { name: "Eliminar movimiento" }).click();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText(description)).toHaveCount(0);
  });

  test("/cartera muestra a Restaurante El Fogón vencido", async ({ page }) => {
    await login(page, "dueno@finanzasapp.test");
    await page.goto("/cartera");
    const card = page.locator("div.rounded-2xl", { hasText: "Restaurante El Fogón" }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText(/vencid|venció|atras/i)).toBeVisible();
  });

  test("/cobros abre la cuenta N.º 0001", async ({ page }) => {
    await login(page, "dueno@finanzasapp.test");
    await page.goto("/cobros");
    await page.getByRole("link", { name: /0001/ }).first().click();
    await expect(page.getByText("CUENTA DE COBRO").first()).toBeVisible();
  });
});

test.describe("otros roles", () => {
  test("contador no ve el botón Agregar movimiento", async ({ page }) => {
    await login(page, "contador@finanzasapp.test");
    await expect(page.getByText("Saldo en cuentas").or(page.getByText("Resultado del mes"))).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar movimiento" })).toHaveCount(0);
  });

  test("solo registro ve su mensaje y únicamente Gasto", async ({ page }) => {
    await login(page, "registro@finanzasapp.test");
    await expect(page.getByText("Registra aquí los gastos del negocio.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Gasto/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ingreso/ })).toHaveCount(0);
    await expect(page.getByText("Saldo en cuentas")).toHaveCount(0);
  });

  test("gratis ve el plan Gratis en /suscripcion", async ({ page }) => {
    await login(page, "gratis@finanzasapp.test");
    await page.goto("/suscripcion");
    await expect(page.getByText("Tu plan")).toBeVisible();
    await expect(page.getByText("Gratis", { exact: true }).first()).toBeVisible();
  });

  test("admin de plataforma ve /admin/pagos", async ({ page }) => {
    await login(page, "admin@finanzasapp.test");
    await page.goto("/admin/pagos");
    const table = page.getByRole("table", { name: "Pagos de suscripción" });
    const empty = page.getByText("No hay pagos en esta vista");
    await expect(table.or(empty)).toBeVisible();
    if (await table.isVisible()) {
      await expect(table.getByText("FZ-DEMO1")).toBeVisible();
    }
  });
});
