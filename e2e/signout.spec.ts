import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Cerrar sesión debe llevar directo al login, borrar lo local y no dejar volver a pantallas privadas.
test.describe("cerrar sesión (escritorio)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { who, email, privatePath } of [
    { who: "dueña", email: "dueno@finanzasapp.test", privatePath: "/movimientos" },
    { who: "administración", email: "admin@finanzasapp.test", privatePath: "/admin" },
  ]) {
    test(`${who}: el botón de la barra lateral cierra todo y vuelve al login`, async ({ page }) => {
      await login(page, email);
      await page.getByRole("button", { name: "Cerrar sesión" }).filter({ visible: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar sesión" }).click();
      await expect(page).toHaveURL(/\/login/);

      const leftovers = await page.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("finanzas") || k.startsWith("sb-"))
      );
      expect(leftovers).toEqual([]);
      const cookies = await page.context().cookies();
      expect(cookies.filter((c) => c.name.startsWith("sb-"))).toEqual([]);

      await page.goto(privatePath);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
