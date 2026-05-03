import { describe, expect, it } from 'vitest';
import {
  CHARACTER_PALETTE_VERSION,
  createPaletteDraft,
  getPaletteSlotControls,
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
    draft.r6c0 = '#EBB087';
    draft.r0c0 = '#FFFFFF';

    expect(serializePaletteDraft('mage', draft)).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r2c0: '#BDC185',
        r3c0: '#BDC185',
        r4c7: '#1F1F1F',
        r5c7: '#1F1F1F',
        r6c4: '#00FF88',
      },
    });
  });

  it('groups mage slots that should be edited together', () => {
    expect(getPaletteSlotGroups('mage')).toHaveLength(6);
    expect(getPaletteSlotsForControl('mage', 'r2c0')).toEqual([]);
    expect(getPaletteSlotsForControl('mage', 'r2c2')).toEqual(['r2c2', 'r3c2', 'r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('mage', 'r2c3')).toEqual(['r2c3', 'r3c3', 'r6c5', 'r7c5']);
    expect(getPaletteSlotsForControl('mage', 'r2c7')).toEqual(['r2c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('mage', 'r4c1')).toEqual(['r2c2', 'r3c2', 'r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('mage', 'r4c2')).toEqual(['r4c2', 'r5c2']);
    expect(getPaletteSlotsForControl('mage', 'r4c7')).toEqual([]);
    expect(getPaletteSlotsForControl('mage', 'r5c2')).toEqual(['r4c2', 'r5c2']);
    expect(getPaletteSlotsForControl('mage', 'r6c0')).toEqual(['r2c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('mage', 'r7c1')).toEqual(['r6c1', 'r7c1', 'r7c2']);
    expect(getPaletteSlotsForControl('mage', 'r6c3')).toEqual(['r6c3', 'r6c4', 'r7c3', 'r7c4']);
    expect(getPaletteSlotsForControl('mage', 'r6c4')).toEqual(['r6c3', 'r6c4', 'r7c3', 'r7c4']);
    expect(getPaletteSlotsForControl('mage', 'r7c5')).toEqual(['r2c3', 'r3c3', 'r6c5', 'r7c5']);
  });

  it('uses the current named mage palette defaults', () => {
    const draft = createPaletteDraft('mage');
    const controlDefaults = Object.fromEntries(
      getPaletteSlotControls('mage').map((control) => [control.label, draft[control.slots[0]]]),
    );

    expect(controlDefaults).toEqual({
      Pele: '#EBB087',
      Cabelo: '#1F1E1E',
      'Roupas 1': '#653681',
      'Roupas 2': '#7A3B00',
      'Roupas 3': '#DB0000',
      'Roupas 4': '#999494',
    });
  });

  it('groups barbarian slots that should be edited together', () => {
    expect(getPaletteSlotGroups('barbarian')).toHaveLength(6);
    expect(getPaletteSlotsForControl('barbarian', 'r0c1')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r1c1')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r2c7')).toEqual(['r2c7', 'r3c7', 'r4c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('barbarian', 'r3c7')).toEqual(['r2c7', 'r3c7', 'r4c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('barbarian', 'r4c7')).toEqual(['r2c7', 'r3c7', 'r4c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('barbarian', 'r6c0')).toEqual(['r2c7', 'r3c7', 'r4c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('barbarian', 'r7c0')).toEqual(['r2c7', 'r3c7', 'r4c7', 'r6c0', 'r7c0']);
    expect(getPaletteSlotsForControl('barbarian', 'r4c0')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r4c2')).toEqual(['r4c2', 'r5c2']);
    expect(getPaletteSlotsForControl('barbarian', 'r5c2')).toEqual(['r4c2', 'r5c2']);
    expect(getPaletteSlotsForControl('barbarian', 'r5c0')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r5c3')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r5c7')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r6c1')).toEqual(['r6c1', 'r7c1']);
    expect(getPaletteSlotsForControl('barbarian', 'r7c1')).toEqual(['r6c1', 'r7c1']);
    expect(getPaletteSlotsForControl('barbarian', 'r6c2')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r7c2')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r6c3')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r7c3')).toEqual([]);
    expect(getPaletteSlotsForControl('barbarian', 'r2c3')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r3c3')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r4c5')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r4c6')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r5c5')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r5c6')).toEqual(['r2c3', 'r3c3', 'r4c5', 'r4c6', 'r5c5', 'r5c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r6c6')).toEqual(['r6c6', 'r7c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r7c6')).toEqual(['r6c6', 'r7c6']);
    expect(getPaletteSlotsForControl('barbarian', 'r6c7')).toEqual(['r6c7', 'r7c7']);
    expect(getPaletteSlotsForControl('barbarian', 'r7c7')).toEqual(['r6c7', 'r7c7']);
  });

  it('uses the current named barbarian palette defaults', () => {
    const draft = createPaletteDraft('barbarian');
    const controlDefaults = Object.fromEntries(
      getPaletteSlotControls('barbarian').map((control) => [control.label, draft[control.slots[0]]]),
    );

    expect(controlDefaults).toEqual({
      Pele: '#EBB087',
      Cabelo: '#B1B0AF',
      'Roupas 1': '#633B24',
      'Roupas 2': '#B94141',
      'Roupas 3': '#7A3B00',
      'Roupas 4': '#597B97',
    });
  });

  it('uses fixed hidden barbarian defaults', () => {
    const draft = createPaletteDraft('barbarian');

    expect(draft).toMatchObject({
      r0c1: '#F2F2F2',
      r1c1: '#F2F2F2',
      r4c0: '#B03D26',
      r5c0: '#F2F2F2',
      r5c3: '#A1958A',
      r5c7: '#7D726C',
      r6c2: '#1F1E1E',
      r6c3: '#A1958A',
      r7c2: '#1F1E1E',
      r7c3: '#A1958A',
    });
    expect(serializePaletteDraft('barbarian', draft)).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r0c1: '#F2F2F2',
        r1c1: '#F2F2F2',
        r4c0: '#B03D26',
        r5c0: '#F2F2F2',
        r5c3: '#A1958A',
        r5c7: '#7D726C',
        r6c2: '#1F1E1E',
        r6c3: '#A1958A',
        r7c2: '#1F1E1E',
        r7c3: '#A1958A',
      },
    });
  });

  it('groups knight slots that should be edited together', () => {
    expect(getPaletteSlotGroups('knight')).toHaveLength(6);
    expect(getPaletteSlotsForControl('knight', 'r4c0')).toEqual(['r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('knight', 'r4c1')).toEqual(['r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('knight', 'r5c0')).toEqual(['r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('knight', 'r5c1')).toEqual(['r4c0', 'r4c1', 'r5c0', 'r5c1']);
    expect(getPaletteSlotsForControl('knight', 'r4c2')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r4c7')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r6c4')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r6c7')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r7c4')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r7c7')).toEqual(['r4c2', 'r4c7', 'r6c4', 'r6c7', 'r7c4', 'r7c7']);
    expect(getPaletteSlotsForControl('knight', 'r6c3')).toEqual(['r6c3', 'r7c0', 'r7c3']);
    expect(getPaletteSlotsForControl('knight', 'r7c0')).toEqual(['r6c3', 'r7c0', 'r7c3']);
    expect(getPaletteSlotsForControl('knight', 'r7c3')).toEqual(['r6c3', 'r7c0', 'r7c3']);
    expect(getPaletteSlotsForControl('knight', 'r5c2')).toEqual([]);
    expect(getPaletteSlotsForControl('knight', 'r5c7')).toEqual([]);
    expect(getPaletteSlotsForControl('knight', 'r6c1')).toEqual(['r6c1', 'r7c1']);
    expect(getPaletteSlotsForControl('knight', 'r7c1')).toEqual(['r6c1', 'r7c1']);
    expect(getPaletteSlotsForControl('knight', 'r6c2')).toEqual([]);
    expect(getPaletteSlotsForControl('knight', 'r7c2')).toEqual([]);
    expect(getPaletteSlotsForControl('knight', 'r6c6')).toEqual(['r6c6', 'r7c6']);
    expect(getPaletteSlotsForControl('knight', 'r7c6')).toEqual(['r6c6', 'r7c6']);
  });

  it('uses the current named knight palette defaults', () => {
    const draft = createPaletteDraft('knight');
    const controlDefaults = Object.fromEntries(
      getPaletteSlotControls('knight').map((control) => [control.label, draft[control.slots[0]]]),
    );

    expect(controlDefaults).toEqual({
      Pele: '#EBB087',
      Cabelo: '#C48D56',
      'Roupas 1': '#969EB6',
      'Roupas 2': '#565654',
      'Roupas 3': '#7A3B00',
      'Roupas 4': '#A61F33',
    });
  });

  it('uses fixed hidden knight defaults', () => {
    const draft = createPaletteDraft('knight');

    expect(draft).toMatchObject({
      r5c2: '#999494',
      r5c7: '#565654',
      r6c2: '#1F1E1E',
      r7c2: '#1F1E1E',
    });
    expect(serializePaletteDraft('knight', draft)).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r5c2: '#999494',
        r5c7: '#565654',
        r6c2: '#1F1E1E',
        r7c2: '#1F1E1E',
      },
    });
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
          r6c0: '#EBB087',
          r6c1: 'nope',
        },
      },
      createdAt: 456,
    });

    expect(character.color).toBe('#00FF88');
    expect(character.palette).toEqual({
      version: CHARACTER_PALETTE_VERSION,
      slots: {
        r2c0: '#BDC185',
        r3c0: '#BDC185',
        r4c7: '#1F1F1F',
        r5c7: '#1F1F1F',
        r6c4: '#00FF88',
      },
    });
    expect(normalizeCharacterPalette('mage', character.palette)).toEqual(character.palette);
    expect(paletteSignature('mage', character.palette)).toBe('mage|r2c0:#BDC185|r3c0:#BDC185|r4c7:#1F1F1F|r5c7:#1F1F1F|r6c4:#00FF88');
  });
});
