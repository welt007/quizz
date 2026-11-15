// Options: manage catalogs (enable/disable per CSV file or per source), add
// catalogs by URL, import local CSV files, update the built-in catalog.
import { h, mount } from '../dom.js';
import { BUILTIN_ID, compareVersions, summarizeResult } from '../../core/library.js';
import { loadFromUrl, loadFromFiles } from '../../data/loader.js';
import { saveJson, KEYS } from '../../data/storage.js';
import { confirmDialog } from '../components/dialog.js';
import { setKeyHandler } from '../input.js';
import { audio } from '../audio.js';
import { autoNextEnabled, AUTO_NEXT_SECONDS } from '../components/nextButton.js';
import { icon } from '../icons.js';

const KIND_LABEL = { builtin: 'Standard', url: 'aus dem Internet', import: 'Datei-Import' };
const MAX_LISTED_ISSUES = 30;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function renderOptions(ctx) {
  const lib = ctx.library;
  const summary = h('p', { class: 'options__summary', role: 'status' });
  const sourceList = h('div', { class: 'sources' });

  // ---------- summary ----------
  function renderSummary() {
    const { questions, activeCatalogs, totalCatalogs } = ctx.catalog;
    summary.textContent = `Aktiv: ${questions.length} Fragen aus ${activeCatalogs} von ${totalCatalogs} Katalogen in ${ctx.categories.length} Kategorien.`;
    summary.classList.toggle('is-warning', questions.length === 0);
  }

  function changed() {
    ctx.refreshCatalog();
    renderSummary();
    renderSources();
  }

  // ---------- source list ----------
  function renderSources() {
    const focusedId = document.activeElement?.dataset?.focusId;
    sourceList.replaceChildren(...lib.sources.map(sourceCard));
    if (focusedId) sourceList.querySelector(`[data-focus-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  function sourceCard(source) {
    const total = source.catalogs.reduce((n, c) => n + (c.missing ? 0 : c.count), 0);
    const status = h('div', { class: 'source__status', role: 'status' });
    const preview = h('div', { class: 'source__preview' });
    const buttons = [];
    const button = (label, onclick, focusId) => {
      const b = h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick, 'data-focus-id': `${source.id}:${focusId}` }, label);
      buttons.push(b);
      return b;
    };
    const setBusy = (on) => buttons.forEach((b) => (b.disabled = on));

    if (source.catalogs.length > 1) {
      button('Alle an', () => (lib.setSourceEnabled(source.id, true), changed()), 'all-on');
      button('Alle aus', () => (lib.setSourceEnabled(source.id, false), changed()), 'all-off');
    }
    const updateUrl = source.kind === 'builtin' ? source.updateUrl : source.kind === 'url' ? source.resolvedUrl ?? source.url : null;
    if (updateUrl) button([icon('refresh', { size: 16 }), 'Aktualisieren'], () => update(), 'update');
    if (source.kind === 'builtin' && source.override) button('Auf eingebaute Version zurücksetzen', () => resetBuiltin(), 'reset');
    if (source.kind !== 'builtin') button([icon('trash', { size: 16 }), 'Entfernen'], () => remove(), 'remove');

    async function update() {
      setBusy(true);
      preview.replaceChildren();
      status.className = 'source__status';
      try {
        const result = await loadFromUrl(updateUrl, { onProgress: (t) => (status.textContent = t) });
        const newer = source.kind === 'builtin' ? compareVersions(result.version, source.version) > 0 : result.version !== source.version;
        if (!newer) {
          status.textContent = /^[0-9a-f]{8}$/.test(source.version) ? '✓ Bereits aktuell – keine Änderungen.' : `✓ Bereits aktuell (Version ${source.version}).`;
          return;
        }
        status.textContent = '';
        showPreview(preview, result, {
          intro: /^[0-9a-f]{8}$/.test(result.version) ? 'Die Datei hat sich geändert.' : `Neue Version ${result.version} gefunden (bisher ${source.version}).`,
          confirmLabel: 'Update übernehmen',
          onConfirm: async () => {
            await lib.put(result, { kind: source.kind, id: source.id });
            ctx.toast(`„${source.name}“ wurde aktualisiert.`);
            changed();
          },
        });
      } catch (e) {
        status.className = 'source__status is-error';
        status.textContent = e.message;
      } finally {
        setBusy(false);
      }
    }

    async function resetBuiltin() {
      const yes = await confirmDialog({
        title: 'Standardkatalog zurücksetzen?',
        text: `Das heruntergeladene Update wird verworfen; es gilt wieder die in dieser Datei eingebaute Version ${lib.embeddedVersion}.`,
        confirmLabel: 'Zurücksetzen',
      });
      if (!yes) return;
      await lib.resetBuiltin();
      changed();
    }

    async function remove() {
      const yes = await confirmDialog({
        title: 'Quelle entfernen?',
        text: `„${source.name}“ mit ${source.catalogs.length} Katalog(en) wird gelöscht. Du kannst sie später wieder hinzufügen.`,
        confirmLabel: 'Entfernen',
      });
      if (!yes) return;
      await lib.remove(source.id);
      ctx.toast(`„${source.name}“ wurde entfernt.`);
      changed();
    }

    const meta = [
      // single CSVs are versioned by a content hash – not meaningful to show
      source.version && !/^[0-9a-f]{8}$/.test(source.version) ? `Version ${source.version}` : null,
      `${plural(total, 'Frage', 'Fragen')} in ${plural(source.catalogs.length, 'Katalog', 'Katalogen')}`,
      source.updatedAt ? `Stand ${formatDate(source.updatedAt)}` : null,
    ].filter(Boolean).join(' · ');

    return h(
      'article',
      { class: `source source--${source.kind}` },
      h(
        'header',
        { class: 'source__head' },
        h(
          'div',
          {},
          h('h3', { class: 'source__name' }, source.name, ' ', h('span', { class: 'badge' }, source.override ? 'Standard · aktualisiert' : KIND_LABEL[source.kind])),
          h('p', { class: 'source__meta' }, meta),
          source.kind === 'url' ? h('p', { class: 'source__url' }, source.url) : null,
          source.attribution ? h('p', { class: 'source__meta source__attribution' }, source.attribution) : null,
        ),
        h('div', { class: 'source__tools' }, buttons),
      ),
      h('ul', { class: 'catalogs' }, source.catalogs.map((c) => catalogRow(source, c))),
      status,
      preview,
    );
  }

  function catalogRow(source, cat) {
    const toggle = h('input', {
      type: 'checkbox',
      role: 'switch',
      class: 'switch__input',
      'data-focus-id': cat.id,
      disabled: cat.missing,
      onchange: (e) => {
        lib.setEnabled(cat.id, e.target.checked);
        audio.play('click');
        changed();
      },
    });
    toggle.checked = cat.enabled && !cat.missing;
    const issues = cat.errors?.length
      ? h(
          'details',
          { class: 'issues' },
          h('summary', {}, `⚠ ${plural(cat.errorCount ?? cat.errors.length, 'übersprungene Zeile', 'übersprungene Zeilen')}`),
          issueList(cat.errors),
        )
      : null;
    return h(
      'li',
      { class: `catalog${toggle.checked ? '' : ' is-off'}` },
      h(
        'label',
        { class: 'switch' },
        toggle,
        h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
        h('span', { class: 'catalog__name' }, cat.name),
        h('span', { class: 'catalog__file' }, cat.file),
      ),
      h('span', { class: 'catalog__count' }, cat.missing ? 'Daten fehlen – bitte aktualisieren' : plural(cat.count, 'Frage', 'Fragen')),
      issues,
    );
  }

  // ---------- add by URL ----------
  const urlInput = h('input', {
    class: 'input',
    type: 'text', // not "url": the short form owner/repo must be accepted
    inputmode: 'url',
    autocomplete: 'off',
    placeholder: 'z. B. https://github.com/name/repo oder https://…/fragen.csv',
    'aria-label': 'Adresse des Fragenkatalogs',
    spellcheck: 'false',
  });
  const urlButton = h('button', { class: 'btn', type: 'submit' }, 'Laden');
  const urlStatus = h('p', { class: 'source__status', role: 'status' });
  const urlPreview = h('div', { class: 'source__preview' });
  const urlForm = h(
    'form',
    { class: 'add-form', onsubmit: (e) => (e.preventDefault(), addFromUrl()) },
    h('div', { class: 'hs-entry__row' }, urlInput, urlButton),
  );

  async function addFromUrl() {
    if (!urlInput.value.trim()) return urlInput.focus();
    urlButton.disabled = true;
    urlPreview.replaceChildren();
    urlStatus.className = 'source__status';
    try {
      const result = await loadFromUrl(urlInput.value, { onProgress: (t) => (urlStatus.textContent = t) });
      urlStatus.textContent = '';
      const existing = lib.findByUrl(result.resolvedUrl);
      showPreview(urlPreview, result, {
        intro: existing ? `Dieser Katalog ist schon vorhanden („${existing.name}“) – Übernehmen aktualisiert ihn.` : null,
        confirmLabel: existing ? 'Aktualisieren' : 'Hinzufügen',
        onConfirm: async () => {
          await lib.put(result, { kind: 'url', id: existing?.id });
          urlInput.value = '';
          ctx.toast(`„${result.name}“ wurde ${existing ? 'aktualisiert' : 'hinzugefügt'}.`);
          changed();
        },
      });
    } catch (e) {
      urlStatus.className = 'source__status is-error';
      urlStatus.textContent = e.message;
    } finally {
      urlButton.disabled = false;
    }
  }

  // ---------- import files ----------
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', multiple: true, class: 'visually-hidden', onchange: () => importFiles() });
  const fileButton = h('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, icon('folder', { size: 18 }), 'CSV-Dateien auswählen …');
  const fileStatus = h('p', { class: 'source__status', role: 'status' });
  const filePreview = h('div', { class: 'source__preview' });

  async function importFiles() {
    const files = [...fileInput.files];
    fileInput.value = '';
    if (!files.length) return;
    fileButton.disabled = true;
    filePreview.replaceChildren();
    fileStatus.className = 'source__status';
    try {
      const contents = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const result = await loadFromFiles(contents, { onProgress: (t) => (fileStatus.textContent = t) });
      fileStatus.textContent = '';
      showPreview(filePreview, result, {
        confirmLabel: 'Importieren',
        onConfirm: async () => {
          await lib.put(result, { kind: 'import' });
          ctx.toast(`„${result.name}“ wurde importiert.`);
          changed();
        },
      });
    } catch (e) {
      fileStatus.className = 'source__status is-error';
      fileStatus.textContent = e.message;
    } finally {
      fileButton.disabled = false;
    }
  }

  // ---------- preview before taking over a load result ----------
  function showPreview(slot, result, { intro, confirmLabel, onConfirm }) {
    const sum = summarizeResult(result);
    const issues = result.catalogs.flatMap((c) => c.errors ?? []);
    const hints = result.catalogs.flatMap((c) => c.warnings ?? []);
    const ok = h('button', { class: 'btn', type: 'button' }, confirmLabel);
    const cancel = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => slot.replaceChildren() }, 'Verwerfen');
    ok.addEventListener('click', async () => {
      ok.disabled = cancel.disabled = true;
      await onConfirm();
      slot.replaceChildren();
    });
    slot.replaceChildren(
      h(
        'div',
        { class: 'preview' },
        intro ? h('p', { class: 'preview__intro' }, intro) : null,
        h('p', { class: 'preview__title' }, `„${result.name}“`, result.version ? ` · Version ${result.version}` : ''),
        h('p', {}, `${plural(sum.questions, 'Frage', 'Fragen')} aus ${plural(sum.catalogs, 'Datei', 'Dateien')} in ${plural(sum.categories, 'Kategorie', 'Kategorien')}.`),
        h('ul', { class: 'preview__files' }, result.catalogs.map((c) => h('li', {}, `${c.name} (${c.file}): ${plural(c.questions.length, 'Frage', 'Fragen')}${c.errors?.length ? ` · ⚠ ${c.errors.length} übersprungen` : ''}`))),
        issues.length ? h('details', { class: 'issues' }, h('summary', {}, `⚠ ${plural(issues.length, 'Zeile', 'Zeilen')} übersprungen – Details`), issueList(issues)) : null,
        hints.length ? h('details', { class: 'issues issues--hint' }, h('summary', {}, `ℹ ${plural(hints.length, 'Hinweis', 'Hinweise')} (Fragen sind trotzdem enthalten)`), issueList(hints)) : null,
        h('div', { class: 'actions actions--start' }, cancel, ok),
      ),
    );
    ok.focus();
  }

  // ---------- data ----------
  async function resetStats() {
    const yes = await confirmDialog({
      title: 'Spielstatistik zurücksetzen?',
      text: 'Das Spiel vergisst, welche Fragen du schon hattest – danach kommen Wiederholungen wieder gleich häufig vor. Bestenlisten bleiben erhalten.',
      confirmLabel: 'Zurücksetzen',
    });
    if (!yes) return;
    ctx.stats = {};
    saveJson(KEYS.stats, {});
    ctx.toast('Spielstatistik zurückgesetzt.');
  }

  // ---------- game flow ----------
  const autoNext = h('input', {
    type: 'checkbox',
    role: 'switch',
    class: 'switch__input',
    onchange: (e) => {
      ctx.saveSettings({ autoNext: e.target.checked });
      audio.play('click');
    },
  });
  autoNext.checked = autoNextEnabled(ctx);
  const confirmAnswer = h('input', {
    type: 'checkbox',
    role: 'switch',
    class: 'switch__input',
    onchange: (e) => {
      ctx.saveSettings({ confirmAnswer: e.target.checked });
      audio.play('click');
    },
  });
  confirmAnswer.checked = ctx.settings.confirmAnswer === true;

  setKeyHandler((e) => {
    if (e.key === 'Escape') ctx.go('start');
  });

  const back = h('button', { class: 'btn', onclick: () => ctx.go('start') }, 'Fertig');
  mount(
    ctx.app,
    h('header', { class: 'setup__head' }, h('div', { class: 'setup__icon' }, icon('sliders', { size: 30 })), h('h1', {}, 'Optionen & Kataloge')),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Fragenkataloge'),
      h('p', { class: 'options__hint' }, 'Jede CSV-Datei ist ein eigener Katalog. Alle eingeschalteten Kataloge werden zu einem gemeinsamen Fragenpool vereint; gleiche Kategorien werden zusammengelegt.'),
      summary,
      lib.persistent ? null : h('p', { class: 'setup__info is-warning' }, '⚠ Dieser Browser erlaubt hier kein dauerhaftes Speichern – hinzugefügte Kataloge gelten nur, bis die Seite geschlossen wird.'),
      sourceList,
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Katalog aus dem Internet hinzufügen'),
      h(
        'p',
        { class: 'options__hint' },
        'Möglich sind ein GitHub-Repository (es wird catalogs/index.json gesucht), ein Ordner oder eine index.json mit mehreren CSV-Dateien, oder eine einzelne .csv-Datei. Der Server muss den Zugriff aus dem Browser erlauben – GitHub tut das. Danach funktioniert der Katalog auch offline.',
      ),
      urlForm,
      urlStatus,
      urlPreview,
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'CSV-Dateien importieren'),
      h('p', { class: 'options__hint' }, 'Eine oder mehrere CSV-Dateien von diesem Gerät – ganz ohne Internet. Bilder sind dabei nur als https-Adresse oder data:-URI möglich.'),
      fileInput,
      fileButton,
      fileStatus,
      filePreview,
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Spielablauf'),
      h(
        'label',
        { class: 'switch' },
        autoNext,
        h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
        h('span', { class: 'switch__text' }, `Automatisch weiter: ${AUTO_NEXT_SECONDS} Sekunden nach der Auflösung kommt die nächste Frage`),
      ),
      h('p', { class: 'options__hint' }, 'Antippen oder Scrollen hält die Automatik für die aktuelle Frage an, z. B. um eine Erklärung in Ruhe zu lesen.'),
      h(
        'label',
        { class: 'switch' },
        confirmAnswer,
        h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
        h('span', { class: 'switch__text' }, 'Antwort bestätigen: Eine Antwort ist erst gewählt, wenn du sie einloggst'),
      ),
      h('p', { class: 'options__hint' }, 'Antippen markiert die Antwort; „Antwort einloggen“, ein zweites Antippen oder Enter loggt sie ein. So lässt sich ein Vertippen noch korrigieren.'),
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', {}, 'Daten'),
      h('button', { class: 'link', type: 'button', onclick: () => resetStats() }, 'Spielstatistik zurücksetzen'),
    ),
    h('div', { class: 'actions' }, back),
  );
  renderSummary();
  renderSources();
  back.focus({ preventScroll: true });
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE');
}

function issueList(issues) {
  const shown = issues.slice(0, MAX_LISTED_ISSUES);
  return h(
    'ul',
    { class: 'issues__list' },
    shown.map((i) => h('li', {}, h('code', {}, `${i.source}${i.line ? `:${i.line}` : ''}`), ' ', i.message)),
    issues.length > shown.length ? h('li', {}, `… und ${issues.length - shown.length} weitere`) : null,
  );
}
