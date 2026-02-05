// =====================================================
// WhatsApp Login Page Component
// Premium WhatsApp OTP Authentication UI
// =====================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './WhatsAppLogin.css';

// Country codes data
const countryCodes = [
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
];

// API Base URL for WhatsApp
const API_URLS = {
  'whatsapp': 'http://localhost:5000/api/whatsapp',
  'whatsapp-meta': 'http://localhost:5000/api/whatsapp-meta'
};
function WhatsAppLogin({ onLoginSuccess, apiType = 'whatsapp' }) {
  const API_URL = API_URLS[apiType] || API_URLS['whatsapp'];

  const navigate = useNavigate();
  
  // States
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
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
    if (value && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    
    if (pastedData.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length && i < 4; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, 3);
      otpRefs.current[nextIndex]?.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Send OTP via WhatsApp
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
        setSuccess('OTP sent to your WhatsApp!');
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
    
    if (otpValue.length !== 4) {
      setError('Please enter the complete 4-digit OTP');
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
        
        // Store auth method
          localStorage.setItem('authMethod', apiType);        
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
      setOtp(['', '', '', '']);
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
        setSuccess('New OTP sent to WhatsApp!');
        setOtp(['', '', '', '']);
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
    setOtp(['', '', '', '']);
    setError('');
    setSuccess('');
  };

  // Go back to SMS login
  const handleBackToSMS = () => {
    navigate('/');
  };

  return (
    <div className="whatsapp-login-page page-enter">
      <div className="whatsapp-login-container">
        {/* Logo & Header */}
        <div className="whatsapp-login-header">
          <div className="whatsapp-logo">
            <div className="whatsapp-logo-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <span className="whatsapp-logo-text">WhatsApp Login</span>
          </div>
          
        <h1 className="whatsapp-login-title">
          {step === 'phone' 
            ? `Login with ${apiType === 'whatsapp-meta' ? 'WhatsApp (Meta)' : 'WhatsApp'}` 
            : 'Enter verification code'}
        </h1>
          <p className="whatsapp-login-subtitle">
            {step === 'phone' 
              ? 'We\'ll send you a verification code on WhatsApp' 
              : `Check your WhatsApp for OTP sent to ${selectedCountry.code} ${phoneNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}`
            }
          </p>
        </div>

        {/* Form Card */}
        <div className="whatsapp-login-card">
          {/* Messages */}
          {error && (
            <div className="wa-message wa-message-error">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="wa-message wa-message-success">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Phone Number Step */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="whatsapp-login-form">
              <div className="wa-form-group">
                <label className="wa-form-label">WhatsApp Number</label>
                <div className="wa-phone-input-wrapper">
                  {/* Country Code Dropdown */}
                  <div className="wa-country-selector" ref={dropdownRef}>
                    <button
                      type="button"
                      className="wa-country-button"
                      onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    >
                      <span className="wa-country-flag">{selectedCountry.flag}</span>
                      <span className="wa-country-code">{selectedCountry.code}</span>
                      <svg className="wa-dropdown-arrow" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                    
                    {showCountryDropdown && (
                      <div className="wa-country-dropdown">
                        {countryCodes.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            className={`wa-country-option ${selectedCountry.code === country.code ? 'active' : ''}`}
                            onClick={() => handleCountrySelect(country)}
                          >
                            <span className="wa-country-flag">{country.flag}</span>
                            <span className="wa-country-name">{country.name}</span>
                            <span className="wa-country-code">{country.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Phone Input */}
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    className="wa-phone-input"
                    placeholder="Enter WhatsApp number"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                <span className="wa-form-hint">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  OTP will be sent to this WhatsApp number
                </span>
              </div>

              <button
                type="submit"
                className="wa-btn wa-btn-primary"
                disabled={loading || phoneNumber.length !== 10}
              >
                {loading ? (
                  <>
                    <span className="wa-btn-spinner"></span>
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Send OTP
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
            <form onSubmit={handleVerifyOtp} className="whatsapp-login-form">
              <div className="wa-form-group">
                <label className="wa-form-label">Verification Code</label>
                <div className="wa-otp-input-wrapper">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`wa-otp-input ${digit ? 'filled' : ''}`}
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
                <div className="wa-resend-wrapper">
                  {resendTimer > 0 ? (
                    <span className="wa-resend-timer">
                      Resend code in <strong>{resendTimer}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="wa-resend-button"
                      onClick={handleResendOtp}
                      disabled={loading}
                    >
                      Didn't receive code? <strong>Resend</strong>
                    </button>
                  )}
                </div>
              </div>

              <div className="wa-form-actions">
                <button
                  type="button"
                  className="wa-btn wa-btn-secondary"
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
                  className="wa-btn wa-btn-primary"
                  disabled={loading || otp.join('').length !== 4}
                >
                  {loading ? (
                    <>
                      <span className="wa-btn-spinner"></span>
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

        {/* Back to SMS Login */}
        <div className="wa-alt-login">
          <button 
            type="button" 
            className="wa-back-to-sms"
            onClick={handleBackToSMS}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"/>
            </svg>
            Login with SMS instead
          </button>
        </div>

        {/* Footer */}
        <div className="whatsapp-login-footer">
          <p>By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></p>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="wa-decorative-orb wa-orb-1"></div>
      <div className="wa-decorative-orb wa-orb-2"></div>
    </div>
  );
}

export default WhatsAppLogin;