import userEn from './userEn';
import userAm from './userAm';

export const userLanguages = {
  en: {
    name: 'English',
    nativeName: 'English',
    translations: userEn
  },
  am: {
    name: 'Amharic',
    nativeName: 'አማርኛ',
    translations: userAm
  }
};

export const defaultUserLanguage = 'en';