import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adventureOptionsSchema } from '../lib/schemas';
import type { AdventureOptions } from '../lib/schemas';
import { createCampaign } from '../lib/storage';

const TONES = ['Heroic', 'Dark', 'Humorous', 'Mysterious', 'Action-packed', 'Political', 'Exploration', 'Horror'];
const LENGTHS: Record<string, string> = {
  'Single session (2-4 hrs)': 'single_session',
  '3-session arc': '3_session_arc',
  'Full campaign (10+ sessions)': 'full_campaign',
};

export default function Setup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'one_shot' | 'campaign'>('one_shot');
  const [playerCount, setPlayerCount] = useState(1);
  const [experienceLevel, setExperienceLevel] = useState<AdventureOptions['experienceLevel']>('new');
  const [tone, setTone] = useState<string[]>(['Heroic']);
  const [desiredLength, setDesiredLength] = useState(Object.keys(LENGTHS)[0]);
  const [settingPrompt, setSettingPrompt] = useState('');
  const [safetyMode, setSafetyMode] = useState<'strict' | 'balanced'>('balanced');
  const [error, setError] = useState<string | null>(null);

  function toggleTone(t: string) {
    setTone(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const options = { mode, playerCount, experienceLevel, tone, desiredLength, settingPrompt, safetyMode };
    const parsed = adventureOptionsSchema.safeParse(options);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    const title = settingPrompt.slice(0, 60) || `${mode === 'one_shot' ? 'One-shot' : 'Campaign'} — ${new Date().toLocaleDateString()}`;
    createCampaign(title, parsed.data, []);
    navigate('/characters');
  }

  return (
    <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-6)', color: 'var(--color-primary)' }}>Configure Your Adventure</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* Mode */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Adventure Type</legend>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {(['one_shot', 'campaign'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`btn ${mode === m ? 'btn-primary' : 'btn-ghost'}`}>
                {m === 'one_shot' ? 'One-shot' : 'Campaign'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Players */}
        <div>
          <label htmlFor="playerCount" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>Number of Players: {playerCount}</label>
          <input id="playerCount" type="range" min={1} max={4} value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}><span>1</span><span>4</span></div>
        </div>

        {/* Experience level */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Player Experience</legend>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(['new', 'intermediate', 'expert'] as const).map(lvl => (
              <button key={lvl} type="button" onClick={() => setExperienceLevel(lvl)}
                className={`btn ${experienceLevel === lvl ? 'btn-primary' : 'btn-ghost'}`}>
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Tone */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Adventure Tone (pick any)</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {TONES.map(t => (
              <button key={t} type="button" onClick={() => toggleTone(t)}
                className={`btn ${tone.includes(t) ? 'btn-primary' : 'btn-ghost'}`}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Length */}
        <div>
          <label htmlFor="length" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>Adventure Length</label>
          <select id="length" className="input" value={desiredLength} onChange={e => setDesiredLength(e.target.value)}>
            {Object.keys(LENGTHS).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Custom prompt */}
        <div>
          <label htmlFor="prompt" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>Adventure Prompt (optional)</label>
          <textarea id="prompt" className="input" rows={4} maxLength={4000}
            value={settingPrompt} onChange={e => setSettingPrompt(e.target.value)}
            placeholder="Describe your ideal adventure — setting, villains, themes, anything..."
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>{settingPrompt.length}/4000</div>
        </div>

        {/* Safety mode */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Content Safety</legend>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {(['strict', 'balanced'] as const).map(s => (
              <button key={s} type="button" onClick={() => setSafetyMode(s)}
                className={`btn ${safetyMode === s ? 'btn-primary' : 'btn-ghost'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>
          Next: Add Characters &rarr;
        </button>
      </form>
    </div>
  );
}
