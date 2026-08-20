import React, { createContext, useState, useContext, useEffect } from 'react';

// Simple translations directly in this file
const userLanguages = {
  en: {
    name: 'English',
    nativeName: 'English',
    translations: {
      userManagement: {
        title: 'User Management',
        createUser: 'Create New User',
        createUserSub: 'Add new Field Officer or Supervisor',
        totalUsers: 'Total: {count} users',
        allUsers: 'All Users',
        noUsers: 'No users found',
        fullName: 'Full Name *',
        password: 'Password *',
        phone: 'Phone',
        department: 'Department',
        assignedSites: 'Assigned Sites',
        enterName: 'Enter full name',
        enterEmail: 'Enter email',
        enterPassword: 'Min 6 characters',
        enterPhone: 'Enter phone number',
        selectRole: 'Select Role',
        selectRegion: 'Select Region',
        selectSupervisor: 'Select Supervisor',
        sitePlaceholder: 'Site A, Site B',
        fieldOfficer: 'Field Officer',
        supervisor: 'Supervisor',
        manager: 'Manager',
        day: 'Day',
        night: 'Night',
        flexible: 'Flexible',
        north: 'North',
        south: 'South',
        east: 'East',
        west: 'West',
        central: 'Central',
        active: 'Active',
        inactive: 'Inactive',
        status: 'Status',
        actions: 'Actions',
        create: '➕ Create User',
        creating: 'Creating...',
        deactivate: '🔴 Deactivate',
        activate: '🟢 Activate',
        delete: '🗑️ Delete',
        userExists: 'User with this email already exists!',
        fillRequired: 'Please fill all required fields',
        createSuccess: '✅ User {name} created successfully!',
        createError: '❌ Error creating user: {error}',
        employeeId: 'Employee ID',
        name: 'Name',
        email: 'Email',
        role: 'Role',
        region: 'Region',
        shift: 'Shift'
      }
    }
  },
  am: {
    name: 'Amharic',
    nativeName: 'አማርኛ',
    translations: {
      userManagement: {
        title: 'የተጠቃሚ አስተዳደር',
        createUser: 'አዲስ ተጠቃሚ ፍጠር',
        createUserSub: 'አዲስ የመስክ ኦፊሰር ወይም ተቆጣጣሪ ያክሉ',
        totalUsers: 'ጠቅላላ: {count} ተጠቃሚዎች',
        allUsers: 'ሁሉም ተጠቃሚዎች',
        noUsers: 'ምንም ተጠቃሚዎች አልተገኙም',
        fullName: 'ሙሉ ስም *',
        password: 'የይለፍ ቃል *',
        phone: 'ስልክ',
        department: 'መምሪያ',
        assignedSites: 'የተመደቡ ቦታዎች',
        enterName: 'ሙሉ ስም ያስገቡ',
        enterEmail: 'ኢሜይል ያስገቡ',
        enterPassword: 'ቢያንስ 6 ቁምፊዎች',
        enterPhone: 'ስልክ ቁጥር ያስገቡ',
        selectRole: 'ሚና ይምረጡ',
        selectRegion: 'ክልል ይምረጡ',
        selectSupervisor: 'ተቆጣጣሪ ይምረጡ',
        sitePlaceholder: 'ቦታ ሀ, ቦታ ለ',
        fieldOfficer: 'የመስክ ኦፊሰር',
        supervisor: 'ተቆጣጣሪ',
        manager: 'አስተዳዳሪ',
        day: 'ቀን',
        night: 'ሌሊት',
        flexible: 'ተለዋዋጭ',
        north: 'ሰሜን',
        south: 'ደቡብ',
        east: 'ምስራቅ',
        west: 'ምዕራብ',
        central: 'ማእከላዊ',
        active: 'ንቁ',
        inactive: 'እንቅስቃሴ የለሽ',
        status: 'ሁኔታ',
        actions: 'ተግባሮች',
        create: '➕ ተጠቃሚ ፍጠር',
        creating: 'በመፍጠር ላይ...',
        deactivate: '🔴 አቦዝን',
        activate: '🟢 አንቃ',
        delete: '🗑️ አጥፋ',
        userExists: 'በዚህ ኢሜይል የተመዘገበ ተጠቃሚ አለ!',
        fillRequired: 'እባክዎ ሁሉንም አስፈላጊ መስኮች ይሙሉ',
        createSuccess: '✅ ተጠቃሚ {name} በተሳካ ሁኔታ ተፈጥሯል!',
        createError: '❌ ተጠቃሚ በመፍጠር ላይ ስህተት: {error}',
        employeeId: 'የሰራተኛ መታወቂያ',
        name: 'ስም',
        email: 'ኢሜይል',
        role: 'ሚና',
        region: 'ክልል',
        shift: 'ፈረቃ'
      }
    }
  },
  ti: {
    name: 'Tigrinya',
    nativeName: 'ትግርኛ',
    translations: {
      userManagement: {
        title: 'የተጠቃሚ አስተዳደር',
        createUser: 'አዲስ ተጠቃሚ ፍጠር',
        createUserSub: 'አዲስ የመስክ ኦፊሰር ወይም ተቆጣጣሪ ያክሉ',
        totalUsers: 'ጠቅላላ: {count} ተጠቃሚዎች',
        allUsers: 'ሁሉም ተጠቃሚዎች',
        noUsers: 'ምንም ተጠቃሚዎች አልተገኙም',
        fullName: 'ሙሉ ስም *',
        password: 'የይለፍ ቃል *',
        phone: 'ስልክ',
        department: 'መምሪያ',
        assignedSites: 'የተመደቡ ቦታዎች',
        enterName: 'ሙሉ ስም ያስገቡ',
        enterEmail: 'ኢሜይል ያስገቡ',
        enterPassword: 'ቢያንስ 6 ቁምፊዎች',
        enterPhone: 'ስልክ ቁጥር ያስገቡ',
        selectRole: 'ሚና ይምረጡ',
        selectRegion: 'ክልል ይምረጡ',
        selectSupervisor: 'ተቆጣጣሪ ይምረጡ',
        sitePlaceholder: 'ቦታ ሀ, ቦታ ለ',
        fieldOfficer: 'የመስክ ኦፊሰር',
        supervisor: 'ተቆጣጣሪ',
        manager: 'አስተዳዳሪ',
        day: 'ቀን',
        night: 'ሌሊት',
        flexible: 'ተለዋዋጭ',
        north: 'ሰሜን',
        south: 'ደቡብ',
        east: 'ምስራቅ',
        west: 'ምዕራብ',
        central: 'ማእከላዊ',
        active: 'ንቁ',
        inactive: 'እንቅስቃሴ የለሽ',
        status: 'ሁኔታ',
        actions: 'ተግባሮች',
        create: '➕ ተጠቃሚ ፍጠር',
        creating: 'በመፍጠር ላይ...',
        deactivate: '🔴 አቦዝን',
        activate: '🟢 አንቃ',
        delete: '🗑️ አጥፋ',
        userExists: 'በዚህ ኢሜይል የተመዘገበ ተጠቃሚ አለ!',
        fillRequired: 'እባክዎ ሁሉንም አስፈላጊ መስኮች ይሙሉ',
        createSuccess: '✅ ተጠቃሚ {name} በተሳካ ሁኔታ ተፈጥሯል!',
        createError: '❌ ተጠቃሚ በመፍጠር ላይ ስህተት: {error}',
        employeeId: 'የሰራተኛ መታወቂያ',
        name: 'ስም',
        email: 'ኢሜይል',
        role: 'ሚና',
        region: 'ክልል',
        shift: 'ፈረቃ'
      }
    }
  },
  om: {
    name: 'Oromo',
    nativeName: 'Afaan Oromoo',
    translations: {
      userManagement: {
        title: 'Trolluu Fayyaa',
        createUser: 'Fayyaa Haaraa Kuddle',
        createUserSub: 'Fayyaa Albaa kan kuddle yookan iysootaaf kuddle',
        totalUsers: 'Waliigalaa: {count} Fayyaa',
        allUsers: 'Hundi Fayyaa',
        noUsers: 'Fayyaa hin argamne',
        fullName: 'Maqaa Dhuunfaa *',
        password: 'Jecha Darbaa *',
        phone: 'Bilbila',
        department: 'Kutaa',
        assignedSites: 'Naannoo Iyyatame',
        enterName: 'Maqaa dhuunfaa galchaa',
        enterEmail: 'Imeelii galchaa',
        enterPassword: 'Lixxoo 6 naqa',
        enterPhone: 'Lakkoolessa bilbilaa galchaa',
        selectRole: 'Gosa Filadhoo',
        selectRegion: 'Naannoo Filadhoo',
        selectSupervisor: 'Iyyataa Filadhoo',
        sitePlaceholder: 'Naannoo A, Naannoo B',
        fieldOfficer: 'Hayyuu Albaa',
        supervisor: 'Iyyataa',
        manager: 'Bulchaa',
        day: 'Baga',
        night: 'Hamaro',
        flexible: 'Jijjiiramaa',
        north: 'Amajjii',
        south: 'Kibba',
        east: 'Baha',
        west: 'Dhiha',
        central: 'Giddugaleessa',
        active: 'Sooftuu',
        inactive: 'Sooftuu hin jiru',
        status: 'Haala',
        actions: 'Tarkaanfii',
        create: '➕ Fayyaa Kuddle',
        creating: 'Kuddle jedha...',
        deactivate: '🔴 Dhaamsi',
        activate: '🟢 Eegali',
        delete: '🗑️ Haquu',
        userExists: 'Imeelii kanaan Fayyaa yeroo dura galmaa\'e jira!',
        fillRequired: 'Fayyaa galmaa\'u dhuftuu hundi guuti',
        createSuccess: '✅ Fayyaa {name} milkaa\'inaan kuffame!',
        createError: '❌ Fayyaa kuddle yeroo sobii: {error}',
        employeeId: ' Ezraayya Hojjetuu',
        name: 'Maqaa',
        email: 'Imeelii',
        role: 'Gosa',
        region: 'Naannoo',
        shift: 'Yommuu'
      }
    }
  }
};

const defaultUserLanguage = 'en';

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