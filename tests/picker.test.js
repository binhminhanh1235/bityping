import { describe, it, expect } from 'vitest';
import { filterCardsByTopics, calculateCardWeight, pickNextCard } from '../src/lib/picker.js';

describe('src/lib/picker.js', () => {
  const mockPacks = [
    {
      id: 'p1',
      topic: 'Microservices',
      cards: [
        { id: 'c1', en: 'Card 1', vi: 'Thẻ 1' },
        { id: 'c2', en: 'Card 2', vi: 'Thẻ 2' }
      ]
    },
    {
      id: 'p2',
      topic: 'Database',
      cards: [
        { id: 'c3', en: 'Card 3', vi: 'Thẻ 3' },
        { id: 'c4', en: 'Card 4', vi: 'Thẻ 4' }
      ]
    }
  ];

  it('filters cards by topic accurately', () => {
    const all = filterCardsByTopics(mockPacks, 'all');
    expect(all).toHaveLength(4);

    const micro = filterCardsByTopics(mockPacks, ['Microservices']);
    expect(micro).toHaveLength(2);
    expect(micro[0].topic).toBe('Microservices');

    const both = filterCardsByTopics(mockPacks, ['Microservices', 'Database']);
    expect(both).toHaveLength(4);
  });

  it('calculates higher weight for weak cards', () => {
    const unseenCard = { id: 'c_new' };
    const goodCard = { id: 'c_good' };
    const weakCard = { id: 'c_weak' };

    const history = {
      c_good: { attempts: 5, errors: 0, lastAccuracy: 100 },
      c_weak: { attempts: 3, errors: 6, lastAccuracy: 65 }
    };

    const unseenWeight = calculateCardWeight(unseenCard, history);
    const goodWeight = calculateCardWeight(goodCard, history);
    const weakWeight = calculateCardWeight(weakCard, history);

    expect(unseenWeight).toBe(10);
    expect(goodWeight).toBe(1);
    expect(weakWeight).toBeGreaterThan(goodWeight);
  });

  it('picks next card without repeating recent cards', () => {
    let recentIds = ['c1', 'c2', 'c3'];
    // Với 4 thẻ c1, c2, c3, c4 và 3 thẻ đã nằm trong recentIds, chỉ còn c4
    const result = pickNextCard({
      packs: mockPacks,
      selectedTopics: 'all',
      recentCardIds: recentIds
    });

    expect(result.card.id).toBe('c4');
    expect(result.recentCardIds).toContain('c4');
  });

  it('handles small card pool (N <= 20) safely without getting stuck', () => {
    const singlePack = [
      {
        id: 'p1',
        topic: 'Test',
        cards: [
          { id: 'c1', en: 'A', vi: 'A' },
          { id: 'c2', en: 'B', vi: 'B' }
        ]
      }
    ];

    const result = pickNextCard({
      packs: singlePack,
      selectedTopics: 'all',
      recentCardIds: ['c1']
    });

    // Chỉ có 2 thẻ, recentId là c1 -> phải chọn c2
    expect(result.card.id).toBe('c2');
  });
});
