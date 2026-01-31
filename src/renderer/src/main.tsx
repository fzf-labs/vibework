import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { initializeSettings } from './data/settings';
import { notifyWorkNodeCompleted, playWorkNodeReviewSound } from './lib/notifications';
import { LanguageProvider } from './providers/language-provider';
import { ThemeProvider } from './providers/theme-provider';

import '@/config/style/global.css';

// Initialize settings from database on startup, then render app
initializeSettings()
  .catch(console.error)
  .finally(() => {
    window.api?.workNode?.onCompleted?.((data) => {
      void notifyWorkNodeCompleted(data?.name);
    });
    window.api?.workNode?.onReview?.(() => {
      void playWorkNodeReviewSound();
    });

    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <LanguageProvider>
          <ThemeProvider>
            <RouterProvider router={router} />
          </ThemeProvider>
        </LanguageProvider>
      </React.StrictMode>
    );
  });
