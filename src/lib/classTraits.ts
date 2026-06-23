/**
 * classTraits.ts — Class features (levels 1–3) and background features for D&D 5e
 *
 * Data sourced from the 5e Basic Rules / SRD.
 * Used in CharacterLab to show a collapsible "Class & Background Traits" panel.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassFeature {
  level: 1 | 2 | 3;
  name: string;
  description: string;
}

export interface BackgroundFeature {
  name: string;
  description: string;
}

// ─── Class Features (Levels 1–3) ─────────────────────────────────────────────

export const CLASS_FEATURES: Record<string, ClassFeature[]> = {
  Barbarian: [
    {
      level: 1,
      name: 'Rage',
      description:
        'In battle you fight with primal ferocity. On your turn you can enter a rage as a bonus action. While raging you have advantage on Strength checks and saving throws, a bonus to melee damage rolls using Strength, and resistance to bludgeoning, piercing, and slashing damage. Rage lasts 1 minute and ends early if you are knocked unconscious or end your turn without attacking or taking damage.',
    },
    {
      level: 1,
      name: 'Unarmored Defense',
      description:
        'While not wearing armor your AC equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
    },
    {
      level: 2,
      name: 'Reckless Attack',
      description:
        'When you make your first attack on your turn you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
    },
    {
      level: 2,
      name: 'Danger Sense',
      description:
        'You gain an uncanny sense of when things nearby aren't as they should be, giving you advantage on Dexterity saving throws against effects you can see — such as traps and spells. You must not be blinded, deafened, or incapacitated to gain this benefit.',
    },
    {
      level: 3,
      name: 'Primal Path',
      description:
        'At 3rd level you choose a path that shapes the nature of your rage: Path of the Berserker or Path of the Totem Warrior (or another subclass from your DM). Your choice grants you features at 3rd, 6th, 10th, and 14th levels.',
    },
  ],

  Bard: [
    {
      level: 1,
      name: 'Spellcasting',
      description:
        'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Charisma is your spellcasting ability. You know 2 cantrips and 4 1st-level spells from the bard spell list at 1st level.',
    },
    {
      level: 1,
      name: 'Bardic Inspiration',
      description:
        'You can inspire others through stirring words or music. As a bonus action choose one creature other than yourself within 60 feet that can hear you. That creature gains a Bardic Inspiration die — a d6. Once within the next 10 minutes the creature can add the die to one ability check, attack roll, or saving throw. You can use this feature a number of times equal to your Charisma modifier (minimum once) and regain uses on a long rest.',
    },
    {
      level: 2,
      name: 'Jack of All Trades',
      description:
        'You can add half your proficiency bonus (rounded down) to any ability check that doesn't already include your proficiency bonus.',
    },
    {
      level: 2,
      name: 'Song of Rest',
      description:
        'You can use soothing music or oration during a short rest to help revitalize your wounded allies. Creatures that spend one or more Hit Dice and can hear your performance regain an extra 1d6 hit points.',
    },
    {
      level: 3,
      name: 'Bard College',
      description:
        'You delve into the advanced techniques of a bard college of your choice: the College of Lore or the College of Valor. Your choice grants you features at 3rd, 6th, and 14th levels.',
    },
    {
      level: 3,
      name: 'Expertise',
      description:
        'Choose two of your skill proficiencies or one skill and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make using those proficiencies.',
    },
  ],

  Cleric: [
    {
      level: 1,
      name: 'Spellcasting',
      description:
        'As a conduit for divine power you can cast cleric spells. Wisdom is your spellcasting ability. You prepare a number of spells equal to your Wisdom modifier + your cleric level, choosing from the entire cleric spell list.',
    },
    {
      level: 1,
      name: 'Divine Domain',
      description:
        'Choose one domain related to your deity — such as Life, Light, War, Knowledge, Nature, Tempest, or Trickery. Your choice grants you domain spells and other features at 1st, 2nd, 6th, 8th, and 17th levels.',
    },
    {
      level: 2,
      name: 'Channel Divinity',
      description:
        'You gain the ability to channel divine energy directly from your deity. You start with two effects: Turn Undead and an effect determined by your domain. When you use Channel Divinity choose which effect to create. You can use this feature once between short or long rests.',
    },
    {
      level: 2,
      name: 'Turn Undead',
      description:
        'As an action you present your holy symbol and speak a prayer censuring the undead. Each undead within 30 feet that can see or hear you must make a Wisdom saving throw. On a failure the creature is turned for 1 minute or until it takes damage.',
    },
    {
      level: 3,
      name: 'Divine Domain Feature',
      description:
        'At 3rd level your Divine Domain grants you an additional feature. For example, Life domain clerics gain Blessed Healer (healing spells also restore HP to you) and Knowledge domain clerics gain Visions of the Past.',
    },
  ],

  Druid: [
    {
      level: 1,
      name: 'Druidic',
      description:
        'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages. Others spot that a message has been written with a DC 15 Perception check but can't decipher it without knowing the language.',
    },
    {
      level: 1,
      name: 'Spellcasting',
      description:
        'Drawing on the divine essence of nature itself you can cast druid spells. Wisdom is your spellcasting ability. You prepare spells equal to your Wisdom modifier + your druid level, chosen from the druid spell list.',
    },
    {
      level: 2,
      name: 'Wild Shape',
      description:
        'Starting at 2nd level you can use your action to magically assume the shape of a beast you have seen before. You can use this feature twice and regain uses on a short or long rest. At 2nd level you can transform into a beast with a challenge rating of 1/4 or lower that doesn't have a flying or swimming speed.',
    },
    {
      level: 2,
      name: 'Druid Circle',
      description:
        'At 2nd level you choose to identify with a circle of druids — Circle of the Land or Circle of the Moon. Your choice grants you features at 2nd, 6th, 10th, and 14th levels.',
    },
    {
      level: 3,
      name: 'Druid Circle Feature',
      description:
        'At 3rd level you gain an additional feature from your Druid Circle. For example, Circle of the Moon druids improve their Wild Shape at 2nd level, and Circle of the Land druids gain Natural Recovery (regain spell slots on a short rest) at 6th level.',
    },
  ],

  Fighter: [
    {
      level: 1,
      name: 'Fighting Style',
      description:
        'You adopt a particular style of fighting as your specialty: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting. You can't take the same Fighting Style option more than once, even if you later get to choose again.',
    },
    {
      level: 1,
      name: 'Second Wind',
      description:
        'You have a limited well of stamina that you can draw on to protect yourself from harm. As a bonus action you can regain hit points equal to 1d10 + your fighter level. Once you use this feature you must finish a short or long rest before using it again.',
    },
    {
      level: 2,
      name: 'Action Surge',
      description:
        'Starting at 2nd level you can push yourself beyond your normal limits for a moment. On your turn you can take one additional action. Once you use this feature you must finish a short or long rest before using it again (two uses at 17th level).',
    },
    {
      level: 3,
      name: 'Martial Archetype',
      description:
        'At 3rd level you choose an archetype that you strive to emulate: Champion, Battle Master, or Eldritch Knight. The archetype you choose grants you features at 3rd, 7th, 10th, 15th, and 18th levels.',
    },
  ],

  Monk: [
    {
      level: 1,
      name: 'Unarmored Defense',
      description:
        'While not wearing armor or wielding a shield your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
    },
    {
      level: 1,
      name: 'Martial Arts',
      description:
        'Your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons. You gain the following benefits: use Dexterity instead of Strength for unarmed strikes and monk weapons, roll a d4 for unarmed strike damage (replacing the normal 1 damage), and make one unarmed strike as a bonus action when you use an attack action with a monk weapon or unarmed strike.',
    },
    {
      level: 2,
      name: 'Ki',
      description:
        'Your training allows you to harness the mystic energy of ki. You have a number of ki points equal to your monk level. You regain all spent ki points on a short or long rest. You can spend ki points on Flurry of Blows (bonus action: two unarmed strikes), Patient Defense (bonus action: Dodge action), or Step of the Wind (bonus action: Dash or Disengage).',
    },
    {
      level: 2,
      name: 'Unarmored Movement',
      description:
        'Starting at 2nd level your speed increases by 10 feet while not wearing armor or wielding a shield. This bonus increases as you gain levels.',
    },
    {
      level: 3,
      name: 'Monastic Tradition',
      description:
        'At 3rd level you commit to a monastic tradition: Way of the Open Hand, Way of Shadow, or Way of the Four Elements. Your tradition grants you features at 3rd, 6th, 11th, and 17th levels.',
    },
    {
      level: 3,
      name: 'Deflect Missiles',
      description:
        'You can use your reaction to deflect or catch a missile when you are hit by a ranged weapon attack. The damage is reduced by 1d10 + your Dexterity modifier + your monk level. If reduced to 0 you can catch the missile and, if you have a free hand, spend 1 ki point to make a ranged attack with it.',
    },
  ],

  Paladin: [
    {
      level: 1,
      name: 'Divine Sense',
      description:
        'The presence of strong evil registers on your senses like a noxious odor. As an action you can open your awareness to detect such forces. Until the end of your next turn you know the location of any celestial, fiend, or undead within 60 feet that is not behind total cover. You can use this feature a number of times equal to 1 + your Charisma modifier per long rest.',
    },
    {
      level: 1,
      name: 'Lay on Hands',
      description:
        'Your blessed touch can heal wounds. You have a pool of healing power totaling 5 × your paladin level hit points. As an action you can touch a creature and restore any number of hit points to it from this pool. Alternatively you can spend 5 hit points to cure one disease or neutralize one poison.',
    },
    {
      level: 2,
      name: 'Fighting Style',
      description:
        'Adopt a fighting style specialty: Defense, Dueling, Great Weapon Fighting, or Protection.',
    },
    {
      level: 2,
      name: 'Spellcasting',
      description:
        'You have learned to draw on divine magic through meditation and prayer. Charisma is your spellcasting ability. You prepare a number of paladin spells equal to your Charisma modifier + half your paladin level (rounded down).',
    },
    {
      level: 2,
      name: 'Divine Smite',
      description:
        'When you hit a creature with a melee weapon attack you can expend one paladin spell slot to deal radiant damage to the target, in addition to the weapon's damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st (max 5d8). Undead or fiends take an extra 1d8 damage.',
    },
    {
      level: 3,
      name: 'Divine Health',
      description:
        'By 3rd level the divine magic flowing through you makes you immune to disease.',
    },
    {
      level: 3,
      name: 'Sacred Oath',
      description:
        'When you reach 3rd level you swear the oath that binds you as a paladin forever: Oath of Devotion, Oath of the Ancients, or Oath of Vengeance. Your choice grants you Channel Divinity options and other features at 3rd, 7th, 15th, and 20th levels.',
    },
  ],

  Ranger: [
    {
      level: 1,
      name: 'Favored Enemy',
      description:
        'Beginning at 1st level you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy. Choose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. You have advantage on Survival checks to track your favored enemies and on Intelligence checks to recall information about them.',
    },
    {
      level: 1,
      name: 'Natural Explorer',
      description:
        'You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions. Choose one type of favored terrain. When you make an Intelligence or Wisdom check related to your favored terrain your proficiency bonus is doubled. Difficult terrain doesn't slow your group's travel, and you can't become lost except by magical means.',
    },
    {
      level: 2,
      name: 'Fighting Style',
      description:
        'At 2nd level adopt a fighting style: Archery, Defense, Dueling, or Two-Weapon Fighting.',
    },
    {
      level: 2,
      name: 'Spellcasting',
      description:
        'By the time you reach 2nd level you have learned to use the magical essence of nature to cast spells. Wisdom is your spellcasting ability. You know a number of 1st-level spells equal to your Wisdom modifier + half your ranger level (rounded down, minimum 1).',
    },
    {
      level: 3,
      name: 'Ranger Archetype',
      description:
        'At 3rd level you choose an archetype that you strive to emulate: Hunter or Beast Master. The archetype you choose grants you features at 3rd, 7th, 11th, and 15th levels.',
    },
    {
      level: 3,
      name: 'Primeval Awareness',
      description:
        'Beginning at 3rd level you can use your action and expend one ranger spell slot to focus your awareness on the region around you. For 1 minute per level of the spell slot you expend you can sense whether aberrations, celestials, dragons, elementals, fey, fiends, or undead are present within 1 mile of you (or 6 miles in your favored terrain).',
    },
  ],

  Rogue: [
    {
      level: 1,
      name: 'Expertise',
      description:
        'At 1st level choose two of your skill proficiencies or one skill and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make with those proficiencies. At 6th level choose two more.',
    },
    {
      level: 1,
      name: 'Sneak Attack',
      description:
        'Beginning at 1st level you know how to strike subtly and exploit a foe's distraction. Once per turn you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll or if another enemy of the target is adjacent to it. The extra damage increases as you gain levels.',
    },
    {
      level: 1,
      name: "Thieves' Cant",
      description:
        'During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation. It takes four times longer to convey such a message, but others who know the cant understand the message.',
    },
    {
      level: 2,
      name: 'Cunning Action',
      description:
        'Starting at 2nd level your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns to take the Dash, Disengage, or Hide action.',
    },
    {
      level: 3,
      name: 'Roguish Archetype',
      description:
        'At 3rd level you choose an archetype to emulate: Thief, Assassin, or Arcane Trickster. Your archetype choice grants you features at 3rd, 9th, 13th, and 17th levels.',
    },
  ],

  Sorcerer: [
    {
      level: 1,
      name: 'Spellcasting',
      description:
        'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you. This font of magic, whatever its origin, fuels your spells. Charisma is your spellcasting ability. You know 4 cantrips and 2 1st-level spells from the sorcerer spell list at 1st level.',
    },
    {
      level: 1,
      name: 'Sorcerous Origin',
      description:
        'Choose a sorcerous origin that describes the source of your innate magical power: Draconic Bloodline or Wild Magic. Your choice grants you features at 1st, 6th, 14th, and 18th levels.',
    },
    {
      level: 2,
      name: 'Font of Magic',
      description:
        'At 2nd level you tap into a deep wellspring of magic within yourself. You have sorcery points equal to your sorcerer level. You regain all spent sorcery points on a long rest. You can spend sorcery points to create additional spell slots (Flexible Casting) or convert spell slots into sorcery points.',
    },
    {
      level: 3,
      name: 'Metamagic',
      description:
        'At 3rd level you gain the ability to twist your spells to suit your needs. You gain two Metamagic options of your choice: Careful Spell, Distant Spell, Empowered Spell, Extended Spell, Heightened Spell, Quickened Spell, Subtle Spell, or Twinned Spell.',
    },
  ],

  Warlock: [
    {
      level: 1,
      name: 'Otherworldly Patron',
      description:
        'At 1st level you have struck a bargain with an otherworldly being: the Archfey, the Fiend, or the Great Old One. Your choice grants you features at 1st, 6th, 10th, and 14th levels, as well as the Expanded Spell List feature.',
    },
    {
      level: 1,
      name: 'Pact Magic',
      description:
        'Your arcane research and the magic bestowed on you by your patron have given you facility with spells. Charisma is your spellcasting ability. You know 2 cantrips and 2 1st-level spells from the warlock list. Warlock spell slots are regained on a short or long rest, and all your slots are the same level.',
    },
    {
      level: 2,
      name: 'Eldritch Invocations',
      description:
        'In your study of occult lore you have unearthed eldritch invocations — fragments of forbidden knowledge that imbue you with an abiding magical ability. You gain two invocations of your choice. Examples include Agonizing Blast (add Charisma to eldritch blast damage), Armor of Shadows (Mage Armor at will), and Devil's Sight (see in magical darkness).',
    },
    {
      level: 3,
      name: 'Pact Boon',
      description:
        'At 3rd level your otherworldly patron bestows a gift upon you for your loyal service: Pact of the Chain (find familiar with special forms), Pact of the Blade (create a magical melee weapon), or Pact of the Tome (Book of Shadows with three cantrips).',
    },
  ],

  Wizard: [
    {
      level: 1,
      name: 'Spellcasting',
      description:
        'As a student of arcane magic you have a spellbook containing spells that show the first glimmerings of your true power. Intelligence is your spellcasting ability. You know 3 cantrips and have a spellbook with 6 1st-level wizard spells. You prepare a number of spells equal to your Intelligence modifier + your wizard level each day.',
    },
    {
      level: 1,
      name: 'Arcane Recovery',
      description:
        'You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest you can choose expended spell slots to recover. The spell slots can have a combined level equal to or less than half your wizard level (rounded up), and none of the slots can be 6th level or higher.',
    },
    {
      level: 2,
      name: 'Arcane Tradition',
      description:
        'When you reach 2nd level you choose an arcane tradition from the list of available schools of magic: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, or Transmutation. Your choice grants you features at 2nd, 6th, 10th, and 14th levels.',
    },
    {
      level: 3,
      name: 'Arcane Tradition Feature',
      description:
        'At 3rd level your Arcane Tradition grants an additional feature. For example, Evokers gain Sculpt Spells (protect allies in the area of evocation spells) and Diviners gain Expert Divination (recover a spell slot when casting a divination spell of 2nd level or higher).',
    },
  ],
};

// ─── Background Features ──────────────────────────────────────────────────────

export const BACKGROUND_FEATURES: Record<string, BackgroundFeature> = {
  Acolyte: {
    name: 'Shelter of the Faithful',
    description:
      'As an acolyte you command the respect of those who share your faith, and you can perform the religious ceremonies of your deity. You and your adventuring companions can expect to receive free healing and care at a temple, shrine, or other established presence of your faith. Those who share your religion will support you (but only you) at a modest lifestyle.',
  },
  Charlatan: {
    name: 'False Identity',
    description:
      'You have created a second identity including documentation, established acquaintances, and disguises that allow you to assume that persona. Additionally you can forge documents including official papers and personal letters, as long as you have seen an example of the kind of document or the handwriting you are trying to copy.',
  },
  Criminal: {
    name: 'Criminal Contact',
    description:
      'You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals. You know how to get messages to and from your contact, even over great distances; specifically, you know the local messengers, corrupt caravan masters, and seedy sailors who can deliver messages for you.',
  },
  Entertainer: {
    name: 'By Popular Demand',
    description:
      'You can always find a place to perform, usually in an inn or tavern but possibly with a circus, at a theater, or even in a noble's court. At such a place you receive free lodging and food of a modest or comfortable standard (depending on the quality of the establishment), as long as you perform each night. In addition your performance makes you something of a local figure.',
  },
  'Folk Hero': {
    name: 'Rustic Hospitality',
    description:
      'Since you come from the ranks of the common folk you fit in among them with ease. You can find a place to hide, rest, or recuperate among other commoners, unless you have shown yourself to be a danger to them. They will shield you from the law or anyone else searching for you, though they will not risk their lives for you.',
  },
  'Guild Artisan': {
    name: 'Guild Membership',
    description:
      'As an established and respected member of a guild you can rely on certain benefits that membership provides. Your fellow guild members will provide you with lodging and food if necessary, and pay for your funeral if needed. In some cities and towns a guildhall offers a central place to meet other members of your profession, which can be a good place to meet potential patrons, allies, or hirelings.',
  },
  Hermit: {
    name: 'Discovery',
    description:
      'The quiet seclusion of your extended hermitage gave you access to a unique and powerful discovery. The exact nature of this revelation is up to you and your DM — it might be a great truth about the cosmos, the gods, the powerful forces of nature, or the forces of good and evil.',
  },
  Noble: {
    name: 'Position of Privilege',
    description:
      'Thanks to your noble birth people are inclined to think the best of you. You are welcome in high society and people assume you have the right to be wherever you are. The common folk make every effort to accommodate you and avoid your displeasure, and other people of high birth treat you as a member of the same social sphere.',
  },
  Outlander: {
    name: 'Wanderer',
    description:
      'You have an excellent memory for maps and geography, and you can always recall the general layout of terrain, settlements, and other features around you. In addition you can find food and fresh water for yourself and up to five other people each day, provided that the land offers berries, small game, water, and so forth.',
  },
  Sage: {
    name: 'Researcher',
    description:
      'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it. Usually this information comes from a library, scriptorium, university, or a sage or other learned person or creature.',
  },
  Sailor: {
    name: "Ship's Passage",
    description:
      'When you need to, you can secure free passage on a sailing ship for yourself and your adventuring companions. You might sail on the ship you served on, or another ship you have good relations with. Because you\'re calling in a favor, you can't be certain of a schedule or route that will meet your every need. In return, you are expected to assist the crew during the voyage.',
  },
  Soldier: {
    name: 'Military Rank',
    description:
      'You have a military rank from your career as a soldier. Soldiers loyal to your former military organization still recognize your authority and influence, and they defer to you if they are of a lower rank. You can invoke your rank to exert influence over other soldiers and requisition simple equipment or horses for temporary use.',
  },
  Urchin: {
    name: 'City Secrets',
    description:
      'You know the secret patterns and flow to cities and can find passages through the urban sprawl that others would miss. When you are not in combat you (and companions you lead) can travel between any two locations in the city twice as fast as your speed would normally allow.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all features for a class at or below the given level. */
export function getClassFeaturesUpToLevel(
  className: string,
  level: number,
): ClassFeature[] {
  return (CLASS_FEATURES[className] ?? []).filter(f => f.level <= level);
}

/** Returns the background feature for a given background, or undefined. */
export function getBackgroundFeature(
  background: string,
): BackgroundFeature | undefined {
  return BACKGROUND_FEATURES[background];
}
