const timestamp = Date.parse('2026-09-28T18:00:00Z');

export function createStudioDemoEvents() {
  const events = [];
  const add = (release, id, type, payload, offset) => {
    events.push({
      version: 1,
      id: `${release}-${id}`,
      timestamp: timestamp + offset,
      sessionId: `session-${release}`,
      app: 'billing-dashboard',
      release,
      commit: release === '2.14.0' ? '7ac841f' : '42bc310',
      environment: 'production',
      type,
      payload,
    });
  };
  const interaction = (release, id, duration, startTime, offset) =>
    add(
      release,
      id,
      'interaction',
      {
        interactionId: id,
        interactionType: 'click',
        name: 'Save settings',
        route: '/settings/profile',
        startTime,
        duration,
        timing: {
          total: duration,
          inputDelay: 11,
          processingDuration: release === '2.14.0' ? 287 : 90,
          presentationDelay: duration - 11 - (release === '2.14.0' ? 287 : 90),
        },
        target: {
          tagName: 'button',
          name: 'Save settings',
          selector: 'button',
        },
      },
      offset,
    );

  interaction('2.13.4', 'save-old', 183, 100, 1);
  add(
    '2.13.4',
    'lcp-old',
    'web-vital',
    { name: 'LCP', value: 1820, rating: 'good', route: '/settings/profile' },
    2,
  );
  add(
    '2.13.4',
    'frame-old',
    'long-frame',
    {
      startTime: 112,
      duration: 82,
      blockingDuration: 32,
      interactionId: 'save-old',
      scripts: [],
    },
    3,
  );
  add(
    '2.13.4',
    'render-old',
    'react-render',
    {
      component: 'BillingForm',
      phase: 'update',
      duration: 44,
      baseDuration: 51,
      startTime: 120,
      commitTime: 164,
      renderCount: 1,
      interactionId: 'save-old',
    },
    4,
  );

  interaction('2.14.0', 'save-new', 487, 2100, 101);
  add(
    '2.14.0',
    'lcp-new',
    'web-vital',
    { name: 'LCP', value: 1910, rating: 'good', route: '/settings/profile' },
    102,
  );
  add(
    '2.14.0',
    'frame-new',
    'long-frame',
    {
      startTime: 2112,
      duration: 381,
      blockingDuration: 331,
      interactionId: 'save-new',
      scripts: [
        {
          source: 'https://app.example/assets/settings.js',
          functionName: 'validateSettings',
          duration: 287,
          thirdParty: false,
          originalLocation: {
            source: 'src/features/settings/BillingForm.tsx',
            line: 183,
            column: 9,
            githubUrl:
              'https://github.com/leracherry/tracelens/blob/214f550/src/features/settings/BillingForm.tsx#L183',
          },
        },
      ],
    },
    103,
  );
  add(
    '2.14.0',
    'request-new',
    'network',
    {
      method: 'PATCH',
      url: 'https://app.example/api/settings',
      status: 204,
      startTime: 2220,
      duration: 214,
      interactionId: 'save-new',
      transport: 'fetch',
    },
    104,
  );
  add(
    '2.14.0',
    'render-new',
    'react-render',
    {
      component: 'BillingForm',
      phase: 'update',
      duration: 117,
      baseDuration: 126,
      startTime: 2260,
      commitTime: 2377,
      renderCount: 3,
      interactionId: 'save-new',
    },
    105,
  );
  return events;
}
