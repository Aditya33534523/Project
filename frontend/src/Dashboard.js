import React, { useEffect, useState } from "react";
import API from "./api";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ onLogout }) {
  const [stats, setStats] = useState({ total: 0, lost: 0, found: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get('/devices/stats');
        setStats(res.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    onLogout();
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1>📊 Dashboard</h1>
          <p>Welcome back, {localStorage.getItem('username')}</p>
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate('/app')}>📱 Devices</button>
          <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
        </div>
      </header>

      <div className="stats-container">
        <div className="stat-card total">
          <h3>📱 Total Devices</h3>
          <div className="stat-number">{stats.total}</div>
          <p>All tracked items</p>
        </div>

        <div className="stat-card lost">
          <h3>🔴 Lost Items</h3>
          <div className="stat-number">{stats.lost}</div>
          <p>Still searching</p>
        </div>

        <div className="stat-card found">
          <h3>🟢 Found Items</h3>
          <div className="stat-number">{stats.found}</div>
          <p>Successfully recovered</p>
        </div>
      </div>

      <div className="dashboard-actions">
        <button onClick={() => navigate('/app')} className="primary-btn">
          📱 Manage Devices
        </button>
      </div>
    </div>
  );
}