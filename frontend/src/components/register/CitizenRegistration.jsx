// components/register/CitizenRegistration.js – FULLY VALIDATED (18+, grandfather name required, duplicate check on first+last+grandfather)

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, syncQueue, checkRealInternet, getApiBase, clearStuckCitizens } from '../../services/database';
import { uid, generateNationalId } from '../../utils/helpers';
import LocationCascade from '../common/LocationCascade';
import GpsCapture from '../common/GpsCapture';
import { getCurrentGps } from '../../utils/gps';

const API_BASE = getApiBase();

// ===== LANGUAGE TRANSLATIONS (added duplicate errors for name & email) =====
const translations = {
  en: {
    title: '🆔 Register Citizen for National ID',
    subtitle: 'Enter citizen information for National ID registration',
    offlineReady: 'Offline Ready',
    firstName: 'First Name *',
    firstNamePlaceholder: 'Enter first name',
    firstNameError: 'First name must contain only letters and spaces',
    lastName: 'Last Name *',
    lastNamePlaceholder: 'Enter last name',
    lastNameError: 'Last name must contain only letters and spaces',
    grandFatherName: 'Grandfather Name *',
    grandFatherNamePlaceholder: 'Enter grandfather name',
    grandFatherNameError: 'Grandfather name must contain only letters and spaces',
    grandfatherNameRequired: 'Grandfather name is required',
    dateOfBirth: 'Date of Birth *',
    dateOfBirthError: 'Please enter a valid date of birth (must be in the past)',
    ageError: 'Citizen must be 18 years or older',
    gender: 'Gender *',
    selectGender: 'Select Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    phone: 'Phone Number *',
    phonePlaceholder: '+2519XXXXXXXX or 09XXXXXXXX',
    phoneError: 'Phone must start with +2519 or 09 followed by 8 digits (e.g., +251912345678)',
    email: 'Email',
    emailPlaceholder: 'Enter email address',
    emailError: 'Please enter a valid email address',
    duplicateEmail: 'This email is already registered',
    region: 'Region *',
    selectRegion: 'Select Region',
    north: 'North',
    south: 'South',
    east: 'East',
    west: 'West',
    central: 'Central',
    district: 'District',
    districtPlaceholder: 'Enter district',
    village: 'Village',
    villagePlaceholder: 'Enter village',
    address: 'Address',
    addressPlaceholder: 'Enter full address',
    occupation: 'Occupation',
    occupationPlaceholder: 'Enter occupation',
    maritalStatus: 'Marital Status',
    selectStatus: 'Select Status',
    single: 'Single',
    married: 'Married',
    divorced: 'Divorced',
    widowed: 'Widowed',
    biometrics: 'Biometrics Collected',
    yes: 'Yes',
    no: 'No',
    systemAssignId: 'System will assign National ID automatically',
    register: 'Register Citizen',
    saveOffline: 'Save Offline',
    processing: 'Processing...',
    clear: 'Clear Form',
    clearConfirm: 'Are you sure you want to clear all fields?',
    success: 'Citizen registered successfully!',
    successId: 'National ID: ',
    offlineSuccess: 'Citizen saved offline! Will sync when online.',
    error: 'Error registering citizen: ',
    online: 'Online',
    offline: 'Offline',
    pendingSync: 'pending sync',
    offlineMode: 'Offline Mode:',
    offlineMessage: 'Citizens will be saved locally and synced automatically when online.',
    fixErrors: 'Please fix the validation errors before submitting.',
    duplicateName: 'A citizen with this name and grandfather name already exists',
    grandfatherRequired: 'Grandfather name is required because a citizen with this first and last name already exists',
    duplicatePhone: 'This phone number is already registered',
    clearStuck: 'Clear stuck',
    clearStuckConfirm: 'Remove stuck pending citizens? Records saved 7+ days ago, failed to sync, or stuck mid-sync will be deleted from this device.',
    clearStuckDone: 'Removed stuck data',
    clearStuckRecords: 'records',
    clearStuckQueue: 'queue items',
    clearStuckNone: 'No stuck citizens found',
    photo: 'Photo',
    photoPlaceholder: 'Upload citizen photo'
  },
  am: {
    title: '🆔 ለብሔራዊ መታወቂያ ዜጋ ይመዝገቡ',
    subtitle: 'ለብሔራዊ መታወቂያ ምዝገባ የዜጋ መረጃ ያስገቡ',
    offlineReady: 'ከመስመር ውጭ ዝጁ',
    firstName: 'ስም *',
    firstNamePlaceholder: 'ስም ያስገቡ',
    firstNameError: 'ስም ፊደላት እና ክፍተቶችን ብቻ መያዝ አለበት',
    lastName: 'የአባት ስም *',
    lastNamePlaceholder: 'የአባት ስም ያስገቡ',
    lastNameError: 'የአባት ስም ፊደላት እና ክፍተቶችን ብቻ መያዝ አለበት',
    grandFatherName: 'የአያት ስም *',
    grandFatherNamePlaceholder: 'የአያት ስም ያስገቡ',
    grandFatherNameError: 'የአያት ስም ፊደላት እና ክፍተቶችን ብቻ መያዝ አለበት',
    grandfatherNameRequired: 'የአያት ስም ያስገቡ',
    dateOfBirth: 'የትውልድ ቀን *',
    dateOfBirthError: 'እባክዎ ትክክለኛ የትውልድ ቀን ያስገቡ (ያለፈ ጊዜ መሆን አለበት)',
    ageError: 'ዜጋ ከ18 ዓመት በላይ መሆን አለበት',
    gender: 'ጾታ *',
    selectGender: 'ጾታ ይምረጡ',
    male: 'ወንድ',
    female: 'ሴት',
    other: 'ሌላ',
    phone: 'ስልክ ቁጥር *',
    phonePlaceholder: '+2519XXXXXXXX',
    phoneError: 'ስልክ ቁጥር በ+2519 መጀመር እና 8 አሃዞች መከተል አለበት (ለምሳሌ፡ +251912345678)',
    email: 'ኢሜይል',
    emailPlaceholder: 'ኢሜይል አድራሻ ያስገቡ',
    emailError: 'እባክዎ ትክክለኛ የኢሜይል አድራሻ ያስገቡ',
    duplicateEmail: 'ይህ ኢሜይል ቀድሞ ተመዝግቧል',
    region: 'ክልል *',
    selectRegion: 'ክልል ይምረጡ',
    north: 'ሰሜን',
    south: 'ደቡብ',
    east: 'ምስራቅ',
    west: 'ምዕራብ',
    central: 'ማዕከላዊ',
    district: 'ወረዳ',
    districtPlaceholder: 'ወረዳ ያስገቡ',
    village: 'ቀበሌ',
    villagePlaceholder: 'ቀበሌ ያስገቡ',
    address: 'አድራሻ',
    addressPlaceholder: 'ሙሉ አድራሻ ያስገቡ',
    occupation: 'ሙያ',
    occupationPlaceholder: 'ሙያ ያስገቡ',
    maritalStatus: 'የጋብቻ ሁኔታ',
    selectStatus: 'ሁኔታ ይምረጡ',
    single: 'ያላገባ',
    married: 'ያገባ',
    divorced: 'የተፋታ',
    widowed: 'መበለት',
    biometrics: 'ባዮሜትሪክስ የተሰበሰበ',
    yes: 'አዎ',
    no: 'አይ',
    systemAssignId: 'ስርዓቱ ብሔራዊ መታወቂያ በራስ-ሰር ይመድባል',
    register: 'ዜጋ ይመዝገቡ',
    saveOffline: 'ከመስመር ውጭ አስቀምጥ',
    processing: 'በሂደት ላይ...',
    clear: 'ቅጹን አጽዳ',
    clearConfirm: 'ሁሉንም መስኮች ማጽዳት እንደሚፍለጉ እርግጠኛ ነዎት?',
    success: 'ዜጋ በተሳካ ሁኔታ ተመዝግቧል!',
    successId: 'ብሔራዊ መታወቂያ፡ ',
    offlineSuccess: 'ዜጋ ከመስመር ውጭ ተቀምጧል! በመስመር ላይ ሲሆን በራስ-ሰር ይመሳሰላል።',
    error: 'ዜጋን በመመዝገብ ላይ ስህተት፡ ',
    online: 'በመስመር ላይ',
    offline: 'ከመስመር ውጭ',
    pendingSync: 'በመጠበቅ ላይ',
    offlineMode: 'ከመስመር ውጭ ሁነታ፡',
    offlineMessage: 'ዜጎች በአካባቢው ይቀመጣሉ እና በመስመር ላይ ሲሆኑ በራስ-ሰር ይመሳሰላሉ።',
    fixErrors: 'ከማስገባትዎ በፊት የማረጋገጫ ስህተቶችን ያስተካክሉ።',
    duplicateName: 'በዚህ ስም እና የአያት ስም የተመዘገበ ዜጋ አለ',
    grandfatherRequired: 'የአያት ስም ያስገቡ ምክንያቱም በዚህ ስም እና የአባት ስም ዜጋ ቀድሞ ተመዝግቧል',
    duplicatePhone: 'ይህ ስልክ ቁጥር ቀድሞ ተመዝግቧል',
    clearStuck: 'ተጣብቀው የቆዩትን አጽዳ',
    clearStuckConfirm: 'የተጣበቁ ዜጎችን ማስወገድ ይፈልጋሉ? ከ7 ቀናት በላይ የቆዩ፣ ያልተመሳሰሉ ወይም በሂደት ላይ ተጣብቀው የቆዩ መዝገቦች ከዚህ መሳሪያ ይደመሰሳሉ።',
    clearStuckDone: 'የተጣበቁ መረጃዎች ተወግደዋል',
    clearStuckRecords: 'መዝገቦች',
    clearStuckQueue: 'የወረፋ እቃዎች',
    clearStuckNone: 'ምንም የተጣበቁ ዜጎች አልተገኙም',
    photo: 'ፎቶ',
    photoPlaceholder: 'የዜጋ ፎቶ ይጫኑ'
  },
  om: {
    title: '🆔 Firoota Magaalaa Sabaa Qabaachuuf Galmeessaa',
    subtitle: 'Odeeffannoo Firoota galmeessuu Magaalaa Sabaa qabaachuuf',
    offlineReady: 'Offline Qopheessa',
    firstName: 'Maqaa Dura *',
    firstNamePlaceholder: 'Maqaa dura galchi',
    firstNameError: 'Maqaan qubee fi bakka duwwaa qofa qabaachuu qaba',
    lastName: 'Maqaa Abbootii *',
    lastNamePlaceholder: 'Maqaa Abbootii galchi',
    lastNameError: 'Maqaan Abbootii qubee fi bakka duwwaa qofa qabaachuu qaba',
    grandFatherName: 'Maqaa Angafootii *',
    grandFatherNamePlaceholder: 'Maqaa angafootii galchi',
    grandFatherNameError: 'Maqaan angafootii qubee fi bakka duwwaa qofa qabaachuu qaba',
    grandfatherNameRequired: 'Maqaan angafootii barbaachisaadha',
    dateOfBirth: 'Guyyaa Dhalootaa *',
    dateOfBirthError: 'Guyyaa dhalootaa sirrii galchi (guyyaa darbe ta\'uu qaba)',
    ageError: 'Firoon waggaa 18 fi olii ta\'uu qaba',
    gender: 'Saala *',
    selectGender: 'Saala fili',
    male: 'Dhiira',
    female: 'Dubartii',
    other: 'Kan Biroo',
    phone: 'Lakkoobsa Bilbilaa *',
    phonePlaceholder: '+2519XXXXXXXX',
    phoneError: 'Lakkoobsi bilbilaa +2519 jalqabee 8 lakkoobsa qabaachuu qaba (fakkeenya: +251912345678)',
    email: 'Email',
    emailPlaceholder: 'Teessoo email galchi',
    emailError: 'Teessoo email sirrii galchi',
    duplicateEmail: 'Email kun dura galmeeffame',
    region: 'Naannoo *',
    selectRegion: 'Naannoo fili',
    north: 'Kaaba',
    south: 'Kibba',
    east: 'Baha',
    west: 'Lixa',
    central: 'Gidduu',
    district: 'Aanaa',
    districtPlaceholder: 'Aanaa galchi',
    village: 'Ganda',
    villagePlaceholder: 'Ganda galchi',
    address: 'Teessoo',
    addressPlaceholder: 'Teessoo guutuu galchi',
    occupation: 'Hojii',
    occupationPlaceholder: 'Hojii galchi',
    maritalStatus: 'Haala Fuudhaa',
    selectStatus: 'Haala fili',
    single: 'Kan Hin Fuunne/Hin Heerumne',
    married: 'Kan Fuudhe/Heerume',
    divorced: 'Kan Hiiku',
    widowed: 'Kan Hiyyeesee',
    biometrics: 'Biometrics Walitti Qabame',
    yes: 'Eeyyee',
    no: 'Lakkii',
    systemAssignId: 'Sistimiin Magaalaa Sabaa Godina',
    register: 'Firoota Galmeessi',
    saveOffline: 'Offline Qusadhu',
    processing: 'Hojii Irratti...',
    clear: 'Forma Qulqulleessi',
    clearConfirm: 'Dirree hunda qulqulleessuu barbaadda?',
    success: 'Firoota milkaa\'iin galmeessame!',
    successId: 'Magaalaa Sabaa: ',
    offlineSuccess: 'Firoota offline qusatame! Yeroo online ta\'u ofiifuu wal qabsiifama.',
    error: 'Dogoggora galmeessuu firoota: ',
    online: 'Online',
    offline: 'Offline',
    pendingSync: 'eegachaa jira',
    offlineMode: 'Haala Offline:',
    offlineMessage: 'Firoonni naannoo keessatti qusatamanii yeroo online ta\'an ofiifuu wal qabsiifamu.',
    fixErrors: 'Galmeessuu dura dogoggora mirkaneessaa sirreessi.',
    duplicateName: 'Firoon maqaa kanaa fi maqaa angafootii kanaan dura galmeeffame',
    grandfatherRequired: 'Maqaan angafootii barbaachisaadha sababni isaas firoon maqaa duraa fi abbootii kanaan dura galmeeffameera',
    duplicatePhone: 'Lakkoobsi bilbilaa kun dura galmeeffame',
    clearStuck: 'Kan hirkate qulqulleessi',
    clearStuckConfirm: 'Firoota kan hirkatan balleessuu barbaaddaa? Galmee guyyaa 7 olii kan turee, wal qabsiifamuu bahee ykn hojii gidduutti hirkate kun meeshaa kana irraa balleeffama.',
    clearStuckDone: 'Odeeffannoon hirkate balleeffame',
    clearStuckRecords: 'galmee',
    clearStuckQueue: 'wantoota queue',
    clearStuckNone: 'Firoon hirkate hin argamne',
    photo: 'Fakkii',
    photoPlaceholder: 'Fakkii firoota olkaa\'i'
  },
  ti: {
    title: '🆔 ንብሔራዊ መታወቂያ ዜጋ ተመዝገብ',
    subtitle: 'ንብሔራዊ መታወቂያ ምዝገባ ሓበሬታ ዜጋ አእትዉ',
    offlineReady: 'ብልዕ መስመር ተዳሉ',
    firstName: 'ስም *',
    firstNamePlaceholder: 'ስም አእትዉ',
    firstNameError: 'ስም ፊደላትን ክፍተትን ጥራይ ክህዝ ኣለዎ',
    lastName: 'ስም ኣቦ *',
    lastNamePlaceholder: 'ስም ኣቦ አእትዉ',
    lastNameError: 'ስም ኣቦ ፊደላትን ክፍተትን ጥራይ ክህዝ ኣለዎ',
    grandFatherName: 'ስም ሓወልት *',
    grandFatherNamePlaceholder: 'ስም ሓወልት አእትዉ',
    grandFatherNameError: 'ስም ሓወልት ፊደላትን ክፍተትን ጥራይ ክህዝ ኣለዎ',
    grandfatherNameRequired: 'ስም ሓወልት አእትዉ',
    dateOfBirth: 'ዕለት ትውልድ *',
    dateOfBirthError: 'ቅኑዕ ዕለት ትውልድ አእትዉ (ናይ ሓሊፉ ግዜ ክኸዉን ኣለዎ)',
    ageError: 'ዜጋ 18 ዓመት ወይ ንላዕሊ ክኸዉን ኣለዎ',
    gender: 'ጾታ *',
    selectGender: 'ጾታ ምረጹ',
    male: 'ተባዕታይ',
    female: 'ኣንስተይቲ',
    other: 'ካልእ',
    phone: 'ቁጽሪ ተሌፎን *',
    phonePlaceholder: '+2519XXXXXXXX',
    phoneError: 'ቁጽሪ ተሌፎን ብ+2519 ክጅምርን 8 ቁጽሪታት ክስዕብን ኣለዎ (ኣብነት፡ +251912345678)',
    email: 'ኢመይል',
    emailPlaceholder: 'አድራሻ ኢመይል አእትዉ',
    emailError: 'ቅኑዕ አድራሻ ኢመይል አእትዉ',
    duplicateEmail: 'እዚ ኢመይል ቀደም ተመዝጊቡ',
    region: 'ክልል *',
    selectRegion: 'ክልል ምረጹ',
    north: 'ሰሜን',
    south: 'ደቡብ',
    east: 'ምብራቕ',
    west: 'ምዕራብ',
    central: 'ማእከላይ',
    district: 'ወረዳ',
    districtPlaceholder: 'ወረዳ አእትዉ',
    village: 'ታቦ',
    villagePlaceholder: 'ታቦ አእትዉ',
    address: 'አድራሻ',
    addressPlaceholder: 'ምሉእ አድራሻ አእትዉ',
    occupation: 'ሞያ',
    occupationPlaceholder: 'ሞያ አእትዉ',
    maritalStatus: 'ኩነት ሓዳር',
    selectStatus: 'ኩነት ምረጹ',
    single: 'ካልተዳወለ',
    married: 'ተዳዊሉ',
    divorced: 'ተፈንጺሉ',
    widowed: 'መበለት',
    biometrics: 'ባዮሜትሪክስ ተሰብሲቡ',
    yes: 'እወ',
    no: 'አይኮን',
    systemAssignId: 'ስርዓት ብሔራዊ መታወቂያ ይምድብ',
    register: 'ዜጋ ተመዝገብ',
    saveOffline: 'ብልዕ መስመር ኣቐምጥ',
    processing: 'ኣብ ስራሕ ኣሎ...',
    clear: 'ቅጽ አጽርሕ',
    clearConfirm: 'ኩሉ መዳያት ምጽራሕ ደልየካ ኢኻ?',
    success: 'ዜጋ ብዕለት ተመዝጊቡ!',
    successId: 'ብሔራዊ መታወቂያ: ',
    offlineSuccess: 'ዜጋ ብልዕ መስመር ተቀሚጹ! መስመር ምስ ተመልሰ ብራሱ ይመሳሰል።',
    error: 'ኣብ ምዝገባ ዜጋ ጌጋ: ',
    online: 'ብመስመር',
    offline: 'ብልዕ መስመር',
    pendingSync: 'ብምጽባይ ኣሎ',
    offlineMode: 'ብልዕ መስመር ሁነታ:',
    offlineMessage: 'ዜጋታት ብአካባቢ ይቅመጡ እዮም እሞ መስመር ምስ ተመልሰ ብራሱ ይመሳሰሉ።',
    fixErrors: 'ቅድሚ ምስዳእኩም ጌጋታት ምዝገባ ኣርምዑ።',
    duplicateName: 'ዜጋ በዚ ስምን ስም ሓወልት ቀደም ተመዝጊቡ',
    grandfatherRequired: 'ስም ሓወልት አእትዉ ምኽንያቱ ዜጋ በዚ ስምን ስም ኣቦ ቀደም ተመዝጊቡ',
    duplicatePhone: 'እዚ ቁጽሪ ተሌፎን ቀደም ተመዝጊቡ',
    clearStuck: 'ዝተዓቅሙ ኣጽሪሕ',
    clearStuckConfirm: 'ዝተዓቅሙ ዜጋታት ከተኵሙ? ን7 መዓልትታት ብዝያደገ ተዓቂሩ ዝረኸበ፣ ዘይተመሳሰለ ወይ ኣብ ስራሕ ዝተዓቕመ ምዝገባ ካብዚ መሳርሒ ክድምሰስ እዩ።',
    clearStuckDone: 'ዝተዓቀመ ሓበሬታ ተወጊዱ',
    clearStuckRecords: 'ምዝገባታት',
    clearStuckQueue: 'ናይ ወረፋ ኣቕሑ',
    clearStuckNone: 'ዝተዓቕሙ ዜጋታት ኣይተረኸቡን',
    photo: 'ስእሊ',
    photoPlaceholder: 'ስእሊ ዜጋ ጽዓኑ'
  }
};

const seedLocationFromUser = (user) => {
  if (!user) return {};
  const map = {
    country: user.country_id,
    region: user.region_id,
    zone: user.zone_id,
    woreda: user.woreda_id,
    kebele: user.kebele_id,
    community: user.community_id
  };
  const out = {};
  Object.keys(map).forEach((level) => {
    if (map[level]) out[level] = { id: Number(map[level]), name: null };
  });
  return out;
};

const toSupportedLang = (lng) => {
  const lang = (lng || 'en').split('-')[0];
  return ['am', 'ti', 'om'].includes(lang) ? lang : 'en';
};

function CitizenRegistration({ user, citizens, setCitizens, addNotification }) {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(() => toSupportedLang(i18n.resolvedLanguage || i18n.language));
  const [location, setLocation] = useState(() => seedLocationFromUser(user));
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    grandfatherName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    region: user?.region || '',
    district: '',
    village: '',
    occupation: '',
    maritalStatus: '',
    photo: ''
  });
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    region: ''
  });
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [gps, setGps] = useState(null);
  const [stuckInfo, setStuckInfo] = useState(null);

  // Get translations
  const t = translations[language] || translations.en;

  // Language options
  const languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'am', label: '🇪🇹 አማርኛ' },
    { code: 'ti', label: '🇪🇹 ትግርኛ' },
    { code: 'om', label: '🇪🇹 Afaan Oromoo' }
  ];

  // Keep this page's language in sync with the app-wide toggle
  useEffect(() => {
    const syncLang = (lng) => setLanguage(toSupportedLang(lng));
    syncLang(i18n.resolvedLanguage || i18n.language);
    i18n.on('languageChanged', syncLang);
    return () => { i18n.off('languageChanged', syncLang); };
  }, [i18n]);

  // ============================================================
  // VALIDATION FUNCTIONS
  // ============================================================
  const validateName = (value) => {
    if (!value.trim()) return 'This field is required';
    if (!/^[a-zA-Z\s\-']+$/.test(value)) return t.firstNameError || 'Must contain only letters and spaces';
    return '';
  };

  const validateDateOfBirth = (value) => {
    if (!value) return 'Date of birth is required';
    const birthDate = new Date(value);
    const today = new Date();
    if (birthDate > today) return t.dateOfBirthError || 'Date of birth cannot be in the future';

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      return t.ageError || 'Citizen must be 18 years or older';
    }
    return '';
  };

  const validatePhone = (value) => {
    if (!value.trim()) return 'Phone number is required';
    if (!/^(\+251|0)9\d{8}$/.test(value.trim())) {
      return t.phoneError || 'Phone must start with +2519 or 09 followed by 8 digits (e.g., +251912345678)';
    }
    return '';
  };

  const validateEmail = (value) => {
    if (!value.trim()) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return t.emailError || 'Please enter a valid email address';
    }
    return '';
  };

  const validateGender = (value) => {
    if (!value) return 'Gender is required';
    return '';
  };

  const validateRegion = (value) => {
    if (!value) return 'Region is required';
    return '';
  };

  // ============================================================
  // DUPLICATE CHECKS (name, email, phone & ID number)
  // ============================================================
  const checkDuplicates = () => {
    const dupErrors = {};
    const existing = citizens || [];

    // Check duplicate name — same first + last is allowed, but the grandfather
    // name must be different to tell the two citizens apart.
    const firstName = form.firstName.trim().toLowerCase();
    const lastName = form.lastName.trim().toLowerCase();
    const grandfatherName = form.grandfatherName.trim().toLowerCase();

    if (firstName && lastName) {
      const sameFamily = existing.filter(c =>
        c.firstName && c.lastName &&
        c.firstName.trim().toLowerCase() === firstName &&
        c.lastName.trim().toLowerCase() === lastName
      );

      if (sameFamily.length > 0) {
        // A citizen with the same first + last name already exists — require a
        // different grandfather name so they can be distinguished.
        if (!form.grandfatherName.trim()) {
          dupErrors.grandfatherName = t.grandfatherRequired || 'Grandfather name is required because a citizen with this name already exists';
        } else {
          const exact = sameFamily.some(c =>
            c.grandfatherName &&
            c.grandfatherName.trim().toLowerCase() === grandfatherName
          );
          if (exact) {
            dupErrors.firstName = t.duplicateName || 'A citizen with this name (including grandfather name) already exists';
          }
        }
      }
    }

    // Check duplicate email (if provided)
    if (form.email.trim()) {
      const emailExists = existing.some(c => c.email && c.email.toLowerCase() === form.email.trim().toLowerCase());
      if (emailExists) {
        dupErrors.email = t.duplicateEmail || 'This email is already registered';
      }
    }

    // Check duplicate phone
    if (form.phone.trim()) {
      const phoneExists = existing.some(c => c.phone && c.phone.replace(/\D/g, '') === form.phone.replace(/\D/g, ''));
      if (phoneExists) {
        dupErrors.phone = t.duplicatePhone || 'This phone number is already registered';
      }
    }

    return dupErrors;
  };

  // ============================================================
  // VALIDATE ALL FIELDS (including duplicates)
  // ============================================================
  const validateAll = () => {
    const newErrors = {
      firstName: validateName(form.firstName),
      lastName: validateName(form.lastName),
      grandfatherName: form.grandfatherName.trim() ? validateName(form.grandfatherName) : (t.grandfatherNameRequired || 'Grandfather name is required'),
      dateOfBirth: validateDateOfBirth(form.dateOfBirth),
      gender: validateGender(form.gender),
      phone: validatePhone(form.phone),
      email: validateEmail(form.email),
      region: validateRegion(location.region?.id ? location.region.name || location.region.id : form.region)
    };
    // Override with duplicate errors if any
    const dupErrors = checkDuplicates();
    if (dupErrors.firstName) newErrors.firstName = dupErrors.firstName;
    if (dupErrors.grandfatherName) newErrors.grandfatherName = dupErrors.grandfatherName;
    if (dupErrors.email) newErrors.email = dupErrors.email;
    if (dupErrors.phone) newErrors.phone = dupErrors.phone;

    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  };

  // ============================================================
  // HANDLE FIELD CHANGES (real-time)
  // ============================================================
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: newValue }));
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate only format, not duplicates (duplicates checked on blur or submit)
    let error = '';
    switch (name) {
      case 'firstName':
      case 'lastName':
        error = validateName(newValue);
        break;
      case 'grandfatherName':
        error = newValue.trim() ? validateName(newValue) : (t.grandfatherNameRequired || 'Grandfather name is required');
        break;
      case 'dateOfBirth':
        error = validateDateOfBirth(newValue);
        break;
      case 'gender':
        error = validateGender(newValue);
        break;
      case 'phone':
        error = validatePhone(newValue);
        break;
      case 'email':
        error = validateEmail(newValue);
        break;
      case 'region':
        error = validateRegion(newValue);
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    // Clear duplicate errors for fields that are being changed
    if (name === 'firstName' || name === 'lastName' || name === 'email') {
      // We'll recalc duplicates on blur and submit; just clear previous duplicate if any to allow typing
      // But we don't want to clear if the user hasn't fixed the duplicate yet
      // We can just re-run duplicate check on blur; for now keep as is.
    }
  };

  // ============================================================
  // HANDLE BLUR – trigger duplicate check
  // ============================================================
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate format first
    let error = '';
    switch (name) {
      case 'firstName':
      case 'lastName':
        error = validateName(form[name]);
        break;
      case 'grandfatherName':
        error = form[name]?.trim() ? validateName(form[name]) : (t.grandfatherNameRequired || 'Grandfather name is required');
        break;
      case 'dateOfBirth':
        error = validateDateOfBirth(form[name]);
        break;
      case 'gender':
        error = validateGender(form[name]);
        break;
      case 'phone':
        error = validatePhone(form[name]);
        break;
      case 'email':
        error = validateEmail(form[name]);
        break;
      case 'region':
        error = validateRegion(form[name]);
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));

    // If it's a name, email, phone or ID field, also check duplicates
    if (name === 'firstName' || name === 'lastName' || name === 'grandfatherName' || name === 'email' || name === 'phone') {
      const dupErrors = checkDuplicates();
      if (dupErrors.firstName) {
        setErrors(prev => ({ ...prev, firstName: dupErrors.firstName }));
      }
      if (dupErrors.grandfatherName) {
        setErrors(prev => ({ ...prev, grandfatherName: dupErrors.grandfatherName }));
      }
      if (dupErrors.email) {
        setErrors(prev => ({ ...prev, email: dupErrors.email }));
      }
      if (dupErrors.phone) {
        setErrors(prev => ({ ...prev, phone: dupErrors.phone }));
      }
    }
  };

  // ============================================================
  // PHOTO UPLOAD (downscaled base64 data URL)
  // ============================================================
  const resizeImage = (file, maxSize, cb) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => cb(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be smaller than 5MB');
      return;
    }
    resizeImage(file, 400, (dataUrl) => {
      setForm(prev => ({ ...prev, photo: dataUrl }));
    });
  };

  // ============================================================
  // CHECK ONLINE STATUS (unchanged)
  // ============================================================
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      setPendingCount(syncQueue.count());
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);

    const handleQueueUpdate = () => {
      setPendingCount(syncQueue.count());
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-complete', handleQueueUpdate);

    // Clean up permanently stuck citizens (mid-sync, overdue, too many
    // failures, or orphaned) once on page load so they stop cluttering the
    // officer's registration screen.
    clearStuckCitizens().then(() => setPendingCount(syncQueue.count()));

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

  // ============================================================
  // CLEAR STUCK CITIZENS (manual button)
  // ============================================================
  const handleClearStuck = async () => {
    if (!window.confirm(t.clearStuckConfirm)) return;
    try {
      const result = await clearStuckCitizens();
      setPendingCount(syncQueue.count());
      if (result.queue + result.store > 0) {
        setStuckInfo({
          type: 'success',
          text: `${t.clearStuckDone}: ${result.store} ${t.clearStuckRecords}, ${result.queue} ${t.clearStuckQueue}`
        });
      } else {
        setStuckInfo({ type: 'info', text: t.clearStuckNone });
      }
    } catch (err) {
      setStuckInfo({ type: 'error', text: t.error + err.message });
    }
  };

  // ============================================================
  // SUBMIT HANDLER
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields (including duplicates)
    const isValid = validateAll();
    if (!isValid) {
      // Build error list for alert
      const errorMessages = Object.entries(errors)
        .filter(([_, msg]) => msg)
        .map(([field, msg]) => {
          const fieldNames = {
            firstName: 'First Name',
            lastName: 'Last Name',
            grandfatherName: 'Grandfather Name',
            dateOfBirth: 'Date of Birth',
            gender: 'Gender',
            phone: 'Phone',
            email: 'Email',
            region: 'Region'
          };
          return `• ${fieldNames[field] || field}: ${msg}`;
        })
        .join('\n');
      alert(`${t.fixErrors}\n\n${errorMessages}`);
      return;
    }

    // Officers can only work within their assigned area (community too when assigned)
    if (user?.role === 'field_officer') {
      const assigned = {
        country: user.country_id,
        region: user.region_id,
        zone: user.zone_id,
        woreda: user.woreda_id,
        kebele: user.kebele_id,
        community: user.community_id
      };
      const mismatchLevels = [];
      Object.keys(assigned).forEach((level) => {
        const expected = assigned[level] != null ? Number(assigned[level]) : null;
        const selected = location[level]?.id;
        if (expected !== null && selected !== undefined && selected !== null && Number(selected) !== expected) {
          mismatchLevels.push(level.charAt(0).toUpperCase() + level.slice(1));
        }
      });
      if (mismatchLevels.length > 0) {
        alert(`❌ You can only work in your assigned area. ${mismatchLevels.join(', ')} cannot be changed.`);
        return;
      }
    }

    setIsSubmitting(true);
    setShowSuccess(false);

    try {
      const online = await checkRealInternet();
      setIsOnline(online);

      let gpsData = gps;
      if (!gpsData) {
        gpsData = await getCurrentGps(6000);
      }

      const nationalId = generateNationalId();

      const newCitizen = {
        id: uid(),
        nationalId: nationalId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        grandfatherName: form.grandfatherName.trim() || '',
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        email: form.email.trim() || '',
        address: form.address.trim() || '',
        region: location.region?.name || form.region || '',
        district: location.zone?.name || location.woreda?.name || '',
        village: location.kebele?.name || location.community?.name || '',
        country_id: location.country?.id === 'OTHER' ? null : (location.country?.id || null),
        region_id: location.region?.id === 'OTHER' ? null : (location.region?.id || null),
        zone_id: location.zone?.id === 'OTHER' ? null : (location.zone?.id || null),
        woreda_id: location.woreda?.id === 'OTHER' ? null : (location.woreda?.id || null),
        kebele_id: location.kebele?.id === 'OTHER' ? null : (location.kebele?.id || null),
        community_id: location.community?.id === 'OTHER' ? null : (location.community?.id || null),
        location_path: ['country', 'region', 'zone', 'woreda', 'kebele', 'community']
          .filter(lvl => location[lvl])
          .map(lvl => ({ level: lvl, id: location[lvl].id, name: location[lvl].name || null })),
        occupation: form.occupation.trim() || '',
        maritalStatus: form.maritalStatus || '',
        idType: 'National ID',
        photo: form.photo || '',
        registrationDate: new Date().toISOString(),
        registeredBy: user?.employeeId || 'unknown',
        registeredByName: user?.name || 'Unknown',
        latitude: gpsData?.success ? gpsData.latitude : null,
        longitude: gpsData?.success ? gpsData.longitude : null,
        gpsAccuracy: gpsData?.success ? gpsData.accuracy : null,
        gpsCapturedAt: gpsData?.success ? gpsData.timestamp : null,
        status: 'active',
        createdAt: new Date().toISOString(),
        synced: false,
        offlineSaved: !online
      };

      // 1) Save to IndexedDB
      await db.citizens.add(newCitizen);
      if (setCitizens) {
        setCitizens(prev => [newCitizen, ...prev]);
      }

      // 2) Sync to PostgreSQL if online
      let syncSuccess = false;
      if (online) {
        try {
          const response = await fetch(`${API_BASE}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'citizen',
              data: newCitizen
            })
          });

          if (response.ok) {
            await db.citizens.update(newCitizen.id, { 
              synced: true,
              syncedAt: new Date().toISOString()
            });
            if (setCitizens) {
              setCitizens(prev => prev.map(c => c.id === newCitizen.id ? { ...c, synced: true } : c));
            }
            syncSuccess = true;
            setSuccessMessage(`${t.success}\n\n${newCitizen.firstName} ${newCitizen.lastName}\n🆔 ${nationalId}`);
          } else {
            throw new Error(`Server responded with ${response.status}`);
          }
        } catch (syncError) {
          console.warn('❌ Failed to sync citizen, queueing:', syncError.message);
          await db.citizens.update(newCitizen.id, {
            synced: false,
            syncError: syncError.message,
            lastSyncAttempt: Date.now()
          });
          syncQueue.add({
            type: 'citizen',
            id: newCitizen.id,
            data: newCitizen
          });
          setPendingCount(syncQueue.count());
          setSuccessMessage(`${t.offlineSuccess}\n\n${newCitizen.firstName} ${newCitizen.lastName}\n🆔 ${nationalId}`);
          if (addNotification) {
            await addNotification(
              user?.id,
              '💾 Citizen Saved Locally',
              `Citizen ${newCitizen.firstName} ${newCitizen.lastName} saved offline. Will sync when online.`,
              'warning'
            );
          }
        }
      } else {
        // Offline: queue immediately
        await db.citizens.update(newCitizen.id, {
          synced: false,
          offlineSaved: true
        });
        syncQueue.add({
          type: 'citizen',
          id: newCitizen.id,
          data: newCitizen
        });
        setPendingCount(syncQueue.count());
        setSuccessMessage(`${t.offlineSuccess}\n\n${newCitizen.firstName} ${newCitizen.lastName}\n🆔 ${nationalId}`);
        if (addNotification) {
          await addNotification(
            user?.id,
            '💾 Citizen Saved Offline',
            `Citizen ${newCitizen.firstName} ${newCitizen.lastName} saved offline. Will sync automatically when online.`,
            'warning'
          );
        }
      }

      setShowSuccess(true);

      // Reset form after 4 seconds
      setTimeout(() => {
        setForm({
          firstName: '',
          lastName: '',
          grandfatherName: '',
          dateOfBirth: '',
          gender: '',
          phone: '',
          email: '',
          address: '',
          region: user?.region || '',
          district: '',
          village: '',
          occupation: '',
          maritalStatus: '',
          photo: ''
        });
        setErrors({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', region: '' });
        setTouched({});
        setLocation(seedLocationFromUser(user));
        setShowSuccess(false);
      }, 4000);
      
    } catch (error) {
      console.error('Error:', error);
      alert(t.error + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // CLEAR FORM
  // ============================================================
  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) {
      setForm({
        firstName: '',
        lastName: '',
        grandfatherName: '',
        dateOfBirth: '',
        gender: '',
        phone: '',
        email: '',
        address: '',
        region: user?.region || '',
        district: '',
        village: '',
        occupation: '',
        maritalStatus: '',
        photo: ''
      });
      setErrors({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', region: '' });
      setTouched({});
      setLocation(seedLocationFromUser(user));
      setShowSuccess(false);
    }
  };

  // ============================================================
  // RENDER (same as before, but error handling updated)
  // ============================================================
  return (
    <div className="citizen-registration" style={{
      padding: '0',
      width: '100%',
      maxWidth: '100%',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* ===== HERO HEADER (dashboard style) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
        borderRadius: '16px',
        padding: '28px 28px 26px',
        margin: '0 0 20px',
        color: 'white',
        boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>{t.title}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {t.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.25)',
            border: isOnline ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(252,165,165,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {isOnline ? `✅ ${t.online}` : `❌ ${t.offline}`}
          </span>
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ⏳ {pendingCount} {t.pendingSync}
            </span>
          )}
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {t.offlineReady}
          </span>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 20px',
        background: isOnline ? '#f0fdf4' : '#fef2f2',
        borderRadius: '8px',
        marginBottom: '20px',
        border: isOnline ? '1px solid #86efac' : '1px solid #fca5a5',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isOnline ? '#22c55e' : '#ef4444'
          }}></span>
          <span style={{ fontWeight: '600', fontSize: '14px', color: isOnline ? '#166534' : '#991b1b' }}>
            {isOnline ? `✅ ${t.online}` : `❌ ${t.offline}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {pendingCount > 0 && (
            <span style={{
              background: '#f59e0b',
              color: 'white',
              padding: '2px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              ⏳ {pendingCount} {t.pendingSync}
            </span>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleClearStuck}
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              🗑️ {t.clearStuck}
            </button>
          )}
          <span style={{
            background: '#e0f2fe',
            color: '#0369a1',
            padding: '2px 14px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {t.offlineReady}
          </span>
          <select 
            value={language} 
            onChange={(e) => {
              setLanguage(e.target.value);
              i18n.changeLanguage(e.target.value);
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              background: 'white',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '140px'
            }}
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{
          padding: '14px 20px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong style={{ color: '#92400e' }}>📡 {t.offlineMode}</strong>
          <span style={{ color: '#92400e', marginLeft: '8px' }}>{t.offlineMessage}</span>
        </div>
      )}

      {/* Stuck-cleanup info */}
      {stuckInfo && (
        <div style={{
          padding: '12px 20px',
          background: stuckInfo.type === 'success' ? '#f0fdf4' : (stuckInfo.type === 'error' ? '#fef2f2' : '#eff6ff'),
          border: `1px solid ${stuckInfo.type === 'success' ? '#86efac' : (stuckInfo.type === 'error' ? '#fca5a5' : '#93c5fd')}`,
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '500',
          color: stuckInfo.type === 'success' ? '#166534' : (stuckInfo.type === 'error' ? '#991b1b' : '#1e40af')
        }}>
          {stuckInfo.text}
        </div>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div style={{
          padding: '16px 20px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          marginBottom: '20px',
          whiteSpace: 'pre-line',
          fontWeight: '500',
          color: '#166534'
        }}>
          {successMessage}
        </div>
      )}

      {/* Form Card */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa'
        }}>
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            📝 Registration Details
          </h3>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px' }}>
          <form onSubmit={handleSubmit} noValidate>
            {/* Row 1: First Name & Last Name */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.firstName}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder={t.firstNamePlaceholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.firstName && errors.firstName ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.firstName && errors.firstName ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.firstName && errors.firstName ? '#dc2626' : '#d1d5db';
                  }}
                  required
                />
                {touched.firstName && errors.firstName && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.firstName}
                  </span>
                )}
              </div>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.lastName}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder={t.lastNamePlaceholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.lastName && errors.lastName ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.lastName && errors.lastName ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.lastName && errors.lastName ? '#dc2626' : '#d1d5db';
                  }}
                  required
                />
                {touched.lastName && errors.lastName && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.lastName}
                  </span>
                )}
              </div>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.grandFatherName}
                </label>
                <input
                  type="text"
                  name="grandfatherName"
                  value={form.grandfatherName}
                  onChange={handleChange}
                  placeholder={t.grandFatherNamePlaceholder}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.grandfatherName && errors.grandfatherName ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.grandfatherName && errors.grandfatherName ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.grandfatherName && errors.grandfatherName ? '#dc2626' : '#d1d5db';
                  }}
                />
                {touched.grandfatherName && errors.grandfatherName && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.grandfatherName}
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: Date of Birth & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.dateOfBirth}
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.dateOfBirth && errors.dateOfBirth ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.dateOfBirth && errors.dateOfBirth ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.dateOfBirth && errors.dateOfBirth ? '#dc2626' : '#d1d5db';
                  }}
                  required
                />
                {touched.dateOfBirth && errors.dateOfBirth && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.dateOfBirth}
                  </span>
                )}
              </div>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.gender}
                </label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.gender && errors.gender ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.gender && errors.gender ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.gender && errors.gender ? '#dc2626' : '#d1d5db';
                  }}
                  required
                >
                  <option value="">{t.selectGender}</option>
                  <option value="Male">{t.male}</option>
                  <option value="Female">{t.female}</option>
                  <option value="Other">{t.other}</option>
                </select>
                {touched.gender && errors.gender && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.gender}
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Phone & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.phone}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder={t.phonePlaceholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.phone && errors.phone ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.phone && errors.phone ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.phone && errors.phone ? '#dc2626' : '#d1d5db';
                  }}
                  required
                />
                {touched.phone && errors.phone && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.phone}
                  </span>
                )}
                <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                  Format: +2519XXXXXXXX or 09XXXXXXXX (e.g., +251912345678)
                </small>
              </div>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.email}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t.emailPlaceholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${touched.email && errors.email ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.email && errors.email ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.email && errors.email ? '#dc2626' : '#d1d5db';
                  }}
                />
                {touched.email && errors.email && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.email}
                  </span>
                )}
              </div>
            </div>

            {/* Location Hierarchy: Country -> Region -> Zone -> Woreda -> Kebele -> Community */}
            <div style={{ marginBottom: '14px' }}>
              {user?.role === 'field_officer' && (
                <div style={{
                  padding: '10px 14px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#1e40af',
                  marginBottom: '10px'
                }}>
                  {user?.community_id
                    ? '🔒 Your working area is locked to your assigned community. You cannot change any location field.'
                    : '🔒 Your working area is locked to your assigned region. You can only change the community.'}
                </div>
              )}
              <LocationCascade
                initial={location}
                onChange={setLocation}
                requiredLevels={['region']}
                disabled={isSubmitting}
                lockLevels={user?.role === 'field_officer'
                  ? (user?.community_id
                      ? ['country', 'region', 'zone', 'woreda', 'kebele', 'community']
                      : ['country', 'region', 'zone', 'woreda', 'kebele'])
                  : []}
              />
              {touched.region && errors.region && (
                <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                  {errors.region}
                </span>
              )}
            </div>

            {/* Row 6: Occupation & Marital Status */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.occupation}
                </label>
                <input
                  type="text"
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                  placeholder={t.occupationPlaceholder}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.maritalStatus}
                </label>
                <select
                  name="maritalStatus"
                  value={form.maritalStatus}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="">{t.selectStatus}</option>
                  <option value="Single">{t.single}</option>
                  <option value="Married">{t.married}</option>
                  <option value="Divorced">{t.divorced}</option>
                  <option value="Widowed">{t.widowed}</option>
                </select>
              </div>
            </div>

            {/* Row 7: Photo */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
              <div className="form-group">
                  <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                  {t.photo}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
                    border: '1px solid #d1d5db', background: '#f9fafb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {form.photo ? (
                      <img src={form.photo} alt="Citizen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '28px', color: '#9ca3af' }}>📷</span>
                    )}
                  </div>
                  <label style={{
                    padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px',
                    fontSize: '12px', cursor: 'pointer', background: 'white', color: '#374151'
                  }}>
                    📤 {t.photoPlaceholder}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>

            {/* GPS Location */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '13px', color: '#374151' }}>
                📍 GPS Location
              </label>
              <GpsCapture onCoords={setGps} />
            </div>

            {/* System Assign ID */}
            <div style={{ 
              marginBottom: '24px', 
              fontSize: '13px', 
              color: '#6b7280',
              padding: '8px 0',
              borderTop: '1px solid #f3f4f6',
              paddingTop: '16px'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🆔</span> {t.systemAssignId}
              </span>
            </div>

            {/* Validation Summary */}
            {Object.values(errors).some(e => e !== '') && (
              <div style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#991b1b',
                fontSize: '14px'
              }}>
                <strong>⚠️ Please fix the following errors:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {errors.firstName && <li>First Name: {errors.firstName}</li>}
                  {errors.lastName && <li>Last Name: {errors.lastName}</li>}
                  {errors.grandfatherName && <li>Grandfather Name: {errors.grandfatherName}</li>}
                  {errors.dateOfBirth && <li>Date of Birth: {errors.dateOfBirth}</li>}
                  {errors.gender && <li>Gender: {errors.gender}</li>}
                  {errors.phone && <li>Phone: {errors.phone}</li>}
                  {errors.email && <li>Email: {errors.email}</li>}
                  {errors.region && <li>Region: {errors.region}</li>}
                </ul>
              </div>
            )}

            {/* Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              flexWrap: 'wrap',
              borderTop: '1px solid #f3f4f6',
              paddingTop: '20px'
            }}>
              <button
                type="submit"
                disabled={isSubmitting || Object.values(errors).some(e => e !== '')}
                style={{
                  padding: '12px 32px',
                  background: isSubmitting || Object.values(errors).some(e => e !== '') ? '#94a3b8' : (isOnline ? '#0b7e4b' : '#f59e0b'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSubmitting || Object.values(errors).some(e => e !== '') ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  opacity: isSubmitting || Object.values(errors).some(e => e !== '') ? 0.7 : 1,
                  transition: 'background 0.2s ease',
                  flex: '1',
                  minWidth: '180px',
                  maxWidth: '280px'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && !Object.values(errors).some(e => e !== '')) {
                    e.target.style.background = isOnline ? '#0a6a3f' : '#d97706';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && !Object.values(errors).some(e => e !== '')) {
                    e.target.style.background = isOnline ? '#0b7e4b' : '#f59e0b';
                  }
                }}
              >
                {isSubmitting ? `⏳ ${t.processing}` : (isOnline ? `✅ ${t.register}` : `💾 ${t.saveOffline}`)}
              </button>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '12px 28px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '500',
                  transition: 'background 0.2s ease',
                  minWidth: '140px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}
              >
                🗑️ {t.clear}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CitizenRegistration;