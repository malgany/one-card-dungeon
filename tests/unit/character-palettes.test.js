import { describe, expect, it } from 'vitest';
import {
  CHARACTER_PALETTE_VERSION,
  createPaletteDraft,
  getPaletteSlotGroups,
  getPaletteSlotsForControl,
  normalizeCharacterPalette,
  normalizeCharacterRecord,
  normalizeHexColor,
  paletteSignature,
  serializePaletteDraft,
} from '../../js/config/character-palettes.js';

describe('character palettes', () => {
  it('normalizes hex colors for color input and storage', () => {
    expect(normalizeHexColor('#00ff88')).toBe('#00FF88');
    expect(normalizeHexColor('abc')).toBe('#AABBCC');
    expect(normalizeHexColor('#12')).toBeNull();
    expect(normalizeHexColor('not-a-color')).toBeNull();
  });

  it('serializes only valid changed slots for the selected class', () => {
    const draft = createPaletteDraft('mage');
    draft.r6c4 = '#00ff88';
    draft.r6c0 = '#FBC05B';
    draft.r0c0 = '#FFFFFF';

    expect(serializePaletteDraft('mage', draft)).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r6c4: '#00FF88',
      },
    });
  });

  it('groups mage slots that should be edited together', () => {
    expect(getPaletteSlotGroups('mage')).toHaveLength(20);
    expect(getPaletteSlotsForControl('mage', 'r4c1')).toEqual(['r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('mage', 'r7c1')).toEqual(['r6c1', 'r7c1']);
    expect(getPaletteSlotsForControl('mage', 'r5c2')).toEqual(['r4c2', 'r5c2']);
    expect(getPaletteSlotsForControl('mage', 'r7c5')).toEqual(['r6c5', 'r7c5']);
  });

  it('normalizes legacy characters without requiring palette data', () => {
    const character = normalizeCharacterRecord({
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#d39b32',
      image: '/assets/characters/ranger.png',
      createdAt: 123,
    });

    expect(character).toMatchObject({
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#D39B32',
      palette: {
        version: CHARACTER_PALETTE_VERSION,
        slots: {},
      },
      image: '/assets/characters/ranger.png',
      createdAt: 123,
    });
  });

  it('normalizes custom character palettes and drops invalid slots', () => {
    const character = normalizeCharacterRecord({
      id: 'custom-character',
      name: 'Aria',
      type: 'mage',
      palette: {
        version: 1,
        slots: {
          r6c4: '#00ff88',
          r0c0: '#FFFFFF',
          r6c0: '#FBC05B',
          r6c1: 'nope',
        },
      },
      createdAt: 456,
    });

    expect(character.color).toBe('#00FF88');
    expect(character.palette).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r6c4: '#00FF88',
      },
    });
    expect(normalizeCharacterPalette('mage', character.palette)).toEqual(character.palette);
    expect(paletteSignature('mage', character.palette)).toBe('mage|r6c4:#00FF88');
  });
});
