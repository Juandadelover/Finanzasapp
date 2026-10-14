import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.E2E_PASSWORD ?? "finanzas-local-dev";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).last().click();
  await expect(page).not.toHaveURL(/\/login/);
}
