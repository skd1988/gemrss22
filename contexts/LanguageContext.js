/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { fa } from '../i18n/locales.js';
import { LANGUAGES } from '../types.js';
import { translateStrings } from '../services/translationService.js';
import { get } from 'lodash-es';

export const LanguageContext = createContext(undefined);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('fa');
  const [translations, setTranslations] = useState(fa);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetLanguage = useCallback(async (lang) => {
    // Avoid re-fetching if language is already set (unless it's a fallback to Farsi)
    if (lang === language && translations !== fa && lang !== 'fa') return;

    const langConfig = LANGUAGES.find(l => l.code === lang);
    if (!langConfig) return;
    
    // Helper function to apply all settings related to a language change
    const applyLanguageSettings = (targetLang, newTranslations) => {
        const config = LANGUAGES.find(l => l.code === targetLang);
        document.documentElement.lang = targetLang;
        document.documentElement.dir = config.dir;
        localStorage.setItem('app-language', targetLang);
        setLanguageState(targetLang);
        setTranslations(newTranslations);
    }

    // If target is Farsi, just apply it directly.
    if (lang === 'fa') {
      applyLanguageSettings('fa', fa);
      return;
    }

    // Check for cached translations first
    const cachedTranslations = localStorage.getItem(`translations-${lang}`);
    if (cachedTranslations) {
      try {
          applyLanguageSettings(lang, JSON.parse(cachedTranslations));
          return;
      } catch {
          // If cache is corrupted, remove it and proceed to fetch
          localStorage.removeItem(`translations-${lang}`);
      }
    }
    
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        console.error("Gemini API key not found for translation service. Falling back to Farsi.");
        alert("A Gemini API key is required for translations. Please set it in the settings. Falling back to Farsi.");
        applyLanguageSettings('fa', fa);
        return;
    }

    setIsLoading(true);
    try {
      const fetchedTranslations = await translateStrings(apiKey, lang);
      applyLanguageSettings(lang, fetchedTranslations);
      localStorage.setItem(`translations-${lang}`, JSON.stringify(fetchedTranslations));
    } catch (error) {
      console.error(`Failed to fetch translations for ${lang}:`, error);
      alert(`Failed to fetch translations for ${langConfig.name}. Falling back to Farsi.`);
      applyLanguageSettings('fa', fa);
    } finally {
      setIsLoading(false);
    }
  }, [language, translations]);

  useEffect(() => {
    const savedLang = localStorage.getItem('app-language');
    if (savedLang && LANGUAGES.some(l => l.code === savedLang)) {
      handleSetLanguage(savedLang);
    } else {
      handleSetLanguage('fa');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount
  
  const t = useCallback((key, replacements = {}) => {
    let translation = get(translations, key, key);
    if (typeof translation !== 'string') {
        console.warn(`Translation key '${key}' not found or not a string.`);
        return key;
    }
    Object.keys(replacements).forEach(placeholder => {
      translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    return translation;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, translations, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};