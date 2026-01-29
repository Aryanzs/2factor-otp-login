// =====================================================
// Login Page Component
// Premium OTP Authentication UI
// =====================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

// Country codes data
const countryCodes = [
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
];

// API Base URL
const API_URL = 'http://localhost:5000/api';

function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  
  // States
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  // Refs
  const otpRefs = useRef([]);
  const phoneInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Auto-focus phone input on mount
  useEffect(() => {
    if (phoneInputRef.current && step === 'phone') {
      phoneInputRef.current.focus();
    }
  }, [step]);

  // Focus first OTP input when step changes to OTP
  useEffect(() => {
    if (step === 'otp' && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle phone number input
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(value);
    setError('');
  };

  // Handle country selection
  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    phoneInputRef.current?.focus();
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, 5);
      otpRefs.current[nextIndex]?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    // Validate phone number
    if (phoneNumber.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    // Only India supported for now
    if (selectedCountry.code !== '+91') {
      setError('Currently only Indian phone numbers (+91) are supported');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/send-otp`, {
        phoneNumber: phoneNumber
      });

      if (response.data.success) {
        setSuccess('OTP sent successfully!');
        setStep('otp');
        setResendTimer(30);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Send OTP Error:', err);
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/verify-otp`, {
        phoneNumber: phoneNumber,
        otp: otpValue
      });

      if (response.data.success && response.data.verified) {
        setSuccess('Login successful! Redirecting...');
        
        // Call parent success handler
        setTimeout(() => {
          onLoginSuccess(phoneNumber);
          navigate('/dashboard');
        }, 1000);
      }
    } catch (err) {
      console.error('Verify OTP Error:', err);
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/resend-otp`, {
        phoneNumber: phoneNumber
      });

      if (response.data.success) {
        setSuccess('New OTP sent!');
        setOtp(['', '', '', '', '', '']);
        setResendTimer(30);
        otpRefs.current[0]?.focus();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Go back to phone step
  const handleBack = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setSuccess('');
  };

  return (
    <div className="login-page page-enter">
      <div className="login-container">
        {/* Logo & Header */}
        <div className="login-header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="logo-text">SecureAuth</span>
          </div>
          
          <h1 className="login-title">
            {step === 'phone' ? 'Welcome back' : 'Verify your phone'}
          </h1>
          <p className="login-subtitle">
            {step === 'phone' 
              ? 'Enter your phone number to continue' 
              : `We've sent a code to ${selectedCountry.code} ${phoneNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}`
            }
          </p>
        </div>

        {/* Form Card */}
        <div className="login-card">
          {/* Messages */}
          {error && (
            <div className="message message-error">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="message message-success">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Phone Number Step */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <div className="phone-input-wrapper">
                  {/* Country Code Dropdown */}
                  <div className="country-selector" ref={dropdownRef}>
                    <button
                      type="button"
                      className="country-button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    >
                      <span className="country-flag">{selectedCountry.flag}</span>
                      <span className="country-code">{selectedCountry.code}</span>
                      <svg className="dropdown-arrow" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                    
                    {showCountryDropdown && (
                      <div className="country-dropdown">
                        {countryCodes.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            className={`country-option ${selectedCountry.code === country.code ? 'active' : ''}`}
                            onClick={() => handleCountrySelect(country)}
                          >
                            <span className="country-flag">{country.flag}</span>
                            <span className="country-name">{country.name}</span>
                            <span className="country-code">{country.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Phone Input */}
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    className="phone-input"
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                <span className="form-hint">We'll send you a verification code</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || phoneNumber.length !== 10}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Continue
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="login-form">
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <div className="otp-input-wrapper">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-input ${digit ? 'filled' : ''}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      disabled={loading}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>
                
                {/* Resend OTP */}
                <div className="resend-wrapper">
                  {resendTimer > 0 ? (
                    <span className="resend-timer">
                      Resend code in <strong>{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="resend-button"
                      onClick={handleResendOtp}
                      disabled={loading}
                    >
                      Didn't receive code? <strong>Resend</strong>
                    </button>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleBack}
                  disabled={loading}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
                  </svg>
                  Back
                </button>
                
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || otp.join('').length !== 6}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner"></span>
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Login
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></p>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="decorative-orb orb-1"></div>
      <div className="decorative-orb orb-2"></div>
    </div>
  );
}

export default Login;