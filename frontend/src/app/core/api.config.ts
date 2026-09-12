export const API_BASE_URL = (window as Window & { tresorConfig?: { apiUrl?: string } })
  .tresorConfig?.apiUrl || `${location.protocol}//${location.hostname}:5000/api`;
