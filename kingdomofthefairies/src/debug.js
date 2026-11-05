// URL-scoped testing mode. Never write debug-session progress to a save.
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
