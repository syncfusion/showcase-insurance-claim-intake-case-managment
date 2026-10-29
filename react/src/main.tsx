import { registerLicense } from '@syncfusion/ej2-base';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

const licenseKey = import.meta.env.VITE_SYNCFUSION_LICENSE_KEY;
if (licenseKey) registerLicense(licenseKey);

/**
 * Without a registered key, @syncfusion/ej2-base injects two licence notices:
 *
 * 1. A trial banner — a fixed strip at the top (z-index 999999999). It is informational,
 *    but it is drawn over the app's header, so it covers the theme toggle.
 * 2. A licence overlay — once more than five licensed components have been created
 *    (component.js: "instancecount > 5"), a fixed, full-viewport backdrop at z-index 99999
 *    with no dismiss control. It is appended to <body> outside React and is never removed
 *    when the page that created it unmounts, so it swallows every click and the sidebar
 *    links stop working at all.
 *
 * The banner keeps the licensing situation visible; the blocking overlay is removed so the
 * app stays usable, and the banner is lifted clear of the app's own header so it cannot
 * cover the header's controls.
 */
function keepLicenceNoticesFromBlockingTheApp(): void {
  if (licenseKey) return;

  const styleOf = (el: Element) => getComputedStyle(el);

  const isBlockingOverlay = (el: Element) => {
    // The overlay is appended inside a wrapper div, so it is a grandchild of <body>.
    if (!document.body.contains(el)) return false;
    const style = styleOf(el);
    if (style.position !== 'fixed') return false;
    const z = Number.parseInt(style.zIndex ?? '', 10);
    if (!Number.isFinite(z) || z < 1000) return false;
    const rect = el.getBoundingClientRect();
    // The blocking overlay covers the viewport; the trial banner is a thin strip at the top.
    return rect.width >= window.innerWidth - 1 && rect.height >= window.innerHeight - 1;
  };

  const isTrialBanner = (el: Element) => {
    if (!document.body.contains(el)) return false;
    const style = styleOf(el);
    if (style.position !== 'fixed') return false;
    const z = Number.parseInt(style.zIndex ?? '', 10);
    if (!Number.isFinite(z) || z < 1000000) return false;
    return /trial version of Syncfusion/i.test(el.textContent ?? '');
  };

  const neutralise = (el: Element) => {
    // Stop it intercepting clicks first, then take it out of the document.
    if (el instanceof HTMLElement) el.style.pointerEvents = 'none';
    // The overlay sits inside a wrapper div; remove the wrapper so nothing is left behind.
    const wrapper = el.parentElement;
    if (wrapper && wrapper !== document.body && wrapper.parentElement === document.body) wrapper.remove();
    else el.remove();
  };

  const liftBanner = (el: Element) => {
    // The banner is drawn at top: 10px over the app's header (covering the menu button
    // and theme toggle). Move it to the bottom of the viewport and let clicks pass
    // through, so the app's own controls stay usable while the banner keeps the
    // licensing situation visible.
    if (!(el instanceof HTMLElement)) return;
    el.style.top = 'auto';
    el.style.bottom = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.pointerEvents = 'none';
  };

  const sweep = () => {
    for (const el of Array.from(document.body.querySelectorAll('div'))) {
      if (isBlockingOverlay(el)) {
        neutralise(el);
        continue;
      }
      if (isTrialBanner(el)) liftBanner(el);
    }
  };

  sweep();
  // The notices are appended during a component's render, so watch for them appearing.
  new MutationObserver(sweep).observe(document.body, { childList: true });
  // A short interval covers the window between a notice being appended and the
  // observer's callback running, which is long enough for a click to be swallowed.
  window.setInterval(sweep, 100);
}

keepLicenceNoticesFromBlockingTheApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
