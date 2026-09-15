/** Parse registry filters from URLSearchParams. */
export function parseRegistryFilters(searchParams) {
  const roles = searchParams.get('roles')?.split(',').filter(Boolean) ?? [];
  const statuses = searchParams.get('statuses')?.split(',').filter(Boolean) ?? [];
  const accountStatuses = searchParams.get('accountStatuses')?.split(',').filter(Boolean) ?? [];
  return {
    search: searchParams.get('search') ?? '',
    roles,
    statuses,
    accountStatuses,
    createdFrom: searchParams.get('createdFrom') ?? '',
    createdTo: searchParams.get('createdTo') ?? '',
    datePreset: searchParams.get('datePreset') ?? '',
    assignedTeacherId: searchParams.get('assignedTeacherId') ?? '',
    sort: searchParams.get('sort') ?? 'name',
    sortDir: searchParams.get('sortDir') ?? 'asc',
    page: Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    limit: Number.parseInt(searchParams.get('limit') ?? '25', 10) || 25,
  };
}

/** Serialize registry filters to URLSearchParams object. */
export function serializeRegistryFilters(filters) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.roles?.length) params.set('roles', filters.roles.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.accountStatuses?.length) params.set('accountStatuses', filters.accountStatuses.join(','));
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  if (filters.datePreset) params.set('datePreset', filters.datePreset);
  if (filters.assignedTeacherId) params.set('assignedTeacherId', filters.assignedTeacherId);
  if (filters.sort && filters.sort !== 'name') params.set('sort', filters.sort);
  if (filters.sortDir && filters.sortDir !== 'asc') params.set('sortDir', filters.sortDir);
  if (filters.page && filters.page !== 1) params.set('page', String(filters.page));
  if (filters.limit && filters.limit !== 25) params.set('limit', String(filters.limit));
  return params;
}

export function buildRegistryQuery(filters) {
  const query = {
    page: filters.page,
    limit: filters.limit,
    sort: filters.sort,
    sortDir: filters.sortDir,
  };
  if (filters.search?.trim()) query.search = filters.search.trim();
  if (filters.roles?.length) query.roles = filters.roles.join(',');
  if (filters.statuses?.length) query.statuses = filters.statuses.join(',');
  if (filters.accountStatuses?.length) query.accountStatuses = filters.accountStatuses.join(',');
  if (filters.createdFrom) query.createdFrom = filters.createdFrom;
  if (filters.createdTo) query.createdTo = filters.createdTo;
  if (filters.assignedTeacherId) query.assignedTeacherId = filters.assignedTeacherId;
  return query;
}

export function hasActiveFilters(filters) {
  return Boolean(
    filters.search?.trim()
    || filters.roles?.length
    || filters.statuses?.length
    || filters.accountStatuses?.length
    || filters.createdFrom
    || filters.createdTo
    || filters.assignedTeacherId,
  );
}

export function getUserDisplayName(user) {
  if (user.full_name) return user.full_name;
  if (user.first_name && user.last_name) return `${user.last_name} ${user.first_name}`;
  return user.email || 'Без имени';
}

export function toggleSort(currentSort, currentDir, field) {
  if (currentSort !== field) {
    return { sort: field, sortDir: 'asc' };
  }
  return { sort: field, sortDir: currentDir === 'asc' ? 'desc' : 'asc' };
}
