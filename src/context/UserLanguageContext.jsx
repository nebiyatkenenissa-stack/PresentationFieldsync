import React, { createContext, useState, useContext, useEffect } from 'react';
import { userLanguages, defaultUserLanguage } from '../../translations/userIndex';

const UserLanguageContext = createContext();

export const UserLanguageProvider = ({ children }) => {
  const [currentUserLanguage, setCurrentUserLanguage] = useState(() => {
    const savedLang = localStorage.getItem('user-app-language');
    if (savedLang && userLanguages[savedLang]) {
      return savedLang;
    }
    return defaultUserLanguage;
  });

  useEffect(() => {
    localStorage.setItem('user-app-language', currentUserLanguage);
    document.documentElement.lang = currentUserLanguage;
  }, [currentUserLanguage]);

  const changeUserLanguage = (langCode) => {
    if (userLanguages[langCode]) {
      setCurrentUserLanguage(langCode);
    }
  };

  const userT = (key, params = {}) => {
    const keys = key.split('.');
    let translation = userLanguages[currentUserLanguage]?.translations;
    
    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        return key;
      }
    }
    
    if (typeof translation === 'string' && params) {
      Object.keys(params).forEach(param => {
        translation = translation.replace(new RegExp(`{${param}}`, 'g'), params[param]);
      });
    }
    
    return translation || key;
  };

  return (
    <UserLanguageContext.Provider value={{ 
      currentUserLanguage, 
      changeUserLanguage, 
      userT, 
      userLanguages 
    }}>
      {children}
    </UserLanguageContext.Provider>
  );
};

export const useUserLanguage = () => {
  const context = useContext(UserLanguageContext);
  if (!context) {
    throw new Error('useUserLanguage must be used within a UserLanguageProvider');
  }
  return context;
};