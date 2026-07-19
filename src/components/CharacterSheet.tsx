/**
 * CharacterSheet — sidebar panel rendered inside Play.tsx
 *
 * Props:
 *   character  – the active Character
 *   ruleset    – drives which layout to use
 *   full       – false (default): show priority stats only
 *                true: show every populated field
 */
import { useState } from 'react';
import { abilityModifier, formatModifier } from '../lib/dice';
import type { Character } from '../lib/schemas';
import type { Ruleset } from '../lib/schemas';

interface Props {
  character: Character;
  ruleset: Ruleset;
  full?: boolean;
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

function parseBracketTokens(text: string): { tokens: { label: string; value: string }[]; prose: string } {
  const tokens: { label: string; value: string }[] = [];
  const bracketRe = /\[([A-Za-z][A-Za-z0-9 _-]*):\s*([^\]]+)\]/g;
  const prose = text
    .replace(bracketRe, (_match, key, val) => {
      tokens.push({ label: key.toUpperCase(), value: val.trim() });
      return '';
    })
    .replace(/^[\s|;,]+|[\s|;,]+$/g, '')
    .replace(/[\s|;,]{2,}/g, ' | ')
    .trim();
  return { tokens, prose };
}

function Block({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  const { tokens, prose } = parseBracketTokens(text);

  const pipeSegments = prose
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
  const allKV = pipeSegments.length > 1 && pipeSegments.every(s => /^[^:]{1,30}:\s*.+/.test(s));

  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
      <SectionHeader>{title}</SectionHeader>

      {allKV
        ? pipeSegments.map((seg, i) => {
            const colonIdx = seg.indexOf(':');
            const k = seg.slice(0, colonIdx).trim();
            const v = seg.slice(colonIdx + 1).trim();
            return <InfoRow key={i} label={k} value={v} />;
          })
        : prose && (
            <p style={{
              color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0,
              maxWidth: '100%', wordBreak: 'break-word', fontSize: 'var(--text-xs)',
              marginBottom: tokens.length ? 'var(--space-3)' : 0,
            }}>
              {prose}
            </p>
          )
      }

      {tokens.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
          gap: 'var(--space-1)',
          marginTop: allKV ? 'var(--space-3)' : undefined,
        }}>
          {tokens.map(({ label, value }, i) => (
            <div key={i} style={{
              background: 'var(--color-surface-offset)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-1) var(--space-2)',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)', lineHeight: 1.2 }}>{value}</div>
              <div style={{ color: 'var(--color-text-faint)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
// D&D 5e / Pathfinder 2e
// ---------------------------------------------------------------------------
const DNDPF_ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const DNDPF_ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

function SheetDnDPF2e({ character, label, full }: { character: Character; label: string; full: boolean }) {
  const s = character.abilityScores;
  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={label} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={label} />

      {/* Combat stats — always visible */}
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

      {/* Ability scores — always visible */}
      <div>
        <SectionHeader>Ability Scores</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {DNDPF_ABILITY_KEYS.map(k => (
            <StatBox key={k} label={DNDPF_ABILITY_LABELS[k]} value={s[k]} sub={formatModifier(abilityModifier(s[k]))} />
          ))}
        </div>
      </div>

      {/* Spellcasting — always visible if present */}
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

      {/* ── Full view extras ── */}
      {full && (
        <>
          {character.race && <InfoRow label="Race" value={character.race} />}
          {character.background && <InfoRow label="Background" value={character.background} />}
          {character.experiencePoints != null && <InfoRow label="XP" value={character.experiencePoints} />}
          <Block title="Equipment"        text={character.equipment} />
          <Block title="Traits"           text={character.traits} />
          <Block title="Ideals"           text={character.ideals} />
          <Block title="Bonds"            text={character.bonds} />
          <Block title="Flaws"            text={character.flaws} />
          <Block title="Features &amp; Abilities" text={character.classAbilities?.join('\n') ?? null} />
        </>
      )}

      {/* Priority-only blocks (hidden in full view since they appear above) */}
      {!full && (
        <>
          <Block title="Equipment" text={character.equipment} />
          <Block title="Traits"    text={character.traits} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Call of Cthulhu 7e
// ---------------------------------------------------------------------------
const COC_CHAR_KEYS = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'POW' },
  { key: 'cha', label: 'APP' },
] as const;

function SheetCoC7e({ character, full }: { character: Character; full: boolean }) {
  const s = character.abilityScores;
  const subtitle = `${character.background ?? 'Investigator'} · 1920s`;

  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={subtitle} />;

  function half(v: number)  { return Math.floor(v / 2); }
  function fifth(v: number) { return Math.floor(v / 5); }

  // SIZ and EDU aren't in abilityScores but may be encoded in speed/proficiencyBonus
  const sizValue  = character.speed > 0 ? character.speed : null;
  const eduValue  = character.proficiencyBonus > 0 ? character.proficiencyBonus * 5 : null;
  const buildValue = character.initiative != null ? character.initiative : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />

      {/* Vitals — always visible */}
      <div>
        <SectionHeader>Vitals</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="HP"        value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          <StatBox label="Sanity"    value={`${character.armorClass}/99`} />
          <StatBox label="Luck"      value={character.temporaryHitPoints ?? Math.floor(s.wis * 5)} />
          <StatBox label="Magic Pts" value={character.temporaryHitPoints ?? Math.floor(s.wis / 5)} />
          <StatBox label="MOV"       value={sizValue ?? '—'} />
          <StatBox label="Dodge"     value={`${half(s.dex)}%`} />
        </div>
      </div>

      {/* Characteristics — always visible */}
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

      {/* Occupation & core derived — always visible */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <InfoRow label="Occupation" value={character.background} />
        {eduValue  != null && <InfoRow label="EDU" value={`${eduValue}%`} />}
      </div>

      {/* ── Full view extras ── */}
      {full && (
        <>
          {sizValue  != null && <InfoRow label="SIZ" value={sizValue} />}
          {buildValue != null && <InfoRow label="Build" value={buildValue > 0 ? `+${buildValue}` : String(buildValue)} />}
          {character.race && <InfoRow label="Age / Background" value={character.race} />}
          {character.alignment && <InfoRow label="Alignment / Archetype" value={character.alignment} />}
          {character.experiencePoints != null && <InfoRow label="Improvement points" value={character.experiencePoints} />}
          <Block title="Possessions"           text={character.equipment} />
          <Block title="Description / Notes"   text={character.traits} />
          <Block title="Ideology / Beliefs"    text={character.ideals} />
          <Block title="Significant People"    text={character.bonds} />
          <Block title="Fears / Phobias"       text={character.flaws} />
          <Block title="Skills &amp; Abilities"  text={character.classAbilities?.join('\n') ?? null} />
        </>
      )}

      {/* Priority-only blocks */}
      {!full && (
        <>
          <Block title="Possessions"          text={character.equipment} />
          <Block title="Description / Notes"  text={character.traits} />
          <Block title="Ideology / Beliefs"   text={character.ideals} />
          <Block title="Significant People"   text={character.bonds} />
          <Block title="Fears / Phobias"      text={character.flaws} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shadowrun 6e
// ---------------------------------------------------------------------------
const SR_ATTR_KEYS = [
  { key: 'con', label: 'BOD' },
  { key: 'dex', label: 'AGI' },
  { key: 'int', label: 'REA' },
  { key: 'str', label: 'STR' },
  { key: 'wis', label: 'WIL' },
  { key: 'cha', label: 'CHA' },
] as const;

function SheetSR6e({ character, full }: { character: Character; full: boolean }) {
  const s = character.abilityScores;
  const subtitle = `${character.background ?? character.race} · SR6e`;

  if (!s || typeof s.dex === 'undefined') return <MissingScores character={character} subtitle={subtitle} />;

  const essenceRaw = character.temporaryHitPoints ?? 60;
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

      {/* ── Full view extras ── */}
      {full && (
        <>
          {character.race && <InfoRow label="Metatype" value={character.race} />}
          {character.alignment && <InfoRow label="Archetype" value={character.alignment} />}
          <Block title="Gear / Cyberware" text={character.equipment} />
          <Block title="Notes"            text={character.traits} />
          <Block title="Contacts"         text={character.bonds} />
          <Block title="Skills"           text={character.classAbilities?.join('\n') ?? null} />
        </>
      )}

      {!full && (
        <>
          <Block title="Gear / Cyberware" text={character.equipment} />
          <Block title="Notes"            text={character.traits} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom / generic fallback
// ---------------------------------------------------------------------------
function SheetCustom({ character, full }: { character: Character; full: boolean }) {
  const s = character.abilityScores;
  const subtitle = `${character.race} ${character.class}${character.level > 0 ? ` · Lvl ${character.level}` : ''}`;
  const hasScores = s && Object.values(s).some(v => v !== 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <IdentityHeader character={character} subtitle={subtitle} />

      <div>
        <SectionHeader>Stats</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          <StatBox label="HP"    value={`${character.currentHitPoints}/${character.hitPointMaximum}`} />
          {character.armorClass > 0       && <StatBox label="Defense" value={character.armorClass} />}
          {character.speed > 0            && <StatBox label="Speed"   value={character.speed} />}
          {character.proficiencyBonus > 0 && <StatBox label="Prof"    value={`+${character.proficiencyBonus}`} />}
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

      {full && (
        <>
          <Block title="Ideals"  text={character.ideals} />
          <Block title="Bonds"   text={character.bonds} />
          <Block title="Flaws"   text={character.flaws} />
          <Block title="Notes"   text={character.ideals} />
          <Block title="Skills"  text={character.classAbilities?.join('\n') ?? null} />
        </>
      )}
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
// Public export
// ---------------------------------------------------------------------------
export default function CharacterSheet({ character, ruleset, full = false }: Props) {
  switch (ruleset) {
    case 'dnd5e':
      return <SheetDnDPF2e character={character} full={full} label={`${character.race} ${character.class} · Level ${character.level}${character.background ? ` · ${character.background}` : ''}`} />;
    case 'pathfinder2e':
      return <SheetDnDPF2e character={character} full={full} label={`${character.race} ${character.class} · Level ${character.level} (PF2e)${character.background ? ` · ${character.background}` : ''}`} />;
    case 'callofcthulhu7e':
      return <SheetCoC7e character={character} full={full} />;
    case 'shadowrun6e':
      return <SheetSR6e character={character} full={full} />;
    case 'custom':
    default:
      return <SheetCustom character={character} full={full} />;
  }
}
