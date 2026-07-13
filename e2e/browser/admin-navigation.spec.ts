import { test, expect } from '@playwright/test';

import { adminCredentials, loginViaApi } from './api-helpers';



const ADMIN_PANEL_TABS = ['Обзор', 'Аналитика', 'Зарплата', 'Экспорт', 'Система'];



const REMOVED_ADMIN_PANEL_TABS = [

  'Платежи',

  'Выплаты',

  'Группы',

  'Сертификаты',

  'Посещаемость',

  'Серии уроков',

  'Магазин',

  'Telegram Bot',

];



const ADMIN_SIDEBAR_PAGES = [

  { path: '/Dashboard', heading: /Доброе (утро|день|вечер)/i },

  { path: '/Schedule', text: /расписан|Сегодня|урок/i },

  { path: '/AdminPanel', heading: 'Обзор CRM' },

  { path: '/UserManagement', heading: 'Пользователи' },

  { path: '/Groups', heading: 'Группы' },

  { path: '/Certificates', heading: 'Сертификаты' },

  { path: '/Attendance', heading: 'Посещаемость' },

  { path: '/Payments', heading: 'Платежи' },

  { path: '/TeacherPayments', heading: 'Выплаты преподавателям' },

  { path: '/LessonSeriesAdmin', heading: 'Серии уроков' },

  { path: '/MaterialsHub', heading: 'Материалы уроков' },

  { path: '/Settings', heading: 'Настройки' },

];



test.describe.configure({ mode: 'serial' });



test.describe('Admin navigation restructure', () => {

  test('AdminPanel dashboard tabs and sidebar routes', async ({ page }) => {

    const admin = adminCredentials();

    await loginViaApi(page, admin.email, admin.password);



    await page.goto('/AdminPanel');

    await expect(page.getByRole('heading', { name: 'Обзор CRM' })).toBeVisible();



    for (const tab of ADMIN_PANEL_TABS) {

      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();

    }



    for (const tab of REMOVED_ADMIN_PANEL_TABS) {

      await expect(page.getByRole('button', { name: tab, exact: true })).toHaveCount(0);

    }



    await page.getByRole('button', { name: 'Аналитика' }).click();

    await expect(page.getByText(/выручк|аналитик|ученик/i).first()).toBeVisible({ timeout: 10_000 });



    await page.getByRole('button', { name: 'Зарплата' }).click();

    await expect(page.getByRole('heading', { name: 'Зарплата преподавателей' })).toBeVisible({

      timeout: 10_000,

    });



    await page.getByRole('button', { name: 'Экспорт' }).click();

    await expect(page.getByRole('heading', { name: 'Экспорт данных' })).toBeVisible({

      timeout: 10_000,

    });



    await page.getByRole('button', { name: 'Система' }).click();

    await expect(page.getByRole('button', { name: 'Магазин' })).toBeVisible();

    await page.getByRole('button', { name: 'Интеграции' }).click();

    await expect(page.getByText(/интеграц|настройк/i).first()).toBeVisible({ timeout: 10_000 });



    for (const item of ADMIN_SIDEBAR_PAGES) {

      await page.goto(item.path);

      if (item.heading) {

        await expect(page.getByRole('heading', { name: item.heading })).toBeVisible({

          timeout: 15_000,

        });

      } else {

        await expect(page.getByText(item.text).first()).toBeVisible({ timeout: 15_000 });

      }

    }

  });

});



test.describe('Role access after nav restructure', () => {

  test('admin can open standalone Payments and TeacherPayments', async ({ page }) => {

    const admin = adminCredentials();

    await loginViaApi(page, admin.email, admin.password);



    await page.goto('/Payments');

    await expect(page.getByRole('heading', { name: 'Платежи' })).toBeVisible({ timeout: 15_000 });



    await page.goto('/TeacherPayments');

    await expect(page.getByRole('heading', { name: 'Выплаты преподавателям' })).toBeVisible({

      timeout: 15_000,

    });

  });

});

