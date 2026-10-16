import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserLanguage } from '../context/UserLanguageContext';
import { GlobeIcon } from './Icons';

function LanguageSelector() {
  const { i18n } = useTranslation();
  const { changeUserLanguage } = useUserLanguage();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'am', name: 'አማርኛ' },
    { code: 'ti', name: 'ትግርኛ' },
    { code: 'om', name: 'Afaan Oromoo' }
  ];

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    changeUserLanguage(langCode);
  };

  return (
    <div className="language-selector">
      <span className="language-icon"><GlobeIcon size={15} /></span>
      <select 
        value={['en', 'am', 'ti', 'om'].includes((i18n.resolvedLanguage || i18n.language || 'en').split('-')[0]) ? (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] : 'en'} 
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
      >
        {languages.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelector;