import { setLang, useLang, type Lang } from '../i18n';

const OPTIONS: { k: Lang; label: string; name: string }[] = [
  { k: 'he', label: 'עב', name: 'עברית' },
  { k: 'ru', label: 'RU', name: 'Русский' },
];

/** Hebrew / Russian switch. Each option is labelled in its own language so it can be found either way. */
export function LangSwitch() {
  const lang = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language / שפה / Язык">
      {OPTIONS.map((o) => (
        <button key={o.k} lang={o.k} aria-pressed={lang === o.k} aria-label={o.name} title={o.name} onClick={() => setLang(o.k)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
