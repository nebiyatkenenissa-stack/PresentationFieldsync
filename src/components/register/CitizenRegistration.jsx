// components/register/CitizenRegistration.js – FULLY VALIDATED (18+, no duplicate name/email)

import React, { useState, useEffect } from 'react';
import { db, syncQueue, checkRealInternet } from '../../services/database';
import { uid } from '../../utils/helpers';

const API_BASE = 'http://localhost:5000/api';

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
    dateOfBirth: 'Date of Birth *',
    dateOfBirthError: 'Please enter a valid date of birth (must be in the past)',
    ageError: 'Citizen must be 18 years or older',
    gender: 'Gender *',
    selectGender: 'Select Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    phone: 'Phone Number *',
    phonePlaceholder: '+2519XXXXXXXX',
    phoneError: 'Phone must start with +2519 followed by 8 digits (e.g., +251912345678)',
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
    duplicateName: 'A citizen with this name already exists'
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
    duplicateName: 'በዚህ ስም የተመዘገበ ዜጋ አለ'
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
    duplicateName: 'Firoon maqaa kanaan dura galmeeffame'
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
    duplicateName: 'ዜጋ በዚ ስም ቀደም ተመዝጊቡ'
  }
};

function CitizenRegistration({ user, citizens, setCitizens, addNotification }) {
  const [language, setLanguage] = useState('en');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
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
    biometrics: false
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

  // Get translations
  const t = translations[language] || translations.en;

  // Language options
  const languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'am', label: '🇪🇹 አማርኛ' },
    { code: 'om', label: '🇪🇹 Afaan Oromoo' },
    { code: 'ti', label: '🇪🇹 ትግርኛ' }
  ];

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
    if (!/^\+2519\d{8}$/.test(value.trim())) {
      return t.phoneError || 'Phone must start with +2519 followed by 8 digits (e.g., +251912345678)';
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
  // DUPLICATE CHECKS (name & email only)
  // ============================================================
  const checkDuplicates = () => {
    const dupErrors = {};
    const existing = citizens || [];

    // Check duplicate full name (case-insensitive)
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.toLowerCase();
    if (fullName.trim()) {
      const nameExists = existing.some(c => 
        c.firstName && c.lastName && 
        `${c.firstName} ${c.lastName}`.toLowerCase() === fullName
      );
      if (nameExists) {
        dupErrors.firstName = t.duplicateName || 'A citizen with this name already exists';
      }
    }

    // Check duplicate email (if provided)
    if (form.email.trim()) {
      const emailExists = existing.some(c => c.email && c.email.toLowerCase() === form.email.trim().toLowerCase());
      if (emailExists) {
        dupErrors.email = t.duplicateEmail || 'This email is already registered';
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
      dateOfBirth: validateDateOfBirth(form.dateOfBirth),
      gender: validateGender(form.gender),
      phone: validatePhone(form.phone),
      email: validateEmail(form.email),
      region: validateRegion(form.region)
    };
    // Override with duplicate errors if any
    const dupErrors = checkDuplicates();
    if (dupErrors.firstName) newErrors.firstName = dupErrors.firstName;
    if (dupErrors.email) newErrors.email = dupErrors.email;

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

    // If it's a name or email field, also check duplicates
    if (name === 'firstName' || name === 'lastName' || name === 'email') {
      const dupErrors = checkDuplicates();
      if (dupErrors.firstName) {
        setErrors(prev => ({ ...prev, firstName: dupErrors.firstName }));
      }
      if (dupErrors.email) {
        setErrors(prev => ({ ...prev, email: dupErrors.email }));
      }
    }
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

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

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

    setIsSubmitting(true);
    setShowSuccess(false);

    try {
      const online = await checkRealInternet();
      setIsOnline(online);

      const nationalId = `NID-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const newCitizen = {
        id: uid(),
        nationalId: nationalId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        email: form.email.trim() || '',
        address: form.address.trim() || '',
        region: form.region,
        district: form.district.trim() || '',
        village: form.village.trim() || '',
        occupation: form.occupation.trim() || '',
        maritalStatus: form.maritalStatus || '',
        registrationDate: new Date().toISOString(),
        registeredBy: user?.employeeId || 'unknown',
        registeredByName: user?.name || 'Unknown',
        biometrics: form.biometrics || false,
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
          biometrics: false
        });
        setErrors({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', region: '' });
        setTouched({});
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
        biometrics: false
      });
      setErrors({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', region: '' });
      setTouched({});
      setShowSuccess(false);
    }
  };

  // ============================================================
  // RENDER (same as before, but error handling updated)
  // ============================================================
  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '900px', 
      margin: '0 auto',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
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
            onChange={(e) => setLanguage(e.target.value)}
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
          padding: '24px 28px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa'
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            {t.title}
          </h3>
          <p style={{ margin: '0', color: '#6b7280', fontSize: '14px' }}>
            {t.subtitle}
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px' }}>
          <form onSubmit={handleSubmit} noValidate>
            {/* Row 1: First Name & Last Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.firstName}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={t.firstNamePlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.lastName}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={t.lastNamePlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
            </div>

            {/* Row 2: Date of Birth & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.dateOfBirth}
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.gender}
                </label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.phone}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={t.phonePlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                  Format: +2519XXXXXXXX (e.g., +251912345678)
                </small>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.email}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder={t.emailPlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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

            {/* Row 4: Region & District */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.region}
                </label>
                <select
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: `1px solid ${touched.region && errors.region ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = touched.region && errors.region ? '#dc2626' : '#3b82f6'}
                  onBlur={(e) => {
                    handleBlur(e);
                    e.target.style.borderColor = touched.region && errors.region ? '#dc2626' : '#d1d5db';
                  }}
                  required
                >
                  <option value="">{t.selectRegion}</option>
                  <option value="North">{t.north}</option>
                  <option value="South">{t.south}</option>
                  <option value="East">{t.east}</option>
                  <option value="West">{t.west}</option>
                  <option value="Central">{t.central}</option>
                </select>
                {touched.region && errors.region && (
                  <span style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    {errors.region}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.district}
                </label>
                <input
                  type="text"
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  placeholder={t.districtPlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
            </div>

            {/* Row 5: Village & Address */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.village}
                </label>
                <input
                  type="text"
                  name="village"
                  value={form.village}
                  onChange={handleChange}
                  placeholder={t.villagePlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.address}
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder={t.addressPlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
            </div>

            {/* Row 6: Occupation & Marital Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
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
                    padding: '10px 14px',
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
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.maritalStatus}
                </label>
                <select
                  name="maritalStatus"
                  value={form.maritalStatus}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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

            {/* Row 7: Biometrics (single field) */}
            <div style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '6px', fontSize: '14px', color: '#374151' }}>
                  {t.biometrics}
                </label>
                <select
                  value={form.biometrics ? 'true' : 'false'}
                  onChange={(e) => setForm(prev => ({ ...prev, biometrics: e.target.value === 'true' }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
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
                  <option value="false">{t.no}</option>
                  <option value="true">{t.yes}</option>
                </select>
              </div>
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