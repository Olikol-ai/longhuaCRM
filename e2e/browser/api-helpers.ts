import { expect, type Page } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_URL
  ? `${process.env.PLAYWRIGHT_API_URL}/api`
  : 'http://localhost:3001/api';

export type AuthSession = {
  token: string;
  email: string;
};

export async function waitForLoginPage(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Longhua Chinese' })).toBeVisible({
    timeout: 30_000,
  });
}

export async function apiLogin(email: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { token: string };
  return { token: data.token, email };
}

export async function apiRequest(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export async function loginViaUi(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await waitForLoginPage(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

export function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL ?? 'admin@test.local',
    password: process.env.ADMIN_PASSWORD ?? 'TestAdmin123!',
  };
}
