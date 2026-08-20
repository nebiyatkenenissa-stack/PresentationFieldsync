import userEn from './userEn';
import userAm from './userAm';
import userTi from './userTi';
import userOm from './userOm';

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
  },
  ti: {
    name: 'Tigrinya',
    nativeName: 'ትግርኛ',
    translations: userTi
  },
  om: {
    name: 'Oromo',
    nativeName: 'Afaan Oromoo',
    translations: userOm
  }
};

export const defaultUserLanguage = 'en';