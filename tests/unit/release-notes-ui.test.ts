import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const readPublic=(path:string)=>readFileSync(new URL(`../../public/${path}`,import.meta.url),'utf8');

describe('release notes UI',()=>{
  const page=readPublic('manage.html'),script=readPublic('admin-features.js'),styles=readPublic('admin-features.css');

  it('places the release notes card immediately above the sidebar information card',()=>{
    expect(page).toMatch(/id="releaseNotesButton"[\s\S]*class="sidebar-account"/);
    expect(page).not.toContain('id="navReleaseNotes"');
    expect(page).toContain('class="sidebar-release__icon"');
    expect(page).not.toContain('class="sidebar-note"');
    expect(page).not.toContain('<small>Patch Notes</small>');
  });

  it('opens once for each authenticated session without a daily mute control',()=>{
    expect(script).toContain("button.onclick=()=>openReleaseNotes(false)");
    expect(script).toContain('sessionStorage.getItem(seenKey)===sessionToken');
    expect(script).not.toContain('releaseMuteKey');
    expect(script).not.toContain("featureText('today')");
  });

  it('lets Pulse admins delete notes without translating stored content',()=>{
    expect(script).toContain("remove.textContent=tr('delete')");
    expect(script).toContain("confirm(featureText('deleteNote'))");
    expect(script).toContain("await api(`/release-notes/${note.id}`,{method:'DELETE'})");
    expect(script).toContain('body.innerHTML=markdownHtml(note.body)');
  });

  it('applies the PulseVeto release-note theme to viewing and editing dialogs',()=>{
    expect(script).toContain("featureDialog(featureText('notes'))");
    expect(script).not.toContain('feature-dialog__kicker');
    expect(styles).toContain('.release-dialog{');
    expect(styles).toContain('linear-gradient(135deg,#0d1019,#17152d 60%,#25164a)');
    expect(styles).toContain('.release-list{min-height:0;overflow-y:auto');
    expect(styles).toContain('border-bottom:1px solid #dedbe7');
    expect(script).toContain("list.className='release-list'");
  });

  it('renders supported Markdown after escaping raw HTML and restricts links',()=>{
    expect(script).toContain('let text=esc(value)');
    expect(script).toContain('mailto:');
    expect(script).toContain('body.innerHTML=markdownHtml(note.body)');
    expect(script).toContain('rel="noopener noreferrer"');
  });
});
