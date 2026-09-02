// Rolls-Royce Motor Cars Demo - Data 360 Web SDK Sitemap
// Tracks: page views, clicks, scroll depth, configurator steps, form interactions, dwell time

// Block Adobe/BMW scripts that cause redirect away from demo site
(function() {
  var blocked = ['assets.adobedtm.com', 'p15r.js', 'epaas.js', 'evergage.com', 'bmw.com/p15r'];
  var origCreate = document.createElement;
  document.createElement = function(tag) {
    var el = origCreate.call(document, tag);
    if (tag === 'script') {
      var origSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      Object.defineProperty(el, 'src', {
        set: function(v) {
          if (v && blocked.some(function(b) { return v.indexOf(b) !== -1; })) {
            return;
          }
          origSrc.set.call(this, v);
        },
        get: function() { return origSrc.get.call(this); }
      });
    }
    return el;
  };
})();

(function() {
  'use strict';

  // Helper: debounce for scroll tracking
  function debounce(fn, ms) {
    let timer;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  // Helper: get page category from URL
  function getPageCategory() {
    const path = window.location.pathname;
    if (path.includes('/home.html')) return 'home';
    if (path.includes('/showroom/') && path.includes('-commission')) return 'commission';
    if (path.includes('/showroom/') && path.includes('-in-detail')) return 'modelDetail';
    if (path.includes('/showroom/')) return 'showroom';
    if (path.includes('configure-your-rolls-royce')) return 'configurator';
    if (path.includes('/bespoke/')) return 'bespoke';
    if (path.includes('/ownership/')) return 'ownership';
    if (path.includes('/muse/')) return 'muse';
    if (path.includes('/inspiring-greatness/')) return 'inspiringGreatness';
    if (path.includes('/boutique/')) return 'boutique';
    if (path.includes('/dealers')) return 'dealerLocator';
    if (path.includes('contact-rolls-royce')) return 'contact';
    if (path.includes('/information/')) return 'information';
    return 'other';
  }

  // Helper: extract model name from URL
  function getModelFromUrl() {
    const path = window.location.pathname;
    const models = ['spectre', 'phantom-extended', 'phantom', 'ghost-extended', 'ghost-prism', 'ghost', 'cullinan', 'black-badge'];
    for (const model of models) {
      if (path.includes('/' + model)) return model.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return null;
  }

  // Scroll depth tracking
  const scrollMilestones = [25, 50, 75, 100];
  const reachedMilestones = new Set();

  const trackScroll = debounce(function() {
    const scrollPercent = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    scrollMilestones.forEach(milestone => {
      if (scrollPercent >= milestone && !reachedMilestones.has(milestone)) {
        reachedMilestones.add(milestone);
        if (window.SalesforceInteractions) {
          SalesforceInteractions.sendEvent({
            interaction: {
              name: 'scrollDepth',
              eventType: 'scrollDepth',
              attributes: {
                scrollPercent: milestone,
                pageSection: getPageCategory(),
                pageUrl: window.location.pathname
              }
            }
          });
        }
      }
    });
  }, 200);

  window.addEventListener('scroll', trackScroll, { passive: true });

  // Global click tracking for CTAs and navigation
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a, button, [role="button"], .cta, .btn');
    if (!target || !window.SalesforceInteractions) return;

    const label = target.textContent.trim().substring(0, 100);
    const type = target.tagName.toLowerCase();
    const href = target.getAttribute('href') || '';

    // Only track meaningful clicks (skip empty or hash-only)
    if (label.length < 2 && !href) return;

    SalesforceInteractions.sendEvent({
      interaction: {
        name: 'clickTracking',
        eventType: 'clickTracking',
        attributes: {
          elementType: type,
          elementLabel: label,
          elementId: target.id || '',
          pageSection: getPageCategory(),
          pageUrl: window.location.pathname
        }
      }
    });
  }, true);

  // Initialize SDK when loaded
  function initSitemap() {
    if (!window.SalesforceInteractions) {
      setTimeout(initSitemap, 500);
      return;
    }

    SalesforceInteractions.init({
      consents: [{ purpose: 'Tracking', provider: 'Demo', status: 'OptIn' }],
      dataCloud: {
        timeTracking: {
          enabled: true,
          thresholds: [
            { label: 'BROWSING', threshold: 10000 },
            { label: 'INTERESTED', threshold: 30000 },
            { label: 'HIGHLY_ENGAGED', threshold: 120000 }
          ],
          eventTypes: ['catalog', 'configuratorStep', 'userEngagement', 'scrollDepth', 'clickTracking'],
          activityTimeoutMillis: 5000,
          minimumActivityTimeToRegister: 300,
          maxSessionDurationMillis: 3600000,
          sendPageExitWithoutThreshold: true,
          maxEventsPerSession: 100
        }
      }
    }).then(function() {
      // Fix: explicit updateConsents required — init() consent not recognized by CDP beacon
      if (SalesforceInteractions.ConsentPurpose && SalesforceInteractions.ConsentStatus) {
        SalesforceInteractions.updateConsents([{
          purpose: SalesforceInteractions.ConsentPurpose.Tracking,
          provider: 'Demo',
          status: SalesforceInteractions.ConsentStatus.OptIn
        }]);
      }

      SalesforceInteractions.initSitemap({
        global: {
          onActionEvent: function(actionEvent) {
            actionEvent.pageCategory = getPageCategory();
            actionEvent.modelName = getModelFromUrl();
            return actionEvent;
          }
        },
        pageTypeDefault: {
          name: 'default',
          interaction: {
            name: 'pageView',
            eventType: 'userEngagement',
            attributes: {
              pageCategory: getPageCategory(),
              pageUrl: window.location.pathname
            }
          }
        },
        pageTypes: [
          // Homepage
          {
            name: 'home',
            isMatch: function() { return window.location.pathname.includes('/home.html'); },
            interaction: {
              name: 'pageView',
              eventType: 'userEngagement',
              attributes: { pageCategory: 'home' }
            }
          },
          // Showroom overview
          {
            name: 'showroom',
            isMatch: function() {
              return window.location.pathname.endsWith('/showroom.html');
            },
            interaction: {
              name: 'pageView',
              eventType: 'userEngagement',
              attributes: { pageCategory: 'showroom' }
            }
          },
          // Model detail pages
          {
            name: 'modelDetail',
            isMatch: function() {
              var p = window.location.pathname;
              return p.includes('/showroom/') && p.includes('-in-detail');
            },
            interaction: {
              name: SalesforceInteractions.CatalogObjectInteractionName
                ? SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObjectDetail
                : 'View Catalog Object Detail',
              catalogObject: {
                type: 'Vehicle',
                id: getModelFromUrl() || 'unknown',
                attributes: {
                  name: getModelFromUrl() || 'Unknown Model',
                  category: 'modelDetail'
                }
              }
            }
          },
          // Model overview pages (e.g., /showroom/spectre.html)
          {
            name: 'modelOverview',
            isMatch: function() {
              var p = window.location.pathname;
              return p.includes('/showroom/') && !p.includes('-in-detail') && !p.includes('-commission') && !p.includes('black-badge.html') && p !== '/showroom.html';
            },
            interaction: {
              name: SalesforceInteractions.CatalogObjectInteractionName
                ? SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObject
                : 'View Catalog Object',
              catalogObject: {
                type: 'Vehicle',
                id: getModelFromUrl() || 'unknown',
                attributes: {
                  name: getModelFromUrl() || 'Unknown Model',
                  category: 'showroom'
                }
              }
            }
          },
          // Commission pages (configurator entry points)
          {
            name: 'commission',
            isMatch: function() {
              return window.location.pathname.includes('-commission');
            },
            interaction: {
              name: 'configuratorStep',
              eventType: 'configuratorStep',
              attributes: {
                stepName: 'commissionPageView',
                stepCategory: 'flow',
                modelName: getModelFromUrl() || 'unknown',
                stepIndex: 0
              }
            }
          },
          // Main configurator page
          {
            name: 'configurator',
            isMatch: function() {
              return window.location.pathname.includes('configure-your-rolls-royce');
            },
            interaction: {
              name: 'configuratorStep',
              eventType: 'configuratorSession',
              attributes: {
                modelName: 'selection',
                stepName: 'configuratorLanding'
              }
            }
          },
          // Contact page
          {
            name: 'contact',
            isMatch: function() {
              return window.location.pathname.includes('contact-rolls-royce');
            },
            interaction: {
              name: 'pageView',
              eventType: 'formInteraction',
              attributes: {
                formName: 'contactRollsRoyce',
                formAction: 'pageView'
              }
            }
          },
          // Dealer locator
          {
            name: 'dealerLocator',
            isMatch: function() {
              return window.location.pathname.includes('/dealers');
            },
            interaction: {
              name: 'pageView',
              eventType: 'userEngagement',
              attributes: { pageCategory: 'dealerLocator' }
            }
          },
          // Ownership pages
          {
            name: 'ownership',
            isMatch: function() {
              return window.location.pathname.includes('/ownership/');
            },
            interaction: {
              name: 'pageView',
              eventType: 'userEngagement',
              attributes: {
                pageCategory: 'ownership',
                pageSubcategory: window.location.pathname.split('/').pop().replace('.html', '')
              }
            }
          },
          // Bespoke pages
          {
            name: 'bespoke',
            isMatch: function() {
              return window.location.pathname.includes('/bespoke/') &&
                !window.location.pathname.includes('configure-your-rolls-royce') &&
                !window.location.pathname.includes('-commission');
            },
            interaction: {
              name: 'pageView',
              eventType: 'userEngagement',
              attributes: { pageCategory: 'bespoke' }
            }
          }
        ]
      });

      console.log('[RR Demo SDK] Sitemap initialized with deep tracking');
    });
  }

  // Form interaction tracking for contact pages
  document.addEventListener('focusin', function(e) {
    if (!e.target.matches('input, textarea, select')) return;
    if (!window.SalesforceInteractions) return;
    SalesforceInteractions.sendEvent({
      interaction: {
        name: 'formInteraction',
        eventType: 'formInteraction',
        attributes: {
          formName: e.target.closest('form') ? e.target.closest('form').id || 'contactForm' : 'unknownForm',
          formAction: 'fieldFocus',
          fieldName: e.target.name || e.target.id || e.target.type
        }
      }
    });
  }, true);

  document.addEventListener('submit', function(e) {
    if (!window.SalesforceInteractions) return;
    var form = e.target;
    var emailField = form.querySelector('input[type="email"], input[name*="email"]');
    var phoneField = form.querySelector('input[type="tel"], input[name*="phone"]');

    // Fire form submission event
    SalesforceInteractions.sendEvent({
      interaction: {
        name: 'formInteraction',
        eventType: 'formInteraction',
        attributes: {
          formName: form.id || 'contactForm',
          formAction: 'submit'
        }
      }
    });

    // Fire identity events if email/phone captured
    if (emailField && emailField.value) {
      SalesforceInteractions.sendEvent({
        interaction: {
          name: 'contactFormSubmit',
          eventType: 'userEngagement',
          attributes: { formName: form.id || 'contactForm' }
        },
        user: {
          attributes: {
            eventType: 'contactPointEmail',
            email: emailField.value
          }
        }
      });
    }
    if (phoneField && phoneField.value) {
      SalesforceInteractions.sendEvent({
        user: {
          attributes: {
            eventType: 'contactPointPhone',
            phoneNumber: phoneField.value
          }
        }
      });
    }
  }, true);

  // Form abandon tracking
  window.addEventListener('beforeunload', function() {
    var activeForm = document.querySelector('form:focus-within, form .focused');
    if (activeForm && window.SalesforceInteractions) {
      SalesforceInteractions.sendEvent({
        interaction: {
          name: 'formInteraction',
          eventType: 'formInteraction',
          attributes: {
            formName: activeForm.id || 'contactForm',
            formAction: 'abandon'
          }
        }
      });
    }
  });

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSitemap);
  } else {
    initSitemap();
  }

  // === DEMO EVENT INJECTION ===
  // Activate via ?demo=true or window.runRRDemo()
  window.runRRDemo = function() {
    if (!window.SalesforceInteractions) {
      console.error('[RR Demo] SDK not loaded');
      return;
    }
    console.log('[RR Demo] Starting demo event sequence...');
    var delay = 0;
    var steps = [
      { ms: 0, name: 'Homepage view', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'pageView', eventType: 'userEngagement', attributes: { pageCategory: 'home' }}});
      }},
      { ms: 2000, name: 'Scroll 75%', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'scrollDepth', eventType: 'scrollDepth', attributes: { scrollPercent: 75, pageSection: 'home' }}});
      }},
      { ms: 3000, name: 'Click Showroom CTA', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'clickTracking', eventType: 'clickTracking', attributes: { elementType: 'a', elementLabel: 'Explore the Showroom', pageSection: 'home' }}});
      }},
      { ms: 5000, name: 'Showroom view', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'pageView', eventType: 'userEngagement', attributes: { pageCategory: 'showroom' }}});
      }},
      { ms: 8000, name: 'View Spectre', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'View Catalog Object', eventType: 'catalog', catalogObject: { type: 'Vehicle', id: 'spectre', attributes: { name: 'Spectre' }}}});
      }},
      { ms: 12000, name: 'View Spectre Detail', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'View Catalog Object Detail', eventType: 'catalog', catalogObject: { type: 'Vehicle', id: 'spectre', attributes: { name: 'Spectre', category: 'modelDetail' }}}});
      }},
      { ms: 15000, name: 'Scroll Spectre page 100%', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'scrollDepth', eventType: 'scrollDepth', attributes: { scrollPercent: 100, pageSection: 'modelDetail', pageUrl: '/showroom/spectre-in-detail.html' }}});
      }},
      { ms: 18000, name: 'Click Commission CTA', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'clickTracking', eventType: 'clickTracking', attributes: { elementType: 'a', elementLabel: 'Commission Your Spectre', pageSection: 'modelDetail' }}});
      }},
      { ms: 20000, name: 'Configurator Start', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'commissionPageView', stepCategory: 'flow', modelName: 'Spectre', stepIndex: 0 }}});
      }},
      { ms: 23000, name: 'Select Exterior Color', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'exteriorColor', stepCategory: 'exterior', selectedValue: 'Midnight Sapphire Blue', modelId: 'RR25', modelName: 'Spectre', stepIndex: 1 }}});
      }},
      { ms: 27000, name: 'Select Interior', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'interiorTrim', stepCategory: 'interior', selectedValue: 'Navy Starlight', modelId: 'RR25', modelName: 'Spectre', stepIndex: 2 }}});
      }},
      { ms: 30000, name: 'Select Wheels', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'wheelSelection', stepCategory: 'exterior', selectedValue: '22 Inch Bespoke Alloy', modelId: 'RR25', modelName: 'Spectre', stepIndex: 3 }}});
      }},
      { ms: 33000, name: 'Select Trim', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'interiorTrim', stepCategory: 'interior', selectedValue: 'Piano Black Veneer', modelId: 'RR25', modelName: 'Spectre', stepIndex: 4 }}});
      }},
      { ms: 36000, name: 'Select Accessory', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'accessorySelection', stepCategory: 'accessories', selectedValue: 'Bespoke Picnic Table', modelId: 'RR25', modelName: 'Spectre', stepIndex: 5 }}});
      }},
      { ms: 40000, name: 'View Summary (dwell)', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'summaryView', stepCategory: 'flow', modelId: 'RR25', modelName: 'Spectre', stepIndex: 6 }}});
      }},
      { ms: 70000, name: 'Session End (abandon)', fn: function() {
        SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorSession', eventType: 'configuratorSession', attributes: { modelId: 'RR25', modelName: 'Spectre', totalSteps: 6, completedSteps: 6, abandoned: 'true' }}});
        console.log('[RR Demo] Session 1 complete (abandoned). Run window.runRRDemoReturn() for return visit.');
      }}
    ];

    steps.forEach(function(step) {
      setTimeout(function() {
        console.log('[RR Demo] ' + step.name);
        step.fn();
      }, step.ms);
    });
  };

  // Return visit demo (with identity)
  window.runRRDemoReturn = function(email) {
    email = email || 'victoria.harrington@rr-demo.example.com';
    console.log('[RR Demo] Starting return visit with identity: ' + email);

    setTimeout(function() {
      SalesforceInteractions.sendEvent({ interaction: { name: 'pageView', eventType: 'userEngagement', attributes: { pageCategory: 'configurator' }}});
    }, 0);

    setTimeout(function() {
      SalesforceInteractions.sendEvent({ interaction: { name: 'configuratorStep', eventType: 'configuratorStep', attributes: { stepName: 'reviewSavedConfig', stepCategory: 'flow', modelName: 'Spectre', stepIndex: 0 }}});
    }, 5000);

    setTimeout(function() {
      SalesforceInteractions.sendEvent({ interaction: { name: 'clickTracking', eventType: 'clickTracking', attributes: { elementType: 'a', elementLabel: 'Contact Rolls-Royce', pageSection: 'configurator' }}});
    }, 8000);

    setTimeout(function() {
      SalesforceInteractions.sendEvent({
        interaction: { name: 'formInteraction', eventType: 'formInteraction', attributes: { formName: 'contactForm', formAction: 'submit' }},
        user: { attributes: { eventType: 'contactPointEmail', email: email }}
      });
      console.log('[RR Demo] Identity captured: ' + email + '. Profile unification should now occur.');
    }, 12000);

    setTimeout(function() {
      SalesforceInteractions.sendEvent({
        user: { attributes: { eventType: 'partyIdentification', userId: email, idName: 'Email' }}
      });
      console.log('[RR Demo] Return visit complete. Check RTDG Visualizer for unified profile.');
    }, 13000);
  };

  // Auto-trigger demo if ?demo=true
  if (window.location.search.includes('demo=true')) {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(window.runRRDemo, 2000);
    });
  }
})();
