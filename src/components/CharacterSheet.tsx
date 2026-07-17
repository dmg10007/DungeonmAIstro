/**
 * CharacterSheet — sidebar panel rendered inside Play.tsx
 *
 * Displays relevant stats depending on the campaign ruleset:
 *   dnd5e / pathfinder2e → 6 ability scores + modifiers, AC/HP/Speed/Init/Prof, optional spellcasting
 *   callofcthulhu7e      → 8 characteristics (STR/DEX/CON/INT/WIS=POW/CHA=APP + SIZ via speed, EDU via prof)
 *                          HP, Sanity (armorClass), Luck (initiative), Magic Points (temporaryHitPoints), MOV
 *   shadowrun6e          → BOD/AGI/REA/STR/WIL/LOG mapped to str/dex/con/wis/int + initiative/armor/essence
 *   custom               → generic fallback, renders whatever fields are populated
 */
import { abilityModifier, formatModifier } from '../lib/dice';
import type { Character } from '../lib/schemas';
import type { Ruleset } from '../lib/schemas';

interface Props {
  character: Character;
  ruleset: Ruleset;
}

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------
function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2)', textAlign: 'center',
    }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '10px' }}>{sub}</div>}
      <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase',
      letterSpacing: '0.08em', fontSize: '10px', marginBottom: 'var(--space-2)',
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-divider)', paddingBottom: 'var(--space-1)' }}>
      <span>{label}</span>
      <span style={{ color: 'var(--color-text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Block({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
      <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', marginBottom: 4 }}>{title}</div>
      <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0, maxWidth: '100%', wordBreak: 'break-word', fontSize: 'var(--text-xs)' }}>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Character name / identity header (shared by all rulesets)
// ---------------------------------------------------------------------------
function IdentityHeader({ character, subtitle }: { character: Character; subtitle: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 2 }}>
        {character.characterName}
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{subtitle}</div>
      {character.alignment && (
        <div style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-xs)', marginTop: 2 }}>{character.alignment}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// D&D 5e / Pathfinder 2e sheet
// ---------------------------------------------------------------------------
const DNDPF_ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const DNDPF_ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

function SheetDnDPF2e({ character, label }: { character: Character; label: string }) {
  const s = character.abilityScores;
  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={label} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={label} />

      {/* Combat stats */}
      <div>
        <SectionHeader>Combat</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="AC"     value={character.armorClass} />
          <StatBox label="HP"     value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          <StatBox label="Speed"  value={`${character.speed}ft`} />
          <StatBox label="Prof"   value={`+${character.proficiencyBonus}`} />
          <StatBox label="Init"   value={formatModifier(character.initiative ?? abilityModifier(s.dex))} />
          <StatBox label="Tmp HP" value={character.temporaryHitPoints ?? 0} />
        </div>
      </div>

      {/* Ability scores */}
      <div>
        <SectionHeader>Ability Scores</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {DNDPF_ABILITY_KEYS.map(k => (
            <StatBox key={k} label={DNDPF_ABILITY_LABELS[k]} value={s[k]} sub={formatModifier(abilityModifier(s[k]))} />
          ))}
        </div>
      </div>

      {/* Spellcasting */}
      {character.spellcastingClass && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <SectionHeader>Spellcasting</SectionHeader>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--text-xs)' }}>
            {character.spellcastingAbility && <span><strong>{character.spellcastingAbility.toUpperCase()}</strong> ability</span>}
            {character.spellSaveDC != null && <span>Save DC <strong>{character.spellSaveDC}</strong></span>}
            {character.spellAttackBonus != null && <span>Atk <strong>{formatModifier(character.spellAttackBonus)}</strong></span>}
          </div>
        </div>
      )}

      <Block title="Equipment" text={character.equipment} />
      <Block title="Traits"    text={character.traits} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Call of Cthulhu 7e sheet
//
// Field mapping (stored in the unified Character schema):
//   str → STR    dex → DEX    con → CON
//   int → INT    wis → POW    cha → APP
//   speed        → MOV
//   armorClass   → Dodge %
//   hitPoints    → HP
//   initiative   → DEX rank (if set)
//   profBonus    → EDU (stored 0 if not applicable; CoC chargen sets it to 0)
//   temporaryHP  → Magic Points
//   level        → not used (stored 1)
//   background   → Occupation
//   equipment    → Possessions
//   traits       → Personal Description / Notes
//   ideals       → Ideology / Beliefs (repurposed)
//   bonds        → Significant People (repurposed)
//   flaws        → Fears / Phobias (repurposed)
// ---------------------------------------------------------------------------
const COC_CHAR_KEYS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'POW' },
  { key: 'cha', label: 'APP' },
] as const;

function SheetCoC7e({ character }: { character: Character }) {
  const s = character.abilityScores;
  const subtitle = `${character.background ?? 'Investigator'} · 1920s`;

  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={subtitle} />;

  // Half & fifth values for each characteristic
  function half(v: number)  { return Math.floor(v / 2); }
  function fifth(v: number) { return Math.floor(v / 5); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />

      {/* Vitals */}
      <div>
        <SectionHeader>Vitals</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="HP"      value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          <StatBox label="Sanity"  value={`${character.armorClass}/99`} />
          <StatBox label="Luck"    value={character.initiative ?? Math.floor(s.wis * 5)} />
          <StatBox label="Magic Pts" value={character.temporaryHitPoints ?? Math.floor(s.wis / 5)} />
          <StatBox label="MOV"     value={character.speed} />
          <StatBox label="Dodge"   value={`${half(s.dex)}%`} />
        </div>
      </div>

      {/* Characteristics */}
      <div>
        <SectionHeader>Characteristics</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {COC_CHAR_KEYS.map(({ key, label }) => {
            const v = s[key];
            return (
              <div key={key} style={{
                background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2)', textAlign: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ color: 'var(--color-text-faint)', fontSize: '9px', fontVariantNumeric: 'tabular-nums' }}>
                  {half(v)}&nbsp;/&nbsp;{fifth(v)}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 'var(--space-1)', fontSize: '10px', color: 'var(--color-text-faint)', textAlign: 'center' }}>full&nbsp;/&nbsp;½&nbsp;/&nbsp;⅕</div>
      </div>

      {/* Occupation & background */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <InfoRow label="Occupation" value={character.background} />
        <InfoRow label="EDU"        value={character.proficiencyBonus > 0 ? character.proficiencyBonus * 5 : undefined} />
      </div>

      <Block title="Possessions"       text={character.equipment} />
      <Block title="Description / Notes" text={character.traits} />
      <Block title="Ideology / Beliefs" text={character.ideals} />
      <Block title="Significant People" text={character.bonds} />
      <Block title="Fears / Phobias"    text={character.flaws} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shadowrun 6e sheet
//
// Field mapping:
//   str → STR    dex → AGI    con → BOD
//   int → REA    wis → WIL    cha → CHA
//   armorClass   → Armor
//   speed        → Initiative dice (stored as e.g. 9)
//   initiative   → Initiative score
//   profBonus    → Edge
//   temporaryHP  → Essence (×10 to store as int; display as /10)
//   background   → Metatype / Role
//   equipment    → Gear / Cyberware
// ---------------------------------------------------------------------------
const SR_ATTR_KEYS = [
  { key: 'con', label: 'BOD' },
  { key: 'dex', label: 'AGI' },
  { key: 'int', label: 'REA' },
  { key: 'str', label: 'STR' },
  { key: 'wis', label: 'WIL' },
  { key: 'cha', label: 'CHA' },
] as const;

function SheetSR6e({ character }: { character: Character }) {
  const s = character.abilityScores;
  const subtitle = `${character.background ?? character.race} · SR6e`;

  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={subtitle} />;

  const essenceRaw = character.temporaryHitPoints ?? 60; // stored ×10
  const essence = (essenceRaw / 10).toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />

      {/* Combat */}
      <div>
        <SectionHeader>Combat</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="HP"      value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          <StatBox label="Armor"   value={character.armorClass} />
          <StatBox label="Init"    value={`${character.initiative ?? s.int + s.dex}+${character.speed}d6`} />
          <StatBox label="Edge"    value={character.proficiencyBonus} />
          <StatBox label="Essence" value={essence} />
          <StatBox label="Karma"   value={character.experiencePoints ?? 0} />
        </div>
      </div>

      {/* Attributes */}
      <div>
        <SectionHeader>Attributes</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {SR_ATTR_KEYS.map(({ key, label }) => (
            <StatBox key={key} label={label} value={s[key]} />
          ))}
        </div>
      </div>

      <Block title="Gear / Cyberware" text={character.equipment} />
      <Block title="Notes"            text={character.traits} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom / generic fallback sheet
// ---------------------------------------------------------------------------
function SheetCustom({ character }: { character: Character }) {
  const s = character.abilityScores;
  const subtitle = `${character.race} ${character.class}${character.level > 0 ? ` · Lvl ${character.level}` : ''}`;
  const hasScores = s && Object.values(s).some(v => v !== 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />

      {/* Stats — show whatever is non-default */}
      <div>
        <SectionHeader>Stats</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="HP"    value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          {character.armorClass > 0   && <StatBox label="Defense"  value={character.armorClass} />}
          {character.speed > 0        && <StatBox label="Speed"    value={character.speed} />}
          {character.proficiencyBonus > 0 && <StatBox label="Prof" value={`+${character.proficiencyBonus}`} />}
        </div>
      </div>

      {hasScores && (
        <div>
          <SectionHeader>Attributes</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {(Object.entries(s) as [string, number][]).map(([k, v]) => (
              <StatBox key={k} label={k.toUpperCase()} value={v} />
            ))}
          </div>
        </div>
      )}

      <Block title="Equipment" text={character.equipment} />
      <Block title="Traits"    text={character.traits} />
      <Block title="Notes"     text={character.ideals} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Missing scores fallback
// ---------------------------------------------------------------------------
function MissingScores({ character, subtitle }: { character: Character; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />
      <div style={{ color: 'var(--color-warning)', background: 'var(--color-warning-highlight)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
        ⚠ Ability scores missing. Re-create or re-save this character to fix.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — routes to the correct sheet
// ---------------------------------------------------------------------------
export default function CharacterSheet({ character, ruleset }: Props) {
  switch (ruleset) {
    case 'dnd5e':
      return <SheetDnDPF2e character={character} label={`${character.race} ${character.class} · Level ${character.level}${character.background ? ` · ${character.background}` : ''}`} />;
    case 'pathfinder2e':
      return <SheetDnDPF2e character={character} label={`${character.race} ${character.class} · Level ${character.level} (PF2e)${character.background ? ` · ${character.background}` : ''}`} />;
    case 'callofcthulhu7e':
      return <SheetCoC7e character={character} />;
    case 'shadowrun6e':
      return <SheetSR6e character={character} />;
    case 'custom':
    default:
      return <SheetCustom character={character} />;
  }
}
