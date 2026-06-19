import { API_URL } from './config';

interface BackendApiErrorOptions {
  status?: number;
  data?: unknown;
}

interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
  headers?: HeadersInit;
}

/**
 * Ошибка ответа нового backend API.
 *
 * Хранит HTTP-статус и тело ответа, чтобы UI мог различать ошибки авторизации,
 * валидации и серверные сбои без парсинга текста сообщения.
 */
export class BackendApiError extends Error {
  /**
   * HTTP-статус ответа backend.
   */
  public readonly status?: number;

  /**
   * Распарсенное тело ответа backend.
   */
  public readonly data?: unknown;

  /**
   * Создаёт ошибку backend API.
   *
   * @param message Человекочитаемое сообщение об ошибке.
   * @param options Дополнительные данные HTTP-ответа.
   */
  public constructor(message: string, { status, data }: BackendApiErrorOptions = {}) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Собирает полный URL backend API из базового URL и относительного пути endpoint.
 *
 * @param path Относительный путь endpoint, например `/auth/login`.
 * @returns Полный URL для `fetch`.
 */
const buildUrl = (path: string): string => {
  const normalizedBaseUrl = API_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
};

/**
 * Читает тело HTTP-ответа с учётом пустых ответов и JSON content-type.
 *
 * @param response Ответ `fetch`.
 * @returns Распарсенное тело ответа, текст или `null`.
 */
const parseResponseBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  return text || null;
};

/**
 * Достаёт сообщение об ошибке из стандартного тела ответа backend.
 *
 * @param data Распарсенное тело ответа.
 * @param fallback Сообщение по умолчанию, если backend не вернул текст ошибки.
 * @returns Сообщение для `BackendApiError`.
 */
const getErrorMessage = (data: unknown, fallback: string): string => {
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;

    if (typeof record.message === 'string') {
      return record.message;
    }

    if (typeof record.error === 'string') {
      return record.error;
    }
  }

  return fallback;
};

/**
 * Выполняет HTTP-запрос к новому backend API.
 *
 * Автоматически добавляет JSON headers, Bearer access token и `credentials: include`
 * для работы с httpOnly refresh cookie.
 *
 * @param path Относительный путь endpoint.
 * @param options Опции HTTP-запроса.
 * @returns Распарсенный успешный ответ backend.
 * @throws BackendApiError Если backend вернул неуспешный HTTP-статус.
 */
export const apiRequest = async <TResponse>(
  path: string,
  { method = 'GET', body, accessToken, headers = {} }: ApiRequestOptions = {},
): Promise<TResponse> => {
  const requestHeaders = new Headers(headers);

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new BackendApiError(getErrorMessage(data, response.statusText), {
      status: response.status,
      data,
    });
  }

  return data as TResponse;
};
