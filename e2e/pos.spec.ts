import { test, expect, type Page } from "@playwright/test";
import { login } from "./helpers";

// EAN-13 válido y distinto en cada corrida (el código es único por negocio).
function randomEan13(): string {
  const body = "770" + String(Date.now()).slice(-9);
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body + String((10 - (sum % 10)) % 10);
}

/** Si la página muestra un error (validación o RPC), la prueba falla con su texto. */
async function failOnAlert(page: Page, action: string) {
  const alert = page.locator('p[role="alert"]');
  await alert.first().waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
  if (await alert.first().isVisible()) {
    throw new Error(`${action} mostró un error: ${(await alert.first().innerText()).trim()}`);
  }
}

async function addByName(page: Page, name: string) {
  await page.getByLabel("Buscar producto").fill(name);
  await page.getByRole("button", { name }).click();
}

test.describe("punto de venta", () => {
  test("vende de contado, descuenta stock y vende a crédito a un cliente nuevo", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const stamp = Date.now();
    const name = `E2E venta ${stamp}`;
    const customer = `Cliente E2E ${stamp}`;
    await login(page, "dueno@finanzasapp.test");

    // 1. Producto con stock 10, contado 5000 y crédito 5500.
    await page.goto("/inventario");
    await page.getByRole("button", { name: "Nuevo", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre", { exact: true }).fill(name);
    await dialog.getByLabel("Código de barras (opcional)").fill(randomEan13());
    await dialog.getByLabel("Precio contado").fill("5000");
    await dialog.getByLabel("Precio crédito").fill("5500");
    await dialog.getByLabel("Stock inicial (opcional)").fill("10");
    await dialog.getByLabel("Costo unitario").fill("3000");
    await dialog.getByRole("button", { name: "Crear producto" }).click();
    await expect(dialog).toBeHidden();

    // 2. Venta de contado: 2 unidades, efectivo, 20000 recibidos.
    await page.goto("/vender");
    await addByName(page, name);
    await addByName(page, name);
    await expect(page.getByText("$ 10.000").first()).toBeVisible();
    await page.getByRole("button", { name: /^Cobrar/ }).click();
    const pay = page.getByRole("dialog", { name: "Cobrar", exact: true });
    await expect(pay).toBeVisible();
    await pay.getByLabel("Recibido").fill("20000");
    await pay.getByRole("button", { name: /^Confirmar venta/ }).click();
    await failOnAlert(page, "Confirmar la venta de contado");
    const receipt = page.getByRole("dialog", { name: /^Comprobante #\d+$/ });
    await expect(receipt).toBeVisible();
    await expect(receipt.getByText("Comprobante de venta - No es factura electrónica")).toBeVisible();
    const cashNumber = ((await receipt.getByRole("heading").innerText()).match(/#(\d+)/) ?? [])[1];
    expect(cashNumber).toBeTruthy();
    await receipt.getByRole("button", { name: "Cerrar" }).click();
    await expect(receipt).toBeHidden();

    // 3. La venta aparece en /ventas y el stock queda en 8.
    await page.goto("/ventas");
    await expect(page.getByRole("row").filter({ hasText: `#${cashNumber}` })).toBeVisible();
    await page.goto("/inventario");
    await page.getByText(name).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/inventario\/[0-9a-f-]+$/);
    await expect(page.getByText("Stock actual").locator("xpath=..")).toContainText("8");

    // 4. Venta a crédito de 1 unidad a un cliente nuevo creado en línea.
    await page.goto("/vender");
    await page.getByRole("group", { name: "Tipo de venta" }).getByRole("button", { name: "Crédito" }).click();
    await addByName(page, name);
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill(customer);
    await page.getByRole("button", { name: "Guardar cliente" }).click();
    await failOnAlert(page, "Guardar el cliente");
    await expect(page.getByText(customer)).toBeVisible();
    await page.getByRole("button", { name: /^Cobrar/ }).click();
    const creditPay = page.getByRole("dialog", { name: "Venta a crédito" });
    await expect(creditPay).toBeVisible();
    // Sin abono: el interruptor nativo queda apagado.
    const initial = creditPay.getByRole("switch", { name: "Recibir un abono ahora" });
    await initial.uncheck();
    await expect(initial).not.toBeChecked();
    await creditPay.getByRole("button", { name: /^Confirmar venta/ }).click();
    await failOnAlert(page, "Confirmar la venta a crédito");
    const creditReceipt = page.getByRole("dialog", { name: /^Comprobante #\d+$/ });
    await expect(creditReceipt).toBeVisible();
    await expect(creditReceipt.getByText("Comprobante de venta - No es factura electrónica")).toBeVisible();
    await creditReceipt.getByRole("button", { name: "Cerrar" }).click();

    await page.goto("/cartera");
    await expect(page.getByText(customer).filter({ visible: true }).first()).toBeVisible();
  });
});
