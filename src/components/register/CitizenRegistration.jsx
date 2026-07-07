// components/register/CitizenRegistration.js

import React, { useState, useEffect } from 'react';
import { db, syncQueue, checkRealInternet } from '../../services/database';
import { uid } from '../../utils/helpers';

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
    offlineMessage: 'Citizens will be saved locally and synced automatically when online.'
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
    offlineMessage: 'ዜጎች በአካባቢው ይቀመጣሉ እና በመስመር ላይ ሲሆኑ በራስ-ሰር ይመሳሰላሉ።'
  },
  om: {
    title: '🆔 Firoota Magaalaa Sabaa Qabaachuuf Galmeessaa',
    subtitle: 'Odeeffannoo Firoota galmeessuu Magaalaa Sabaa qabaachuuf',
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
    offlineMessage: 'Firoonni naannoo keessatti qusatamanii yeroo online ta\'an ofiifuu wal qabsiifamu.'
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
    offlineMessage: 'ዜጋታት ብአካባቢ ይቅመጡ እዮም እሞ መስመር ምስ ተመልሰ ብራሱ ይመሳሰሉ።'
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Get translations
  const t = translations[language] || translations.en;

  // Language options - ALL 4 LANGUAGES
  const languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'am', label: '🇪🇹 አማርኛ' },
    { code: 'om', label: '🇪🇹 Afaan Oromoo' },
    { code: 'ti', label: '🇪🇹 ትግርኛ' }
  ];

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.region) {
      alert('Please fill in all required fields');
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
        idType: form.idType || 'National ID',
        idNumber: form.idNumber.trim() || '',
        biometrics: form.biometrics || false,
        status: 'active',
        createdAt: new Date().toISOString(),
        synced: online ? true : false
      };

      await db.citizens.add(newCitizen);
      
      if (setCitizens) {
        setCitizens(prev => [newCitizen, ...prev]);
      }

      if (!online) {
        syncQueue.add({
          type: 'citizen',
          id: newCitizen.id,
          data: newCitizen
        });
        setPendingCount(syncQueue.count());
        setSuccessMessage(`${t.offlineSuccess}\n\n${newCitizen.firstName} ${newCitizen.lastName}\n🆔 ${nationalId}`);
        setShowSuccess(true);
      } else {
        setSuccessMessage(`${t.success}\n\n${newCitizen.firstName} ${newCitizen.lastName}\n🆔 ${nationalId}`);
        setShowSuccess(true);
      }
      
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
          idType: 'National ID',
          idNumber: '',
          biometrics: false
        });
        setShowSuccess(false);
      }, 4000);
      
    } catch (error) {
      console.error('Error:', error);
      alert(t.error + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setShowSuccess(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '900px', 
      margin: '0 auto',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* ===== STATUS BAR ===== */}
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
          <span style={{ 
            fontWeight: '600', 
            fontSize: '14px',
            color: isOnline ? '#166534' : '#991b1b'
          }}>
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
          {/* ===== LANGUAGE SELECTOR - ALL 4 LANGUAGES ===== */}
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

      {/* ===== OFFLINE BANNER ===== */}
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

      {/* ===== SUCCESS MESSAGE ===== */}
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

      {/* ===== REGISTRATION FORM ===== */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        {/* Form Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa'
        }}>
          <h3 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#111827'
          }}>
            {t.title}
          </h3>
          <p style={{ 
            margin: '0', 
            color: '#6b7280', 
            fontSize: '14px'
          }}>
            {t.subtitle}
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px' }}>
          <form onSubmit={handleSubmit}>
            {/* Row 1: First Name & Last Name */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                />
              </div>
            </div>

            {/* Row 2: Date of Birth & Gender */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  {t.dateOfBirth}
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  {t.gender}
                </label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                >
                  <option value="">{t.selectGender}</option>
                  <option value="Male">{t.male}</option>
                  <option value="Female">{t.female}</option>
                  <option value="Other">{t.other}</option>
                </select>
              </div>
            </div>

            {/* Row 3: Phone & Email */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            {/* Row 4: Region & District */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  {t.region}
                </label>
                <select
                  name="region"
                  value={form.region}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                >
                  <option value="">{t.selectRegion}</option>
                  <option value="North">{t.north}</option>
                  <option value="South">{t.south}</option>
                  <option value="East">{t.east}</option>
                  <option value="West">{t.west}</option>
                  <option value="Central">{t.central}</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            {/* Row 5: Village & Address */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            {/* Row 6: Occupation & Marital Status */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
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

            {/* Row 7: ID Type & ID Number */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  {t.idType}
                </label>
                <select
                  name="idType"
                  value={form.idType}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'white',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                >
                  <option value="National ID">{t.nationalId}</option>
                  <option value="Birth Certificate">{t.birthCertificate}</option>
                  <option value="Passport">{t.passport}</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
                  {t.idNumber}
                </label>
                <input
                  type="text"
                  name="idNumber"
                  value={form.idNumber}
                  onChange={handleChange}
                  placeholder={t.idNumberPlaceholder}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            {/* Row 8: Biometrics */}
            <div style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label style={{ 
                  display: 'block', 
                  fontWeight: '500', 
                  marginBottom: '6px', 
                  fontSize: '14px',
                  color: '#374151'
                }}>
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
                    transition: 'border-color 0.15s ease',
                    outline: 'none'
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
                disabled={isSubmitting}
                style={{
                  padding: '12px 32px',
                  background: isOnline ? '#0b7e4b' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'background 0.2s ease',
                  flex: '1',
                  minWidth: '180px',
                  maxWidth: '280px'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.target.style.background = isOnline ? '#0a6a3f' : '#d97706';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
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