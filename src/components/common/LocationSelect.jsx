import React, { useState } from 'react';
import LocationSelect from './LocationSelect'; // your component

const LocationForm = () => {
  const [formData, setFormData] = useState({
    country_id: '',
    region_id: '',
    zone_id: '',
    woreda_id: '',
    kebele_id: '',
    community_id: '',
  });

  // Handle selection from any LocationSelect
  const handleLocationSelect = (level, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [level + '_id']: value };

      // When a higher level changes, clear all lower levels
      switch (level) {
        case 'country':
          newData.region_id = '';
          newData.zone_id = '';
          newData.woreda_id = '';
          newData.kebele_id = '';
          newData.community_id = '';
          break;
        case 'region':
          newData.zone_id = '';
          newData.woreda_id = '';
          newData.kebele_id = '';
          newData.community_id = '';
          break;
        case 'zone':
          newData.woreda_id = '';
          newData.kebele_id = '';
          newData.community_id = '';
          break;
        case 'woreda':
          newData.kebele_id = '';
          newData.community_id = '';
          break;
        case 'kebele':
          // When kebele changes, clear community only
          newData.community_id = '';
          break;
        default:
          break;
      }
      return newData;
    });
  };

  return (
    <form>
      {/* Country – no parentId */}
      <LocationSelect
        level="country"
        selectedValue={formData.country_id}
        onSelect={handleLocationSelect}
      />

      {/* Region – parentId = country_id */}
      <LocationSelect
        level="region"
        parentId={formData.country_id}
        selectedValue={formData.region_id}
        onSelect={handleLocationSelect}
        disabled={!formData.country_id}
      />

      {/* Zone – parentId = region_id */}
      <LocationSelect
        level="zone"
        parentId={formData.region_id}
        selectedValue={formData.zone_id}
        onSelect={handleLocationSelect}
        disabled={!formData.region_id}
      />

      {/* Woreda – parentId = zone_id */}
      <LocationSelect
        level="woreda"
        parentId={formData.zone_id}
        selectedValue={formData.woreda_id}
        onSelect={handleLocationSelect}
        disabled={!formData.zone_id}
      />

      {/* Kebele – parentId = woreda_id */}
      <LocationSelect
        level="kebele"
        parentId={formData.woreda_id}
        selectedValue={formData.kebele_id}
        onSelect={handleLocationSelect}
        disabled={!formData.woreda_id}
      />

      {/* Community – parentId = kebele_id (this is the key!) */}
      <LocationSelect
        level="community"
        parentId={formData.kebele_id}   // ← This updates when kebele changes
        selectedValue={formData.community_id}
        onSelect={handleLocationSelect}
        disabled={!formData.kebele_id}
      />

      {/* Display current selections for debugging */}
      <pre>{JSON.stringify(formData, null, 2)}</pre>
    </form>
  );
};

export default LocationForm;