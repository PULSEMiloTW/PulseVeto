import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const readPublic=(path:string)=>readFileSync(new URL(`../../public/${path}`,import.meta.url),'utf8');

describe('language selector',()=>{
  const i18n=readPublic('i18n.js');

  it('offers the four required locales with image flags',()=>{
    expect(i18n).toContain('data-locale="zh-TW"><img src="/branding/flags/zh-tw.svg" alt="">繁體中文');
    expect(i18n).toContain("simplified.lastChild.textContent='简体中文'");
    expect(i18n).toContain('data-locale="en-US"><img src="/branding/flags/en-us.svg" alt="">English (US)');
    expect(i18n).toContain('data-locale="ja-JP"><img src="/branding/flags/ja-jp.svg" alt="">日本語');
    expect(i18n).not.toMatch(/[🇦-🇿]{2}/u);
  });

  it('keeps protected pages active across reloads and logs out after five hours of inactivity',()=>{
    expect(i18n).toContain("const timeout=5*60*60_000");
    expect(i18n).toContain("lastWrite=Date.now();localStorage.setItem(key,String(lastWrite))");
    expect(i18n).toContain("idleLogout:'過長時間未操作，已被登出。'");
  });

  it('keeps the Chinese Taipei Olympic flag asset',()=>{
    const flag=readPublic('branding/flags/zh-tw.svg');
    expect(flag).toContain('<svg');
    expect(flag).toContain('#003283');
    expect(flag).toContain('#e41f20');
    expect(flag).toContain('#0083ce');
    expect(flag).toContain('#009c45');
  });

  it('contains Japanese public UI translations',()=>{
    expect(i18n).toContain("dictionaries['ja-JP']");
    expect(i18n).toContain("startsWith('ja')?'ja-JP'");
  });
});

describe('event map pool selection',()=>{
  const script=readPublic('admin-hierarchy.js');
  const styles=readPublic('admin-hierarchy.css');

  it('uses the requested Traditional Chinese title',()=>{
    expect(readPublic('admin-features.js')).toContain("pool:'賽事地圖池 (預設為 7 張)'");
  });

  it('blocks and dims unselected maps after seven are chosen',()=>{
    expect(script).toContain('selected>=20');
    expect(script).toContain("alert(tr('mapLimit'))");
    expect(script).toContain("classList.toggle('is-disabled',blocked)");
    expect(styles).toContain('.map-check.is-disabled');
  });
});

describe('admin overview',()=>{
  const script=readPublic('admin-hierarchy.js');
  const page=readPublic('manage.html');
  const styles=readPublic('admin-hierarchy.css');

  it('shows every overview category without requiring a summary-card click',()=>{
    expect(script).toContain('class="overview-section"');
    expect(script).not.toContain('data-overview-target');
    expect(script).toContain('data-overview-event');
    expect(script).toContain('data-overview-veto');
  });

  it('does not render the decorative search field',()=>{
    expect(page).not.toContain('sidebar-search');
    expect(script).not.toContain('sidebarSearchText');
  });

  it('cache-busts the matching admin assets and spaces navigation below the brand',()=>{
    expect(page).toContain('/admin-hierarchy.css?v=20260927-3');
    expect(page).toContain('/admin-hierarchy.js?v=20260927-6');
    expect(page).toContain('/admin-features.js?v=20260927-13');
    expect(page).toContain('/manage-score.js?v=20260831-3');
    expect(styles).toContain('.admin-sidebar>.sidebar-nav{margin-top:26px}');
  });
});
