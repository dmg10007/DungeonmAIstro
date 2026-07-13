import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adventureOptionsSchema } from '../lib/schemas';
import type { AdventureOptions, Ruleset } from '../lib/schemas';
import { createCampaign } from '../lib/storage';

const TONES = ['Heroic', 'Dark', 'Humorous', 'Mysterious', 'Action-packed', 'Political', 'Exploration', 'Horror'];
const LENGTHS: Record<string, string> = {
  'Single session (2-4 hrs)': 'single_session',
  '3-session arc': '3_session_arc',
  'Full campaign (10+ sessions)': 'full_campaign',
};

const RULESET_OPTIONS: { id: Ruleset; label: string; description: string; icon: string }[] = [
  {
    id: 'dnd5e',
    label: 'D&D 5e',
    description: 'Dungeons & Dragons 5th Edition — heroic fantasy, d20 resolution, classes & levels.',
    icon: '⚔️',
  },
  {
    id: 'pathfinder2e',
    label: 'Pathfinder 2e',
    description: 'Pathfinder 2nd Edition — tactical fantasy, three-action economy, four degrees of success.',
    icon: '🔱',
  },
  {
    id: 'callofcthulhu7e',
    label: 'Call of Cthulhu',
    description: 'CoC 7th Edition — cosmic horror investigation, percentile skills, sanity erosion.',
    icon: '🐙',
  },
  {
    id: 'shadowrun6e',
    label: 'Shadowrun 6e',
    description: 'Shadowrun 6th Edition — cyberpunk urban fantasy, dice pool d6s, Edge meta-currency.',
    icon: '🤖',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Describe your own homebrew or unsupported system. The DM will run it as you define it.',
    icon: '🎲',
  },
];

const RULES_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'By the Book', description: 'Strict RAW — all rules enforced accurately. Misunderstandings corrected gently but precisely.' },
  2: { label: 'Mostly RAW', description: 'Rules as written with minor common-table rulings allowed.' },
  3: { label: 'Balanced', description: "Rules as intended — bent for fun when it doesn't break balance." },
  4: { label: 'Flexible', description: 'Rules are guidelines. Player agency and narrative take priority.' },
  5: { label: 'Rule of Cool', description: "Anything goes if it's dramatic and fun. Rules are suggestions." },
};

const NARRATIVE_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Pure Narrative', description: 'Cinematic outcomes. Dice called only for high-stakes moments.' },
  2: { label: 'Story-first', description: 'Mostly narrative with occasional mechanical checks.' },
  3: { label: 'Balanced', description: 'Mix of vivid description and tactical dice rolls.' },
  4: { label: 'Dice-leaning', description: 'Frequent skill checks and saves alongside rich narration.' },
  5: { label: 'Dice Heavy', description: 'Lean into the mechanical game — skill checks, saving throws, contested rolls throughout.' },
};

const VERBOSITY_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: 'Terse', description: '1–3 tight paragraphs. Maximum momentum, minimum fluff.' },
  2: { label: 'Concise', description: '2–4 paragraphs. Enough detail to set the mood, but economical.' },
  3: { label: 'Balanced', description: '3–5 paragraphs. Scenes breathe without overstaying their welcome.' },
  4: { label: 'Rich', description: '4–7 paragraphs. Deep atmosphere, NPC personality, and world detail.' },
  5: { label: 'Verbose', description: '6+ paragraphs. Novelistic prose — every moment fully realised.' },
};

export default function Setup() {
  const navigate = useNavigate();
  const [ruleset, setRuleset] = useState<Ruleset>('dnd5e');
  const [customRulesetName, setCustomRulesetName] = useState('');
  const [customRulesetDescription, setCustomRulesetDescription] = useState('');
  const [mode, setMode] = useState<'one_shot' | 'campaign'>('one_shot');
  const [playerCount, setPlayerCount] = useState(1);
  const [experienceLevel, setExperienceLevel] = useState<AdventureOptions['experienceLevel']>('new');
  const [tone, setTone] = useState<string[]>(['Heroic']);
  const [desiredLength, setDesiredLength] = useState(Object.keys(LENGTHS)[0]);
  const [settingPrompt, setSettingPrompt] = useState('');
  const [safetyMode, setSafetyMode] = useState<'strict' | 'balanced'>('balanced');
  const [rulesStrictness, setRulesStrictness] = useState(3);
  const [narrativeStyle, setNarrativeStyle] = useState(3);
  const [responseVerbosity, setResponseVerbosity] = useState(3);
  const [error, setError] = useState<string | null>(null);

  function toggleTone(t: string) {
    setTone(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const options = {
      ruleset,
      customRulesetName: ruleset === 'custom' ? customRulesetName : undefined,
      customRulesetDescription: ruleset === 'custom' ? customRulesetDescription : undefined,
      mode,
      playerCount,
      experienceLevel,
      tone,
      desiredLength,
      settingPrompt,
      safetyMode,
      rulesStrictness,
      narrativeStyle,
      responseVerbosity,
    };
    const parsed = adventureOptionsSchema.safeParse(options);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    const title = settingPrompt.slice(0, 60) || `${mode === 'one_shot' ? 'One-shot' : 'Campaign'} — ${new Date().toLocaleDateString()}`;
    createCampaign(title, parsed.data, []);
    navigate('/characters');
  }

  const sectionLabel: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', display: 'block' };

  return (
    <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-6)', color: 'var(--color-primary)' }}>Configure Your Adventure</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

        {/* ── Ruleset picker ─────────────────────────────────── */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={sectionLabel}>Game System</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
            {RULESET_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRuleset(opt.id)}
                title={opt.description}
                aria-pressed={ruleset === opt.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-3) var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${ruleset === opt.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: ruleset === opt.id ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-interactive), background var(--transition-interactive)',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: ruleset === opt.id ? 'var(--color-primary)' : 'var(--color-text)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
          {/* Description of selected ruleset */}
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
            {RULESET_OPTIONS.find(o => o.id === ruleset)?.description}
          </p>
          {/* Custom ruleset fields */}
          {ruleset === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <div>
                <label htmlFor="customName" style={sectionLabel}>Ruleset Name</label>
                <input
                  id="customName"
                  className="input"
                  maxLength={80}
                  placeholder="e.g. My Homebrew System, Blades in the Dark, OSE..."
                  value={customRulesetName}
                  onChange={e => setCustomRulesetName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="customDesc" style={sectionLabel}>Ruleset Description</label>
                <textarea
                  id="customDesc"
                  className="input"
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe the core resolution mechanic, key systems, and any rules you want the DM to enforce..."
                  value={customRulesetDescription}
                  onChange={e => setCustomRulesetDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>{customRulesetDescription.length}/2000</div>
              </div>
            </div>
          )}
        </fieldset>

        {/* ── Mode ───────────────────────────────────────────── */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={sectionLabel}>Adventure Type</legend>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            {(['one_shot', 'campaign'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`btn ${mode === m ? 'btn-primary' : 'btn-ghost'}`}>
                {m === 'one_shot' ? 'One-shot' : 'Campaign'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Players ────────────────────────────────────────── */}
        <div>
          <label htmlFor="playerCount" style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between' }}>
            <span>Number of Players</span><span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{playerCount}</span>
          </label>
          <input id="playerCount" type="range" min={1} max={4} value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}><span>1</span><span>4</span></div>
        </div>

        {/* ── Experience level ───────────────────────────────── */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={sectionLabel}>Player Experience</legend>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {(['new', 'intermediate', 'expert'] as const).map(lvl => (
              <button key={lvl} type="button" onClick={() => setExperienceLevel(lvl)}
                className={`btn ${experienceLevel === lvl ? 'btn-primary' : 'btn-ghost'}`}>
                {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Tone ───────────────────────────────────────────── */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={sectionLabel}>Adventure Tone (pick any)</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {TONES.map(t => (
              <button key={t} type="button" onClick={() => toggleTone(t)}
                className={`btn ${tone.includes(t) ? 'btn-primary' : 'btn-ghost'}`}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Length ─────────────────────────────────────────── */}
        <div>
          <label htmlFor="length" style={sectionLabel}>Adventure Length</label>
          <select id="length" className="input" value={desiredLength} onChange={e => setDesiredLength(e.target.value)}>
            {Object.keys(LENGTHS).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* ── Rules Strictness ───────────────────────────────── */}
        <div>
          <label htmlFor="rulesStrictness" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span>Rules Strictness</span>
            <span style={{ color: 'var(--color-primary)' }}>{RULES_LABELS[rulesStrictness].label}</span>
          </label>
          <input id="rulesStrictness" type="range" min={1} max={5} step={1} value={rulesStrictness}
            onChange={e => setRulesStrictness(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            aria-valuetext={RULES_LABELS[rulesStrictness].label}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            <span>By the Book</span><span>Rule of Cool</span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{RULES_LABELS[rulesStrictness].description}</p>
        </div>

        {/* ── Narrative Style ────────────────────────────────── */}
        <div>
          <label htmlFor="narrativeStyle" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span>Narrative Style</span>
            <span style={{ color: 'var(--color-primary)' }}>{NARRATIVE_LABELS[narrativeStyle].label}</span>
          </label>
          <input id="narrativeStyle" type="range" min={1} max={5} step={1} value={narrativeStyle}
            onChange={e => setNarrativeStyle(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            aria-valuetext={NARRATIVE_LABELS[narrativeStyle].label}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            <span>Pure Narrative</span><span>Dice Heavy</span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{NARRATIVE_LABELS[narrativeStyle].description}</p>
        </div>

        {/* ── Response Verbosity ─────────────────────────────── */}
        <div>
          <label htmlFor="responseVerbosity" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span>DM Response Length</span>
            <span style={{ color: 'var(--color-primary)' }}>{VERBOSITY_LABELS[responseVerbosity].label}</span>
          </label>
          <input id="responseVerbosity" type="range" min={1} max={5} step={1} value={responseVerbosity}
            onChange={e => setResponseVerbosity(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
            aria-valuetext={VERBOSITY_LABELS[responseVerbosity].label}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
            <span>Terse</span><span>Verbose</span>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{VERBOSITY_LABELS[responseVerbosity].description}</p>
        </div>

        {/* ── Custom prompt ──────────────────────────────────── */}
        <div>
          <label htmlFor="prompt" style={sectionLabel}>Adventure Prompt (optional)</label>
          <textarea id="prompt" className="input" rows={4} maxLength={4000}
            value={settingPrompt} onChange={e => setSettingPrompt(e.target.value)}
            placeholder="Describe your ideal adventure — setting, villains, themes, anything..."
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>{settingPrompt.length}/4000</div>
        </div>

        {/* ── Safety mode ────────────────────────────────────── */}
        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend style={sectionLabel}>Content Safety</legend>
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
