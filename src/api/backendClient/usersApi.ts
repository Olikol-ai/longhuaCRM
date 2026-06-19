import { apiRequest } from './httpClient';
import { buildQueryString } from './queryString';
import type { UserProfile, UserRole, UsersQuery, UserStatus } from './types';

/**
 * API-клиент для работы с пользователями нового backend.
 *
 * Методы требуют access token, потому что backend читает авторизацию
 * из заголовка `Authorization: Bearer <token>`.
 */
export const usersApi = {
  /**
   * Возвращает профиль текущего пользователя.
   *
   * @param accessToken Access token текущей сессии.
   * @returns Публичный профиль текущего пользователя.
   */
  getMe: (accessToken: string): Promise<UserProfile> =>
    apiRequest<UserProfile>('/users/me', {
      accessToken,
    }),

  /**
   * Возвращает список пользователей для admin-интерфейса.
   *
   * @param accessToken Access token администратора.
   * @param query Фильтры списка пользователей.
   * @returns Список публичных профилей пользователей.
   */
  list: (accessToken: string, query: UsersQuery = {}): Promise<UserProfile[]> => {
    const suffix = buildQueryString(query);

    return apiRequest<UserProfile[]>(`/users${suffix}`, {
      accessToken,
    });
  },

  /**
   * Обновляет роль пользователя.
   *
   * @param userId ID пользователя.
   * @param role Новая роль пользователя.
   * @param accessToken Access token администратора.
   * @returns Обновлённый публичный профиль пользователя.
   */
  updateRole: (userId: string, role: UserRole, accessToken: string): Promise<UserProfile> =>
    apiRequest<UserProfile>(`/users/${userId}/role`, {
      method: 'PATCH',
      accessToken,
      body: { role },
    }),

  /**
   * Обновляет статус пользователя.
   *
   * @param userId ID пользователя.
   * @param status Новый статус пользователя.
   * @param accessToken Access token администратора.
   * @returns Обновлённый публичный профиль пользователя.
   */
  updateStatus: (userId: string, status: UserStatus, accessToken: string): Promise<UserProfile> =>
    apiRequest<UserProfile>(`/users/${userId}/status`, {
      method: 'PATCH',
      accessToken,
      body: { status },
    }),
};
