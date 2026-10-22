import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// EAN-13 válido y distinto en cada corrida (el código es único por negocio).
function randomEan13(): string {
  const body = "770" + String(Date.now()).slice(-9);
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body + String((10 - (sum % 10)) % 10);
}

test.describe("inventario", () => {
  test("crea un producto con stock 5, recibe 3 con costo y ve stock 8 y dos movimientos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const name = `E2E producto ${Date.now()}`;
    await login(page, "dueno@finanzasapp.test");

    await page.goto("/inventario");
    await page.getByRole("button", { name: "Nuevo", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre", { exact: true }).fill(name);
    await dialog.getByLabel("Código de barras (opcional)").fill(randomEan13());
    await dialog.getByLabel("Precio contado").fill("5000");
    await dialog.getByLabel("Precio crédito").fill("5500");
    await dialog.getByLabel("Stock inicial (opcional)").fill("5");
    await dialog.getByLabel("Costo unitario").fill("3000");
    await dialog.getByRole("button", { name: "Crear producto" }).click();
    await expect(dialog).toBeHidden();

    // Entrada de 3 unidades con costo.
    await page.goto("/inventario/entradas/nueva");
    await page.getByLabel("Buscar producto").fill(name);
    await page.getByRole("button", { name }).click();
    await page.getByLabel(/^Cantidad/).fill("3");
    await page.getByLabel("Costo unitario").fill("3200");
    const expense = page.getByRole("switch", { name: "Registrar el gasto" });
    // Es un <input type="checkbox" role="switch">: no lleva aria-checked, el estado se lee con isChecked().
    await expense.uncheck();
    await expect(expense).not.toBeChecked();
    await page.getByRole("button", { name: /Registrar entrada/ }).click();
    // Si la página muestra un error (validación o RPC), que aparezca en el log de la falla.
    const alert = page.locator('p[role="alert"]');
    await alert.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
    if (await alert.isVisible()) {
      throw new Error(`Registrar entrada mostró un error: ${(await alert.innerText()).trim()}`);
    }
    await expect(page).toHaveURL(/\/inventario\/entradas\/[0-9a-f-]+$/);

    // Ficha: stock 8 y kardex con stock inicial y entrada.
    await page.goto("/inventario");
    await page.getByText(name).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/inventario\/[0-9a-f-]+$/);
    await expect(page.getByText("Stock actual").locator("xpath=..")).toContainText("8");
    const table = page.getByRole("table").filter({ hasText: "Stock después" });
    await expect(table.getByRole("row").filter({ hasText: "Stock inicial" })).toHaveCount(1);
    await expect(table.getByRole("row").filter({ hasText: /^Entrada|\bEntrada\b/ })).toHaveCount(1);
  });
});
