import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { initializeSettings } from './data/settings';
import { notifyTaskNodeCompleted, playTaskNodeReviewSound } from './lib/notifications';
import { LanguageProvider } from './providers/language-provider';
import { ThemeProvider } from './providers/theme-provider';

import '@/config/style/global.css';

initializeSettings()
  .catch(console.error)
  .finally(() => {
    window.api?.taskNode?.onCompleted?.((data) => {
      void notifyTaskNodeCompleted(data?.name);
    });
    window.api?.taskNode?.onReview?.(() => {
      void playTaskNodeReviewSound();
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
