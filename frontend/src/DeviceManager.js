import React, { useState, useEffect } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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
      (position) => {
        setForm({
          ...form,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        alert('GPS coordinates added!');
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
            
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            
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

      {devices.some(d => d.latitude && d.longitude) && (
        <div className="map-section">
          <h3>🗺️ Device Locations</h3>
          <div className="map-container">
            <MapContainer center={[0, 0]} zoom={2} style={{ height: '400px', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {devices.map(device => (
                device.latitude && device.longitude ? (
                  <Marker
                    key={device.id}
                    position={[device.latitude, device.longitude]}
                  >
                    <Popup>
                      <div>
                        <strong>{device.name}</strong><br />
                        Status: {device.status}<br />
                        {device.location && `Location: ${device.location}`}
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}