import React, { useState, useEffect, useCallback } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, DirectionsService } from '@react-google-maps/api';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // Replace with your actual API key

// Map container styles
const mapContainerStyle = {
  width: '100%',
  height: '400px',
  marginTop: '20px',
  borderRadius: '8px'
};

// Default center position (can be adjusted)
const center = {
  lat: 40.7128,
  lng: -74.0060
};

// Map options
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true
};

export default function DeviceManager({ onLogout }) {
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    name: '', 
    description: '', 
    category: '', 
    location: '', 
    status: 'lost', 
    latitude: '', 
    longitude: ''
  });
  const [loading, setLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingDevice, setTrackingDevice] = useState(null);
  const [directions, setDirections] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [sourceLocation, setSourceLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const navigate = useNavigate();
  
  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"]
  });

  const fetchDevices = async () => {
    try {
      const res = await API.get('/devices');
      setDevices(res.data);
    } catch (e) {
      console.error('Error fetching devices:', e);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // Enhanced location search using Nominatim (OpenStreetMap)
  const searchLocation = async (query) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowSuggestions(true);
      setIsSearching(false);
    } catch (error) {
      console.error('Error searching location:', error);
      setIsSearching(false);
    }
  };

  const selectLocation = (location) => {
    setForm({
      ...form,
      location: location.display_name,
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon)
    });
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  // Start tracking a lost device
  // Track device with Google Maps directions
  const startTracking = (device) => {
    if (device.status !== 'lost') {
      alert('Only lost devices can be tracked!');
      return;
    }

    // Set the device as destination
    setTrackingDevice(device);
    setDestinationLocation({
      lat: parseFloat(device.latitude),
      lng: parseFloat(device.longitude)
    });
    
    // Use current location as source if available, otherwise use a default
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSourceLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // If geolocation fails, use a default location
          alert('Could not get your location. Using default source location.');
          setSourceLocation(center); // Use the default center defined above
        }
      );
    } else {
      alert('Geolocation is not supported by your browser. Using default source location.');
      setSourceLocation(center);
    }
  };

  // Handle directions result
  const directionsCallback = useCallback((result) => {
    if (result !== null && result.status === 'OK') {
      setDirections(result);
    } else {
      console.error('Directions request failed:', result);
    }
  }, []);

  // Stop tracking and clear directions
  const stopTracking = () => {
    setTrackingDevice(null);
    setSourceLocation(null);
    setDestinationLocation(null);
    setDirections(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await API.post('/devices', form);
      setDevices([res.data, ...devices]);
      setForm({
        name: '', 
        description: '', 
        category: '', 
        location: '', 
        status: 'lost', 
        latitude: '', 
        longitude: ''
      });
      alert('Device added successfully!');
    } catch (err) {
      alert('Failed to add device: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    
    try {
      await API.delete(`/devices/${id}`);
      setDevices(devices.filter(d => d.id !== id));
      alert('Device deleted successfully!');
    } catch (err) {
      alert('Failed to delete device');
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'lost' ? 'found' : 'lost';
    
    try {
      await API.patch(`/devices/${id}/status`, { status: newStatus });
      setDevices(devices.map(d => 
        d.id === id ? { ...d, status: newStatus } : d
      ));
      alert(`Device marked as ${newStatus}!`);
      
      // Stop tracking if device is found
      if (newStatus === 'found' && trackingDevice?.id === id) {
        stopTracking();
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const useGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Reverse geocoding to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          
          setForm({
            ...form,
            latitude: lat,
            longitude: lng,
            location: data.display_name || `${lat}, ${lng}`
          });
          alert('GPS coordinates and address added!');
        } catch (error) {
          setForm({
            ...form,
            latitude: lat,
            longitude: lng,
            location: `${lat}, ${lng}`
          });
          alert('GPS coordinates added!');
        }
      },
      () => alert("Unable to retrieve your location")
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    onLogout();
  };

  // Map center is now defined as a constant at the top of the file

  return (
    <div className="device-manager">
      <header className="header">
        <div>
          <h1>📱 Lost & Found Tracker</h1>
          <p>Welcome, {localStorage.getItem('username')}</p>
        </div>
      
      {/* Google Maps Component */}
      {isLoaded && (
        <div className="map-container">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={10}
            options={mapOptions}
          >
            {/* Display markers for all devices */}
            {devices.map((device) => (
              <Marker
                key={device.id}
                position={{
                  lat: parseFloat(device.latitude),
                  lng: parseFloat(device.longitude)
                }}
                icon={{
                  url: device.status === 'lost' 
                    ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                    : 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                }}
                onClick={() => setSelectedMarker(device)}
              />
            ))}

            {/* Info window for selected marker */}
            {selectedMarker && (
              <InfoWindow
                position={{
                  lat: parseFloat(selectedMarker.latitude),
                  lng: parseFloat(selectedMarker.longitude)
                }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div className="info-window">
                  <h3>{selectedMarker.name}</h3>
                  <p>{selectedMarker.description}</p>
                  <p>Status: {selectedMarker.status === 'lost' ? '❌ Lost' : '✅ Found'}</p>
                  <p>Location: {selectedMarker.location}</p>
                  {selectedMarker.status === 'lost' && (
                    <button onClick={() => startTracking(selectedMarker)}>
                      🔍 Track This Device
                    </button>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* Directions renderer */}
            {sourceLocation && destinationLocation && (
              <DirectionsService
                options={{
                  destination: destinationLocation,
                  origin: sourceLocation,
                  travelMode: 'DRIVING'
                }}
                callback={directionsCallback}
              />
            )}
            
            {directions && (
              <DirectionsRenderer
                options={{
                  directions: directions
                }}
              />
            )}
          </GoogleMap>
          
          {trackingDevice && (
            <div className="tracking-controls">
              <h3>Tracking: {trackingDevice.name}</h3>
              <button onClick={stopTracking}>Stop Tracking</button>
            </div>
          )}
        </div>
      )}
        <div className="header-buttons">
          <button onClick={() => navigate('/dashboard')}>📊 Dashboard</button>
          <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
        </div>
      </header>

      <div className="content">
        <div className="form-section">
          <form onSubmit={handleSubmit} className="device-form">
            <h3>➕ Add New Device</h3>
            
            <input
              placeholder="Device name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            
            <input
              placeholder="Category (phone, laptop, etc.)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            
            <div className="form-row location-search-container">
              <div className="search-input-wrapper">
                <input
                  placeholder="Enter city or address"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchLocation(e.target.value);
                  }}
                  className="location-search-input"
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {isSearching && <div className="search-spinner"></div>}
                <button 
                  type="button" 
                  className="search-button"
                  onClick={() => searchLocation(searchQuery)}
                >
                  🔍
                </button>
              </div>
              
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="location-suggestions">
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="location-suggestion"
                      onClick={() => selectLocation(suggestion)}
                    >
                      <div className="suggestion-name">{suggestion.display_name}</div>
                      <div className="suggestion-coords">
                        {suggestion.lat}, {suggestion.lon}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <input
                placeholder="Selected Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="selected-location-input"
                readOnly
              />
              
              <button type="button" className="location-button" onClick={useGPS}>
                <span className="location-icon">📍</span> Use Current Location
              </button>
            </div>
            
            <div className="form-row">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="lost">🔴 Lost</option>
                <option value="found">🟢 Found</option>
              </select>
            </div>
            
            <div className="form-row coordinates-container">
              <div className="coordinates-inputs">
                <div className="coordinate-input-group">
                  <label>Latitude</label>
                  <input
                    placeholder="Latitude"
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    className="coordinate-input"
                  />
                </div>
                <div className="coordinate-input-group">
                  <label>Longitude</label>
                  <input
                    placeholder="Longitude"
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    className="coordinate-input"
                  />
                </div>
              </div>
            </div>
            
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : '✅ Add Device'}
            </button>
          </form>
        </div>

        <div className="devices-section">
          <h3>📋 Your Devices ({devices.length})</h3>
          
          {devices.length === 0 ? (
            <p>No devices added yet. Add one above!</p>
          ) : (
            <div className="devices-list">
              {devices.map(device => (
                <div key={device.id} className={`device-card ${device.status}`}>
                  <div className="device-info">
                    <h4>{device.name}</h4>
                    {device.description && <p>{device.description}</p>}
                    {device.category && <small>Category: {device.category}</small>}
                    {device.location && <small>Location: {device.location}</small>}
                    <small>Added: {new Date(device.created_at).toLocaleDateString()}</small>
                  </div>
                  
                  <div className="device-actions">
                    <span className={`status-badge ${device.status}`}>
                      {device.status === 'lost' ? '🔴 Lost' : '🟢 Found'}
                    </span>
                    <button 
                      onClick={() => handleStatusToggle(device.id, device.status)}
                      className="status-btn"
                    >
                      Mark as {device.status === 'lost' ? 'Found' : 'Lost'}
                    </button>
                    {device.status === 'lost' && device.latitude && device.longitude && (
                      <button
                        onClick={() => startTracking(device)}
                        className="track-btn"
                        disabled={trackingDevice !== null}
                      >
                        🔍 Track Device
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(device.id)}
                      className="delete-btn"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tracking Control Panel */}
      {trackingDevice && (
        <div className="tracking-panel">
          <div className="tracking-info">
            <h4>🔍 Tracking: {trackingDevice.name}</h4>
            <p>Status: {directions ? '🔄 Active' : '⏸️ Stopped'}</p>
          </div>
          <div className="tracking-controls">
            <button onClick={stopTracking} className="stop-tracking-btn">
              ⏹️ Stop Tracking
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Map with Google Maps */}
      {isLoaded && devices.some(d => d.latitude && d.longitude) && (
        <div className="map-section">
          <h3>🗺️ Device Locations & Tracking</h3>
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={trackingDevice ? 15 : 10}
              options={mapOptions}
            >
              {/* Device Markers */}
              {devices.map(device => (
                device.latitude && device.longitude ? (
                  <Marker
                    key={device.id}
                    position={{
                      lat: parseFloat(device.latitude),
                      lng: parseFloat(device.longitude)
                    }}
                    onClick={() => setSelectedMarker(device)}
                  />
                ) : null
              ))}

              {/* Selected Marker Info Window */}
              {selectedMarker && (
                <InfoWindow
                  position={{
                    lat: parseFloat(selectedMarker.latitude),
                    lng: parseFloat(selectedMarker.longitude)
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div>
                    <strong>{selectedMarker.name}</strong><br />
                    Status: <span className={selectedMarker.status}>{selectedMarker.status.toUpperCase()}</span><br />
                    {selectedMarker.location && `Location: ${selectedMarker.location}`}<br />
                    {selectedMarker.status === 'lost' && (
                      <button
                        onClick={() => startTracking(selectedMarker)}
                        style={{
                          marginTop: '10px',
                          padding: '5px 10px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        🔍 Start Tracking
                      </button>
                    )}
                  </div>
                </InfoWindow>
              )}

              {/* Directions */}
              {sourceLocation && destinationLocation && (
                <DirectionsService
                  options={{
                    destination: destinationLocation,
                    origin: sourceLocation,
                    travelMode: 'DRIVING'
                  }}
                  callback={directionsCallback}
                />
              )}

              {directions && (
                <DirectionsRenderer
                  options={{
                    directions: directions
                  }}
                />
              )}
             </GoogleMap>
           </div>
         </div>
       )}
    </div>
  );
}