import { absoluteUrl, branding } from '../config/branding.js';

export function pageMetadata(options:{title?:string;description?:string;path?:string;noindex?:boolean;image?:string;locale?:string}={}) {
  const title=options.title||branding.defaultTitle, description=options.description||branding.defaultDescription;
  return {title,description,canonical:absoluteUrl(options.path||'/'),robots:options.noindex?'noindex,nofollow,noarchive,nosnippet':'index,follow',image:absoluteUrl(options.image||branding.defaultOgImagePath),locale:options.locale||'zh_TW'};
}

export function metadataHtml(m:ReturnType<typeof pageMetadata>) {
  const e=(s:string)=>s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  return `<title>${e(m.title)}</title><meta name="description" content="${e(m.description)}"><link rel="canonical" href="${e(m.canonical)}"><meta name="robots" content="${m.robots}"><meta name="theme-color" content="${branding.themeColor}"><meta property="og:type" content="website"><meta property="og:site_name" content="${branding.siteName}"><meta property="og:locale" content="${e(m.locale)}"><meta property="og:title" content="${e(m.title)}"><meta property="og:description" content="${e(m.description)}"><meta property="og:url" content="${e(m.canonical)}"><meta property="og:image" content="${e(m.image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(m.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(m.title)}"><meta name="twitter:description" content="${e(m.description)}"><meta name="twitter:image" content="${e(m.image)}"><meta name="twitter:image:alt" content="${e(m.title)}"><link rel="icon" href="${branding.faviconPath}"><link rel="apple-touch-icon" href="${branding.appleTouchIconPath}"><link rel="manifest" href="/site.webmanifest">`;
}
