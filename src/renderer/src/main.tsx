import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/router';
import { initializeSettings } from './shared/db/settings';
import { LanguageProvider } from './shared/providers/language-provider';
import { ThemeProvider } from './shared/providers/theme-provider';

import '@/config/style/global.css';

// Initialize settings from database on startup, then render app
initializeSettings()
  .catch(console.error)
  .finally(() => {
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
