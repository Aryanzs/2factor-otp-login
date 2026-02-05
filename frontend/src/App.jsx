// =====================================================
// OTP Login System - Main App Component
// =====================================================

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WhatsAppLogin from './pages/WhatsAppLogin';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = localStorage.getItem('isAuthenticated');
      const phone = localStorage.getItem('userPhone');
      
      if (authStatus === 'true' && phone) {
        setIsAuthenticated(true);
        setUserPhone(phone);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Handle successful login
  const handleLoginSuccess = (phoneNumber) => {
    setIsAuthenticated(true);
    setUserPhone(phoneNumber);
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userPhone', phoneNumber);
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserPhone('');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userPhone');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        {/* Background Effects */}
        <div className="bg-gradient"></div>
        <div className="bg-noise"></div>
        <div className="bg-grid"></div>
        
        <Routes>
          {/* Login Route */}
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
              )
            } 
          />
          {/* WhatsApp Login Route  */}
          <Route 
            path="/login/whatsapp" 
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <WhatsAppLogin onLoginSuccess={handleLoginSuccess} />
              )
            } 
          />
          {/* Meta WhatsApp Login Route */}
            <Route 
              path="/login/whatsapp-meta" 
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <WhatsAppLogin onLoginSuccess={handleLoginSuccess} apiType="whatsapp-meta" />
                )
              } 
            />
          
          {/* Dashboard Route (Protected) */}
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? (
                <Dashboard userPhone={userPhone} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;