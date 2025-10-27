// Polyfill pour la compatibilité Chrome/Firefox
// Fonctionne comme browser-polyfill pour unifier les API

(function() {
  'use strict';

  // Déterminer le navigateur
  const browser = {
    runtime: null,
    storage: null,
    alarms: null,
    notifications: null,
    tabs: null
  };

  // Fonction d'initialisation
  function initBrowserAPI() {
    // Firefox
    if (typeof window.browser !== 'undefined') {
      browser.runtime = window.browser.runtime;
      browser.storage = window.browser.storage || {
        local: window.browser.storage.local || {
          get: (...args) => {
            return new Promise((resolve) => {
              const result = {};
              args[0].forEach(key => {
                try {
                  const value = localStorage.getItem(`extension_${key}`);
                  if (value !== null) {
                    result[key] = JSON.parse(value);
                  }
                } catch(e) {
                  result[key] = null;
                }
              });
              resolve(result);
            });
          },
          set: (values) => {
            return new Promise((resolve) => {
              Object.keys(values).forEach(key => {
                localStorage.setItem(`extension_${key}`, JSON.stringify(values[key]));
              });
              resolve();
            });
          }
        }
      };
      browser.alarms = window.browser.alarms || {
        create: (name, alarmInfo) => setTimeout(() => {
          if (alarmInfo && alarmInfo.periodInMinutes) {
            setInterval(() => {
              browser.runtime.onAlarm.dispatch();
            }, alarmInfo.periodInMinutes * 60000);
          }
          if (browser.runtime.onAlarm && browser.runtime.onAlarm.hasListeners) {
            browser.runtime.onAlarm.dispatch({
              name: name,
              scheduledTime: Date.now() + (alarmInfo.delayInMinutes * 60000)
            });
          }
        }, (alarmInfo && alarmInfo.delayInMinutes) ? alarmInfo.delayInMinutes * 60000 : 0)
      };
      browser.notifications = window.browser.notifications || {
        create: (options) => {
          if (typeof Notification !== 'undefined') {
            const notification = new Notification(options.title, {
              body: options.message,
              icon: options.iconUrl
            });
            return Promise.resolve(Math.random().toString());
          }
          return Promise.resolve(Math.random().toString());
        }
      };
      browser.tabs = window.browser.tabs || window.chrome.tabs;
    } 
    // Chrome/Edge
    else if (typeof window.chrome !== 'undefined') {
      browser.runtime = window.chrome.runtime;
      browser.storage = window.chrome.storage;
      browser.alarms = window.chrome.alarms;
      browser.notifications = window.chrome.notifications;
      browser.tabs = window.chrome.tabs;
    }
  }

  // Fonction helper pour uniformiser les API
  function getBrowserAPI() {
    if (typeof window.browser !== 'undefined') {
      return window.browser;
    } else if (typeof window.chrome !== 'undefined') {
      return window.chrome;
    } else {
      // Fallback minimal
      return {
        runtime: {
          onMessage: { addListener: () => {} },
          sendMessage: () => Promise.resolve(),
          onInstalled: { addListener: () => {} },
          onAlarm: { addListener: () => {} }
        },
        storage: {
          local: {
            get: () => Promise.resolve({}),
            set: () => Promise.resolve()
          }
        },
        tabs: {
          create: () => Promise.resolve({ id: 0 }),
          query: () => Promise.resolve([]),
          update: () => Promise.resolve()
        },
        notifications: {
          create: () => Promise.resolve()
        }
      };
    }
  }

  // Initialiser
  initBrowserAPI();

  // Exporter l'API uniformisée
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = getBrowserAPI;
  } else if (typeof window !== 'undefined') {
    window.getBrowserAPI = getBrowserAPI;
  }
})();

