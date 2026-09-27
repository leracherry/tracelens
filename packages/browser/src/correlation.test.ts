import { describe, expect, it } from 'vitest';
import { InteractionCorrelator, sanitizeNetworkUrl } from './correlation';

describe('InteractionCorrelator', () => {
  it('matches browser entries to captured input', () => {
    const correlator = new InteractionCorrelator();
    correlator.add({ id: 'save', type: 'click', name: 'Save', startTime: 100 });
    expect(correlator.match('click', 112)?.id).toBe('save');
    expect(correlator.active(250)?.id).toBe('save');
  });

  it('expires candidates outside the correlation window', () => {
    const correlator = new InteractionCorrelator();
    correlator.add({ id: 'old', type: 'click', name: 'Save', startTime: 100 });
    expect(correlator.active(5_101)).toBeUndefined();
  });

  it('keeps the latest candidate active for async work', () => {
    const correlator = new InteractionCorrelator();
    correlator.add({
      id: 'pointer',
      type: 'pointerdown',
      name: 'Save',
      startTime: 100,
    });
    correlator.add({
      id: 'click',
      type: 'click',
      name: 'Save',
      startTime: 120,
    });
    expect(correlator.active(1_000)?.id).toBe('click');
  });

  it('finds a pointer candidate that can be shared with its click', () => {
    const correlator = new InteractionCorrelator();
    correlator.add({
      id: 'shared',
      type: 'pointerdown',
      name: 'Place order',
      startTime: 100,
    });
    expect(correlator.match('pointerdown', 140)?.id).toBe('shared');
  });
});

describe('sanitizeNetworkUrl', () => {
  it('drops query strings and fragments', () => {
    expect(
      sanitizeNetworkUrl(
        '/api/users?email=private@example.com#profile',
        'https://app.test/settings',
      ),
    ).toBe('https://app.test/api/users');
  });
});
