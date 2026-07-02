import React, { useState } from 'react';
import { db } from '../../services/database';
import { uid, getToday } from '../../utils/helpers';

// ===== LANGUAGE TRANSLATIONS =====
const translations = {
  en: {
    title: '🆔 Register Citizen for National ID',
    subtitle: 'Enter citizen information for National ID registration',
    offlineReady: 'Offline Ready',
    firstName: 'First Name *',
    firstNamePlaceholder: 'Enter first name',
    lastName: 'Last Name *',
    lastNamePlaceholder: 'Enter last name',
    dateOfBirth: 'Date of Birth *',
    gender: 'Gender *',
    selectGender: 'Select Gender',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    phone: 'Phone Number *',
    phonePlaceholder: 'Enter phone number',
    email: 'Email',
    emailPlaceholder: 'Enter email address',
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
    idType: 'ID Type',
    nationalId: 'National ID',
    birthCertificate: 'Birth Certificate',
    passport: 'Passport',
    idNumber: 'ID Number',
    idNumberPlaceholder: 'Enter ID number',
    biometrics: 'Biometrics Collected',
    yes: 'Yes',
    no: 'No',
    systemAssignId: 'System will assign National ID',
    register: '✅ Register Citizen',
    processing: '⏳ Processing...',
    clear: '🗑️ Clear Form',
    clearConfirm: 'Are you sure you want to clear all fields?',
    success: '✅ Citizen registered successfully!',
    successId: 'National ID: ',
    error: '❌ Error registering citizen: ',
    // Validation messages
    firstNameRequired: 'First name is required',
    firstNameMin: 'First name must be at least 2 characters',
    firstNameMax: 'First name must be less than 50 characters',
    firstNameInvalid: 'First name can only contain letters, spaces, hyphens, and apostrophes',
    lastNameRequired: 'Last name is required',
    lastNameMin: 'Last name must be at least 2 characters',
    lastNameMax: 'Last name must be less than 50 characters',
    lastNameInvalid: 'Last name can only contain letters, spaces, hyphens, and apostrophes',
    dobRequired: 'Date of birth is required',
    dobMinAge: 'Citizen must be at least 18 years old',
    dobMaxAge: 'Age cannot exceed 120 years',
    genderRequired: 'Gender is required',
    phoneRequired: 'Phone number is required',
    phoneInvalid: 'Phone number must be 10-15 digits only',
    emailInvalid: 'Please enter a valid email address',
    regionRequired: 'Region is required',
    idNumberMin: 'ID number must be at least 4 characters',
    fixErrors: '⚠️ Please fix the following errors:'
  },
  am: {
    title: '🆔 ለብሔራዊ መታወቂያ ዜጋ ይመዝገቡ',
    subtitle: 'ለብሔራዊ መታወቂያ ምዝገባ የዜጋ መረጃ ያስገቡ',
    offlineReady: 'ከመስመር ውጭ ዝግጁ',
    firstName: 'ስም *',
    firstNamePlaceholder: 'ስም ያስገቡ',
    lastName: 'የአባት ስም *',
    lastNamePlaceholder: 'የአባት ስም ያስገቡ',
    dateOfBirth: 'የትውልድ ቀን *',
    gender: 'ጾታ *',
    selectGender: 'ጾታ ይምረጡ',
    male: 'ወንድ',
    female: 'ሴት',
    other: 'ሌላ',
    phone: 'ስልክ ቁጥር *',
    phonePlaceholder: 'ስልክ ቁጥር ያስገቡ',
    email: 'ኢሜይል',
    emailPlaceholder: 'ኢሜይል አድራሻ ያስገቡ',
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
    idType: 'የመታወቂያ አይነት',
    nationalId: 'ብሔራዊ መታወቂያ',
    birthCertificate: 'የትውልድ የምስክር ወረቀት',
    passport: 'ፓስፖርት',
    idNumber: 'የመታወቂያ ቁጥር',
    idNumberPlaceholder: 'የመታወቂያ ቁጥር ያስገቡ',
    biometrics: 'ባዮሜትሪክስ የተሰበሰበ',
    yes: 'አዎ',
    no: 'አይ',
    systemAssignId: 'ስርዓቱ ብሔራዊ መታወቂያ ይመድባል',
    register: '✅ ዜጋ ይመዝገቡ',
    processing: '⏳ በሂደት ላይ...',
    clear: '🗑️ ቅጹን አጽዳ',
    clearConfirm: 'ሁሉንም መስኮች ማጽዳት እንደሚፈልጉ እርግጠኛ ነዎት?',
    success: '✅ ዜጋ በተሳካ ሁኔታ ተመዝግቧል!',
    successId: 'ብሔራዊ መታወቂያ፡ ',
    error: '❌ ዜጋን በመመዝገብ ላይ ስህተት፡ ',
    firstNameRequired: 'ስም ያስፈልጋል',
    firstNameMin: 'ስም ቢያንስ 2 ፊደላት መሆን አለበት',
    firstNameMax: 'ስም ከ50 ፊደላት ያነሰ መሆን አለበት',
    firstNameInvalid: 'ስም ፊደላት፣ ክፍተቶች፣ ሰረዞች እና አፖስትሮፎችን ብቻ ሊይዝ ይችላል',
    lastNameRequired: 'የአባት ስም ያስፈልጋል',
    lastNameMin: 'የአባት ስም ቢያንስ 2 ፊደላት መሆን አለበት',
    lastNameMax: 'የአባት ስም ከ50 ፊደላት ያነሰ መሆን አለበት',
    lastNameInvalid: 'የአባት ስም ፊደላት፣ ክፍተቶች፣ ሰረዞች እና አፖስትሮፎችን ብቻ ሊይዝ ይችላል',
    dobRequired: 'የትውልድ ቀን ያስፈልጋል',
    dobMinAge: 'ዜጋ ቢያንስ 18 ዓመት መሆን አለበት',
    dobMaxAge: 'ዕድሜ ከ120 ዓመት መብለጥ አይችልም',
    genderRequired: 'ጾታ ያስፈልጋል',
    phoneRequired: 'ስልክ ቁጥር ያስፈልጋል',
    phoneInvalid: 'ስልክ ቁጥር 10-15 አሃዞች ብቻ መሆን አለበት',
    emailInvalid: 'እባክዎ ትክክለኛ የኢሜይል አድራሻ ያስገቡ',
    regionRequired: 'ክልል ያስፈልጋል',
    idNumberMin: 'የመታወቂያ ቁጥር ቢያንስ 4 ፊደላት መሆን አለበት',
    fixErrors: '⚠️ እባክዎ የሚከተሉትን ስህተቶች ያስተካክሉ:'
  },
  om: {
    title: '🆔 Firoota Magaalaa Sabaa Qabaachuuf Galmeessaa',
    subtitle: 'Odeeffannoo Firoota galmeessuu Magaalaa Sabaa qabaachuuf galmeessuu',
    offlineReady: 'Offline Qopheessa',
    firstName: 'Maqaa Dura *',
    firstNamePlaceholder: 'Maqaa dura galchi',
    lastName: 'Maqaa Abbootii *',
    lastNamePlaceholder: 'Maqaa Abbootii galchi',
    dateOfBirth: 'Guyyaa Dhalootaa *',
    gender: 'Saala *',
    selectGender: 'Saala fili',
    male: 'Dhiira',
    female: 'Dubartii',
    other: 'Kan Biroo',
    phone: 'Lakkoobsa Bilbilaa *',
    phonePlaceholder: 'Lakkoobsa bilbilaa galchi',
    email: 'Email',
    emailPlaceholder: 'Teessoo email galchi',
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
    idType: 'Gosa Waraqaa Magaalaa',
    nationalId: 'Waraqaa Magaalaa Sabaa',
    birthCertificate: 'Waraqaa Dhalootaa',
    passport: 'Paasipooriti',
    idNumber: 'Lakkoobsa Waraqaa Magaalaa',
    idNumberPlaceholder: 'Lakkoobsa waraqaa magaalaa galchi',
    biometrics: 'Biometrics Walitti Qabame',
    yes: 'Eeyyee',
    no: 'Lakkii',
    systemAssignId: 'Sistimiin Magaalaa Sabaa Godina',
    register: '✅ Firoota Galmeessi',
    processing: '⏳ Hojii Irratti...',
    clear: '🗑️ Forma Qulqulleessi',
    clearConfirm: 'Dirree hunda qulqulleessuu barbaadda?',
    success: '✅ Firoota milkaa\'iin galmeessame!',
    successId: 'Magaalaa Sabaa: ',
    error: '❌ Dogoggora galmeessuu firoota: ',
    firstNameRequired: 'Maqaa dura barbaachisaa dha',
    firstNameMin: 'Maqaa dura xiqqaatti 2 arfii ta\'uu qaba',
    firstNameMax: 'Maqaa dura 50 arfii caaluu hin qabu',
    firstNameInvalid: 'Maqaa dura arfiiwwan, bakka duwwaa, hirkoo, fi apostrophe qofa qabaachuu danda\'a',
    lastNameRequired: 'Maqaa abbootii barbaachisaa dha',
    lastNameMin: 'Maqaa abbootii xiqqaatti 2 arfii ta\'uu qaba',
    lastNameMax: 'Maqaa abbootii 50 arfii caaluu hin qabu',
    lastNameInvalid: 'Maqaa abbootii arfiiwwan, bakka duwwaa, hirkoo, fi apostrophe qofa qabaachuu danda\'a',
    dobRequired: 'Guyyaa dhalootaa barbaachisaa dha',
    dobMinAge: 'Firoota xiqqaatti waggaa 18 ta\'uu qaba',
    dobMaxAge: 'Umurri waggaa 120 caaluu hin danda\'u',
    genderRequired: 'Saala barbaachisaa dha',
    phoneRequired: 'Lakkoobsa bilbilaa barbaachisaa dha',
    phoneInvalid: 'Lakkoobsi bilbilaa 10-15 digrii qofa ta\'uu qaba',
    emailInvalid: 'Teessoo email sirrii galchi',
    regionRequired: 'Naannoo barbaachisaa dha',
    idNumberMin: 'Lakkoobsi waraqaa magaalaa xiqqaatti 4 arfii ta\'uu qaba',
    fixErrors: '⚠️ Dogoggora armaan gadii sirreessi:'
  },
  ti: {
    title: '🆔 ንብሔራዊ መታወቂያ ዜጋ ተመዝገብ',
    subtitle: 'ንብሔራዊ መታወቂያ ምዝገባ ሓበሬታ ዜጋ አእትዉ',
    offlineReady: 'ብልዕ መስመር ተዳሉ',
    firstName: 'ስም *',
    firstNamePlaceholder: 'ስም አእትዉ',
    lastName: 'ስም ኣቦ *',
    lastNamePlaceholder: 'ስም ኣቦ አእትዉ',
    dateOfBirth: 'ዕለት ትውልድ *',
    gender: 'ጾታ *',
    selectGender: 'ጾታ ምረጹ',
    male: 'ተባዕታይ',
    female: 'ኣንስተይቲ',
    other: 'ካልእ',
    phone: 'ቁጽሪ ተሌፎን *',
    phonePlaceholder: 'ቁጽሪ ተሌፎን አእትዉ',
    email: 'ኢመይል',
    emailPlaceholder: 'አድራሻ ኢመይል አእትዉ',
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
    idType: 'ዓይነት መታወቂያ',
    nationalId: 'ብሔራዊ መታወቂያ',
    birthCertificate: 'ሰርቲፊኬት ትውልድ',
    passport: 'ፓስፖርት',
    idNumber: 'ቁጽሪ መታወቂያ',
    idNumberPlaceholder: 'ቁጽሪ መታወቂያ አእትዉ',
    biometrics: 'ባዮሜትሪክስ ተሰብሲቡ',
    yes: 'እወ',
    no: 'አይኮን',
    systemAssignId: 'ስርዓት ብሔራዊ መታወቂያ ይምድብ',
    register: '✅ ዜጋ ተመዝገብ',
    processing: '⏳ ኣብ ስራሕ ኣሎ...',
    clear: '🗑️ ቅጽ አጽርሕ',
    clearConfirm: 'ኩሉ መዳያት ምጽራሕ ደልየካ ኢኻ?',
    success: '✅ ዜጋ ብዕለት ተመዝጊቡ!',
    successId: 'ብሔራዊ መታወቂያ: ',
    error: '❌ ኣብ ምዝገባ ዜጋ ጌጋ: ',
    firstNameRequired: 'ስም የኣስፈልግ',
    firstNameMin: 'ስም ብንኡስ 2 ፊደላት ክኸውን ኣለዎ',
    firstNameMax: 'ስም ካብ 50 ፊደላት ንኣኽስተይቲ ክኸውን ኣለዎ',
    firstNameInvalid: 'ስም ፊደላት፡ ክፍተታት፡ ሰረዞት፡ ኣፖስትሮፎት ጥራሕ ክህልዎ ይኽእል',
    lastNameRequired: 'ስም ኣቦ የኣስፈልግ',
    lastNameMin: 'ስም ኣቦ ብንኡስ 2 ፊደላት ክኸውን ኣለዎ',
    lastNameMax: 'ስም ኣቦ ካብ 50 ፊደላት ንኣኽስተይቲ ክኸውን ኣለዎ',
    lastNameInvalid: 'ስም ኣቦ ፊደላት፡ ክፍተታት፡ ሰረዞት፡ ኣፖስትሮፎት ጥራሕ ክህልዎ ይኽእል',
    dobRequired: 'ዕለት ትውልድ የኣስፈልግ',
    dobMinAge: 'ዜጋ ብንኡስ 18 ዓመት ክኸውን ኣለዎ',
    dobMaxAge: 'ዕድመ ካብ 120 ዓመት ክብጽሕ ኣይክእልን',
    genderRequired: 'ጾታ የኣስፈልግ',
    phoneRequired: 'ቁጽሪ ተሌፎን የኣስፈልግ',
    phoneInvalid: 'ቁጽሪ ተሌፎን 10-15 ምልክታት ጥራሕ ክኸውን ኣለዎ',
    emailInvalid: 'በጃኻ ቅኑዕ አድራሻ ኢመይል አእትዉ',
    regionRequired: 'ክልል የኣስፈልግ',
    idNumberMin: 'ቁጽሪ መታወቂያ ብንኡስ 4 ፊደላት ክኸውን ኣለዎ',
    fixErrors: '⚠️ ነዚ ዝስዕብ ጌጋታት ኣስተካኽሉ:'
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
    idType: 'National ID',
    idNumber: '',
    biometrics: false
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get translations for current language
  const t = translations[language] || translations.en;

  // ===== LANGUAGE OPTIONS =====
  const languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'am', label: '🇪🇹 አማርኛ' },
    { code: 'om', label: '🇪🇹 Afaan Oromoo' },
    { code: 'ti', label: '🇪🇹 ትግርኛ' }
  ];

  // ===== ENHANCED VALIDATION =====
  const validate = () => {
    const newErrors = {};
    
    // First Name Validation
    if (!form.firstName.trim()) {
      newErrors.firstName = t.firstNameRequired;
    } else if (form.firstName.trim().length < 2) {
      newErrors.firstName = t.firstNameMin;
    } else if (form.firstName.trim().length > 50) {
      newErrors.firstName = t.firstNameMax;
    } else if (!/^[a-zA-Z\s\-']+$/.test(form.firstName.trim())) {
      newErrors.firstName = t.firstNameInvalid;
    }

    // Last Name Validation
    if (!form.lastName.trim()) {
      newErrors.lastName = t.lastNameRequired;
    } else if (form.lastName.trim().length < 2) {
      newErrors.lastName = t.lastNameMin;
    } else if (form.lastName.trim().length > 50) {
      newErrors.lastName = t.lastNameMax;
    } else if (!/^[a-zA-Z\s\-']+$/.test(form.lastName.trim())) {
      newErrors.lastName = t.lastNameInvalid;
    }

    // Date of Birth Validation
    if (!form.dateOfBirth) {
      newErrors.dateOfBirth = t.dobRequired;
    } else {
      const birthDate = new Date(form.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        newErrors.dateOfBirth = t.dobMinAge;
      } else if (age > 120) {
        newErrors.dateOfBirth = t.dobMaxAge;
      }
    }

    // Gender Validation
    if (!form.gender) {
      newErrors.gender = t.genderRequired;
    }

    // Phone Validation
    if (!form.phone.trim()) {
      newErrors.phone = t.phoneRequired;
    } else if (!/^[0-9]{10,15}$/.test(form.phone.trim())) {
      newErrors.phone = t.phoneInvalid;
    }

    // Email Validation
    if (form.email && form.email.trim()) {
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email.trim())) {
        newErrors.email = t.emailInvalid;
      }
    }

    // Region Validation
    if (!form.region) {
      newErrors.region = t.regionRequired;
    }

    // ID Number Validation
    if (form.idNumber && form.idNumber.trim()) {
      if (form.idNumber.trim().length < 4) {
        newErrors.idNumber = t.idNumberMin;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== VALIDATE SINGLE FIELD ON BLUR =====
  const validateField = (fieldName, value) => {
    const fieldErrors = {};
    
    switch(fieldName) {
      case 'firstName':
        if (!value.trim()) {
          fieldErrors.firstName = t.firstNameRequired;
        } else if (value.trim().length < 2) {
          fieldErrors.firstName = t.firstNameMin;
        } else if (value.trim().length > 50) {
          fieldErrors.firstName = t.firstNameMax;
        } else if (!/^[a-zA-Z\s\-']+$/.test(value.trim())) {
          fieldErrors.firstName = t.firstNameInvalid;
        }
        break;
      case 'lastName':
        if (!value.trim()) {
          fieldErrors.lastName = t.lastNameRequired;
        } else if (value.trim().length < 2) {
          fieldErrors.lastName = t.lastNameMin;
        } else if (value.trim().length > 50) {
          fieldErrors.lastName = t.lastNameMax;
        } else if (!/^[a-zA-Z\s\-']+$/.test(value.trim())) {
          fieldErrors.lastName = t.lastNameInvalid;
        }
        break;
      case 'dateOfBirth':
        if (!value) {
          fieldErrors.dateOfBirth = t.dobRequired;
        } else {
          const birthDate = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age < 18) {
            fieldErrors.dateOfBirth = t.dobMinAge;
          } else if (age > 120) {
            fieldErrors.dateOfBirth = t.dobMaxAge;
          }
        }
        break;
      case 'phone':
        if (!value.trim()) {
          fieldErrors.phone = t.phoneRequired;
        } else if (!/^[0-9]{10,15}$/.test(value.trim())) {
          fieldErrors.phone = t.phoneInvalid;
        }
        break;
      case 'email':
        if (value && value.trim() && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim())) {
          fieldErrors.email = t.emailInvalid;
        }
        break;
      case 'region':
        if (!value) {
          fieldErrors.region = t.regionRequired;
        }
        break;
      case 'idNumber':
        if (value && value.trim() && value.trim().length < 4) {
          fieldErrors.idNumber = t.idNumberMin;
        }
        break;
      default:
        break;
    }

    setErrors(prev => ({ ...prev, ...fieldErrors }));
    return Object.keys(fieldErrors).length === 0;
  };

  // ===== HANDLE CHANGE =====
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: val }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // ===== HANDLE BLUR =====
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  // ===== HANDLE SUBMIT =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const allTouched = {};
    Object.keys(form).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    if (!validate()) {
      const firstError = document.querySelector('.form-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    setIsSubmitting(true);

    try {
      const nationalId = `NID-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      const newCitizen = {
        id: uid(),
        nationalId: nationalId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        region: form.region,
        district: form.district.trim(),
        village: form.village.trim(),
        occupation: form.occupation.trim(),
        maritalStatus: form.maritalStatus,
        registrationDate: new Date().toISOString(),
        registeredBy: user.employeeId,
        registeredByName: user.name,
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        biometrics: form.biometrics,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await db.citizens.add(newCitizen);
      
      if (setCitizens) {
        setCitizens(prev => [newCitizen, ...prev]);
      }

      if (addNotification) {
        addNotification(user.id, '🆔 Citizen Registered', `${newCitizen.firstName} ${newCitizen.lastName} registered with ID: ${nationalId}`, 'success');
      }

      alert(`${t.success}\n${t.successId}${nationalId}`);
      
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
        idType: 'National ID',
        idNumber: '',
        biometrics: false
      });
      setErrors({});
      setTouched({});
    } catch (error) {
      console.error('Error registering citizen:', error);
      alert(t.error + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ===== CLEAR FORM =====
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
        idType: 'National ID',
        idNumber: '',
        biometrics: false
      });
      setErrors({});
      setTouched({});
    }
  };

  return (
    <div className="citizen-registration">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>{t.title}</h3>
            <p>{t.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="form-badge">{t.offlineReady}</span>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                background: 'white',
                cursor: 'pointer',
                opacity: 1,
                visibility: 'visible'
              }}
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="report-form" noValidate>
          {/* First Name & Last Name */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.firstName}</label>
              <input 
                type="text" 
                name="firstName"
                value={form.firstName} 
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t.firstNamePlaceholder}
                className={errors.firstName && touched.firstName ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.firstName && touched.firstName ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.firstName && touched.firstName && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.firstName}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{t.lastName}</label>
              <input 
                type="text" 
                name="lastName"
                value={form.lastName} 
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t.lastNamePlaceholder}
                className={errors.lastName && touched.lastName ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.lastName && touched.lastName ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.lastName && touched.lastName && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.lastName}
                </div>
              )}
            </div>
          </div>

          {/* Date of Birth & Gender */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.dateOfBirth}</label>
              <input 
                type="date" 
                name="dateOfBirth"
                value={form.dateOfBirth} 
                onChange={handleChange}
                onBlur={handleBlur}
                className={errors.dateOfBirth && touched.dateOfBirth ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.dateOfBirth && touched.dateOfBirth ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.dateOfBirth && touched.dateOfBirth && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.dateOfBirth}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{t.gender}</label>
              <select 
                name="gender"
                value={form.gender} 
                onChange={handleChange}
                onBlur={handleBlur}
                className={errors.gender && touched.gender ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  display: 'block', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.gender && touched.gender ? '#dc2626' : '#d1d5db'
                }}
              >
                <option value="">{t.selectGender}</option>
                <option value="Male">{t.male}</option>
                <option value="Female">{t.female}</option>
                <option value="Other">{t.other}</option>
              </select>
              {errors.gender && touched.gender && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.gender}
                </div>
              )}
            </div>
          </div>

          {/* Phone & Email */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.phone}</label>
              <input 
                type="tel" 
                name="phone"
                value={form.phone} 
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t.phonePlaceholder}
                className={errors.phone && touched.phone ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.phone && touched.phone ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.phone && touched.phone && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.phone}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{t.email}</label>
              <input 
                type="email" 
                name="email"
                value={form.email} 
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t.emailPlaceholder}
                className={errors.email && touched.email ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.email && touched.email ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.email && touched.email && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.email}
                </div>
              )}
            </div>
          </div>

          {/* Region & District */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.region}</label>
              <select 
                name="region"
                value={form.region} 
                onChange={handleChange}
                onBlur={handleBlur}
                className={errors.region && touched.region ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  display: 'block', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.region && touched.region ? '#dc2626' : '#d1d5db'
                }}
              >
                <option value="">{t.selectRegion}</option>
                <option value="North">{t.north}</option>
                <option value="South">{t.south}</option>
                <option value="East">{t.east}</option>
                <option value="West">{t.west}</option>
                <option value="Central">{t.central}</option>
              </select>
              {errors.region && touched.region && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.region}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>{t.district}</label>
              <input 
                type="text" 
                name="district"
                value={form.district} 
                onChange={handleChange}
                placeholder={t.districtPlaceholder}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          {/* Village & Address */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.village}</label>
              <input 
                type="text" 
                name="village"
                value={form.village} 
                onChange={handleChange}
                placeholder={t.villagePlaceholder}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>{t.address}</label>
              <input 
                type="text" 
                name="address"
                value={form.address} 
                onChange={handleChange}
                placeholder={t.addressPlaceholder}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          {/* Occupation & Marital Status */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.occupation}</label>
              <input 
                type="text" 
                name="occupation"
                value={form.occupation} 
                onChange={handleChange}
                placeholder={t.occupationPlaceholder}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>{t.maritalStatus}</label>
              <select 
                name="maritalStatus"
                value={form.maritalStatus} 
                onChange={handleChange}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option value="">{t.selectStatus}</option>
                <option value="Single">{t.single}</option>
                <option value="Married">{t.married}</option>
                <option value="Divorced">{t.divorced}</option>
                <option value="Widowed">{t.widowed}</option>
              </select>
            </div>
          </div>

          {/* ID Type & ID Number */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.idType}</label>
              <select 
                name="idType"
                value={form.idType} 
                onChange={handleChange}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option value="National ID">{t.nationalId}</option>
                <option value="Birth Certificate">{t.birthCertificate}</option>
                <option value="Passport">{t.passport}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t.idNumber}</label>
              <input 
                type="text" 
                name="idNumber"
                value={form.idNumber} 
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={t.idNumberPlaceholder}
                className={errors.idNumber && touched.idNumber ? 'input-error' : ''}
                style={{ 
                  opacity: 1, 
                  visibility: 'visible', 
                  width: '100%', 
                  padding: '8px 12px',
                  borderColor: errors.idNumber && touched.idNumber ? '#dc2626' : '#d1d5db'
                }}
              />
              {errors.idNumber && touched.idNumber && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  ⚠️ {errors.idNumber}
                </div>
              )}
            </div>
          </div>

          {/* Biometrics */}
          <div className="form-row">
            <div className="form-group">
              <label>{t.biometrics}</label>
              <select 
                name="biometrics"
                value={form.biometrics} 
                onChange={handleChange}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option value="false">{t.no}</option>
                <option value="true">{t.yes}</option>
              </select>
            </div>
            <div className="form-group" style={{display:'flex', alignItems:'flex-end'}}>
              <div style={{fontSize:'12px', color:'#64748b'}}>{t.systemAssignId}</div>
            </div>
          </div>

          {/* Validation Summary */}
          {Object.keys(errors).length > 0 && Object.values(errors).some(e => e) && (
            <div className="validation-summary" style={{
              background: '#fee2e2',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}>
              <strong style={{ color: '#dc2626' }}>{t.fixErrors}</strong>
              <ul style={{ margin: '8px 0 0 20px', color: '#991b1b', fontSize: '13px' }}>
                {Object.values(errors).filter(e => e).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions" style={{ 
            marginTop: '20px', 
            display: 'flex', 
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <button 
              type="submit" 
              className="btn-submit" 
              disabled={isSubmitting}
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#0b7e4b',
                color: 'white',
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '160px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.target.style.background = '#0a6a3f';
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.target.style.background = '#0b7e4b';
              }}
            >
              {isSubmitting ? t.processing : t.register}
            </button>
            <button 
              type="button" 
              className="btn-cancel" 
              onClick={handleClear}
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e5e7eb',
                color: '#374151',
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#d1d5db'}
              onMouseLeave={(e) => e.target.style.background = '#e5e7eb'}
            >
              {t.clear}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CitizenRegistration;