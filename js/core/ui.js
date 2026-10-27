/* Petits outils d'interface partagés par tous les modules. */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const para = s => esc(s).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const fmtDate = d => {
  if (!d) return '';
  const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d);
  return isNaN(x) ? d : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
export const fmtDateHeure = d => {
  if (!d) return '';
  const x = new Date(d); if (isNaN(x)) return '';
  return x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

/* Fenêtre modale. Tout élément [data-close] la ferme. Retourne l'élément. */
export function modal(inner, { onClose } = {}) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true">${inner}</div>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  m.close = close;
  const f = m.querySelector('[autofocus], .btn.primary, button'); if (f) f.focus();
  return m;
}

/* Fenêtre de confirmation : renvoie une promesse true / false. */
export function confirmer({ titre, texte, oui = 'Confirmer', non = 'Annuler', danger = false }) {
  return new Promise(res => {
    let done = false;
    const m = modal(`<h3>${esc(titre)}</h3>${texte ? `<p>${texte}</p>` : ''}<div class="row"><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(oui)}</button><button class="btn" data-close>${esc(non)}</button></div>`,
      { onClose: () => { if (!done) res(false); } });
    m.querySelector('[data-ok]').addEventListener('click', () => { done = true; res(true); m.close(); });
  });
}

export async function copyText(txt, okMsg, title) {
  try { await navigator.clipboard.writeText(txt); toast(okMsg); return true; }
  catch (err) {
    const m = modal(`<h3>${esc(title || 'Copiez ce texte')}</h3><p>La copie automatique n'est pas disponible ici : sélectionnez le texte et copiez-le.</p><textarea class="ta" readonly style="height:40vh;width:100%">${esc(txt)}</textarea><div class="row"><button class="btn" data-close>Fermer</button></div>`);
    const ta = m.querySelector('textarea'); ta.focus(); ta.select(); return false;
  }
}

export function downloadFile(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export const slug = s => (String(s || 'personnage').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'personnage');

/* Sceau des Gris */
export const SIGIL_SMALL = `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="15.6" stroke-dasharray="1.6 2.4" pathLength="100"/><path d="M20 7 L31.26 26.5 H8.74 Z"/><path d="M11.5 20 Q20 12.8 28.5 20 Q20 27.2 11.5 20 Z"/><circle cx="20" cy="20" r="2.6" fill="currentColor"/></svg>`;
export const SIGIL = `<svg class="big" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="15.6" stroke-dasharray="1.6 2.4" pathLength="100"/><path d="M20 7 L31.26 26.5 H8.74 Z"/><path d="M20 33 L8.74 13.5 H31.26 Z" opacity=".45"/><path d="M11.5 20 Q20 12.8 28.5 20 Q20 27.2 11.5 20 Z"/><circle cx="20" cy="20" r="2.6" fill="currentColor"/></svg>`;
export const ORN = `<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M7 0 L9 7 L7 14 L5 7 Z"/><path d="M0 7 L7 5 L14 7 L7 9 Z" opacity=".5"/></svg>`;
export const DISCORD = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.7 3a19.6 19.6 0 0 0-4.9 1.5C.7 9.1-.2 13.7.3 18.2a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 11.9 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.7-3.5-13.8ZM8.3 15.4c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7.4 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z"/></svg>`;
