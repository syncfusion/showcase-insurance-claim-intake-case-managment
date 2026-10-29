const ITMountPath = '/insurance-claims-intake-portal/react/';

/**
 * Keep one build usable both through the GCP vanity path and directly from
 * the Azure App Service root.
 */
export function getPublicBasePath(pathname = window.location.pathname): string {
  return pathname === ITMountPath.slice(0, -1) || pathname.startsWith(ITMountPath)
    ? ITMountPath
    : '/';
}

/**
 * Same as `getPublicBasePath` but returns an empty string at the Azure root
 * (instead of `/`). Use this when concatenating with an already-rooted asset
 * path, e.g. `window.location.origin + getAssetBasePath() + '/documents/x.pdf'`,
 * so you don't produce a `//` double-slash when the app is served from the root.
 */
export function getAssetBasePath(pathname = window.location.pathname) {
  const base = getPublicBasePath(pathname);
  return base === '/' ? '' : base;
}