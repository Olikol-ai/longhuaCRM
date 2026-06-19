/**
 * Собирает query string из объекта фильтров.
 *
 * Пустые значения не добавляются в URL, чтобы backend получал только реально
 * выбранные фильтры.
 *
 * @param query Объект query-параметров.
 * @returns Строка вида `?role=teacher` или пустая строка.
 */
export const buildQueryString = <TQuery extends object>(query: TQuery): string => {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]: [string, unknown]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  return params.size > 0 ? `?${params.toString()}` : '';
};
