import type { Plugin } from 'vite';

export interface StartupPreloadOptions {
  /** The app's public base path, with a trailing slash. */
  base: string;
  /** Route id (the first path segment) -> the page module(s) to preload for it, as source paths. */
  routes: Record<string, string | string[]>;
  /** The route for the base path itself. */
  defaultRoute: string;
  /** Patterns matching the emitted light and dark theme stylesheets. */
  themes: { light: RegExp; dark: RegExp };
}

export default function startupPreload(options: StartupPreloadOptions): Plugin;
