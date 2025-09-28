import React, { useState, useEffect } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different statuses
const lostIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const foundIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
  const [trackingDevice, setTrackingDevice] = useState(null);
  const [trackingRoute, setTrackingRoute] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const navigate = useNavigate();

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

  // Location search using Nominatim (OpenStreetMap)
  const searchLocation = async (query) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching location:', error);
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
  const startTracking = (device) => {
    if (device.status !== 'lost') {
      alert('Only lost devices can be tracked!');
      return;
    }

    setTrackingDevice(device);
    setTrackingRoute([]);
    setIsTracking(true);

    // Simulate tracking route (in real app, this would come from GPS tracking)
    simulateTrackingRoute(device);
  };

  // Simulate GPS tracking route for lost device
  const simulateTrackingRoute = (device) => {
    if (!device.latitude || !device.longitude) {
      alert('Device location not available for tracking');
      return;
    }

    const startLat = device.latitude;
    const startLng = device.longitude;
    const route = [[startLat, startLng]];

    // Simulate movement pattern (in real app, this would be real GPS data)
    let currentLat = startLat;
    let currentLng = startLng;

    const trackingInterval = setInterval(() => {
      // Random walk simulation
      currentLat += (Math.random() - 0.5) * 0.001;
      currentLng += (Math.random() - 0.5) * 0.001;
      
      route.push([currentLat, currentLng]);
      setTrackingRoute([...route]);

      // Stop after 10 points (in real app, this would be continuous)
      if (route.length >= 10) {
        clearInterval(trackingInterval);
        setIsTracking(false);
      }
    }, 2000);

    // Store interval ID to clear it if needed
    setTrackingDevice({...device, trackingInterval});
  };

  const stopTracking = () => {
    if (trackingDevice?.trackingInterval) {
      clearInterval(trackingDevice.trackingInterval);
    }
    setIsTracking(false);
    setTrackingDevice(null);
    setTrackingRoute([]);
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

  // Calculate map center based on devices
  const getMapCenter = () => {
    const devicesWithLocation = devices.filter(d => d.latitude && d.longitude);
    if (devicesWithLocation.length === 0) return [0, 0];
    
    const avgLat = devicesWithLocation.reduce((sum, d) => sum + d.latitude, 0) / devicesWithLocation.length;
    const avgLng = devicesWithLocation.reduce((sum, d) => sum + d.longitude, 0) / devicesWithLocation.length;
    return [avgLat, avgLng];
  };

  return (
    <div className="device-manager">
      <header className="header">
        <div>
          <h1>📱 Lost & Found Tracker</h1>
          <p>Welcome, {localStorage.getItem('username')}</p>
        </div>
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
            
            <div className="location-input-container">
              <input
                placeholder="Location (type to search...)"
                value={form.location}
                onChange={(e) => {
                  setForm({ ...form, location: e.target.value });
                  searchLocation(e.target.value);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="location-suggestions">
                  {locationSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="location-suggestion"
                      onClick={() => selectLocation(suggestion)}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
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
            
            <div className="form-row">
              <input
                placeholder="Latitude"
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              />
              <input
                placeholder="Longitude"
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              />
              <button type="button" onClick={useGPS}>📍 Use GPS</button>
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
                        disabled={isTracking}
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
            <p>Status: {isTracking ? '🔄 Active' : '⏸️ Stopped'}</p>
            <p>Route Points: {trackingRoute.length}</p>
          </div>
          <div className="tracking-controls">
            {isTracking ? (
              <button onClick={stopTracking} className="stop-tracking-btn">
                ⏹️ Stop Tracking
              </button>
            ) : (
              <button onClick={() => simulateTrackingRoute(trackingDevice)} className="start-tracking-btn">
                ▶️ Resume Tracking
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Map with Tracking */}
      {devices.some(d => d.latitude && d.longitude) && (
        <div className="map-section">
          <h3>🗺️ Device Locations & Tracking</h3>
          <div className="map-container">
            <MapContainer 
              center={getMapCenter()} 
              zoom={trackingDevice ? 15 : 10} 
              style={{ height: '500px', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {/* Device Markers */}
              {devices.map(device => (
                device.latitude && device.longitude ? (
                  <Marker
                    key={device.id}
                    position={[device.latitude, device.longitude]}
                    icon={device.status === 'lost' ? lostIcon : foundIcon}
                  >
                    <Popup>
                      <div>
                        <strong>{device.name}</strong><br />
                        Status: <span className={device.status}>{device.status.toUpperCase()}</span><br />
                        {device.location && `Location: ${device.location}`}<br />
                        {device.status === 'lost' && (
                          <button
                            onClick={() => startTracking(device)}
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
                    </Popup>
                  </Marker>
                ) : null
              ))}

              {/* Tracking Route */}
              {trackingRoute.length > 1 && (
                <Polyline
                  positions={trackingRoute}
                  color="#ff4444"
                  weight={3}
                  opacity={0.8}
                  dashArray="10, 5"
                />
              )}

              {/* Current tracking position */}
              {trackingRoute.length > 0 && (
                <Marker
                  position={trackingRoute[trackingRoute.length - 1]}
                  icon={new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
                    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <div>
                      <strong>📍 Current Position</strong><br />
                      Device: {trackingDevice?.name}<br />
                      Status: {isTracking ? 'Tracking Active' : 'Last Known Position'}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}