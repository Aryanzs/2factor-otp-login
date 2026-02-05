// =====================================================
// OTP Login System - Backend Server
// Using 2Factor SMS API for OTP Authentication
// =====================================================

// Import required packages
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// Initialize Express app
const app = express();

// =====================================================
// MIDDLEWARE CONFIGURATION
// =====================================================

// Enable CORS for frontend communication
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const PORT = process.env.PORT || 5000;
const API_KEY = process.env.API_KEY;
const SEND_OTP_URL = process.env.SEND_OTP_URL || 'https://2factor.in/API/R1/';
const VERIFY_OTP_URL = process.env.VERIFY_OTP_URL || 'https://2factor.in/API/V1';
const OTP_TEMPLATE = process.env.OTP_TEMPLATE || 'OTP1';
// WhatsApp API Configuration
const WHATSAPP_API_URL = 'https://adminapis.backendprod.com/lms_campaign/api/whatsapp/template/09stbyfn12/process';
// Meta WhatsApp API Configuration (Old Simple WhatsApp)
const META_WHATSAPP_API_URL = process.env.META_WHATSAPP_API_URL;
const META_WHATSAPP_API_KEY = process.env.META_WHATSAPP_API_KEY;

// =====================================================
// OTP STORAGE (For WhatsApp - since no auto-verify)
// =====================================================

// In-memory OTP storage (Use Redis in production)
const otpStorage = new Map();

// OTP Configuration
const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a random 4-digit OTP
 * @returns {string} - 4-digit OTP
 */
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Store OTP with expiry
 * @param {string} phoneNumber - Phone number as key
 * @param {string} otp - OTP value
 */
const storeOTP = (phoneNumber, otp) => {
    otpStorage.set(phoneNumber, {
        otp: otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000)
    });
};

/**
 * Verify OTP from storage
 * @param {string} phoneNumber - Phone number
 * @param {string} otp - OTP to verify
 * @returns {object} - { valid: boolean, message: string }
 */
const verifyStoredOTP = (phoneNumber, otp) => {
    const stored = otpStorage.get(phoneNumber);
    
    if (!stored) {
        return { valid: false, message: 'No OTP was sent to this number. Please request OTP first.' };
    }
    
    if (Date.now() > stored.expiresAt) {
        otpStorage.delete(phoneNumber);
        return { valid: false, message: 'OTP has expired. Please request a new OTP.' };
    }
    
    if (stored.otp !== otp) {
        return { valid: false, message: 'Invalid OTP. Please check and try again.' };
    }
    
    // OTP matched - remove from storage
    otpStorage.delete(phoneNumber);
    return { valid: true, message: 'OTP verified successfully!' };
};

// Clean up expired OTPs every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [phone, data] of otpStorage.entries()) {
        if (now > data.expiresAt) {
            otpStorage.delete(phone);
        }
    }
}, 5 * 60 * 1000);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Validate phone number
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - Whether the phone number is valid
 */
const validatePhoneNumber = (phoneNumber) => {
    // Remove any spaces or special characters
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Check if it's a valid 10-digit Indian phone number
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(cleanNumber);
};

/**
 * Format phone number with country code
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number with 91 prefix
 */
const formatPhoneNumber = (phoneNumber) => {
    // Remove any spaces or special characters
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Remove +91 or 91 prefix if already present
    if (cleanNumber.startsWith('+91')) {
        return cleanNumber.substring(3);
    } else if (cleanNumber.startsWith('91') && cleanNumber.length > 10) {
        return cleanNumber.substring(2);
    }
    
    return cleanNumber;
};

// =====================================================
// API ROUTES
// =====================================================

/**
 * Health Check Endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running!',
        timestamp: new Date().toISOString()
    });
});

/**
 * Send OTP Endpoint
 * POST /api/send-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "OTP sent successfully",
 *   "phoneNumber": "7021312529"
 * }
 */
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate request body
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format and validate phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.'
            });
        }

        console.log(`\n📱 Sending OTP to: ${formattedPhone}`);

        // Prepare request data for 2Factor API (POST method)
        // Using x-www-form-urlencoded format
        const requestData = new URLSearchParams({
            module: 'SMS_OTP',
            apikey: API_KEY,
            to: formattedPhone,  // 2Factor will add country code automatically
            otpvalue: 'AUTOGEN2',  // Auto-generate 6-digit OTP
            templatename: OTP_TEMPLATE
        });

        console.log('📤 Calling 2Factor Send OTP API...');

        // Make API call to 2Factor
        const response = await axios.post(SEND_OTP_URL, requestData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('📥 2Factor Response:', response.data);

        // Check if OTP was sent successfully
        if (response.data.Status === 'Success') {
            return res.json({
                success: true,
                message: 'OTP sent successfully! Please check your phone.',
                phoneNumber: formattedPhone,
                // Note: We don't send session_id to frontend for security
                // The verify endpoint uses phone number directly (VERIFY3)
            });
        } else {
            // Handle 2Factor error
            console.error('❌ 2Factor Error:', response.data);
            return res.status(400).json({
                success: false,
                message: response.data.Details || 'Failed to send OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Server Error:', error.message);
        
        // Handle specific axios errors
        if (error.response) {
            // 2Factor API returned an error
            console.error('2Factor API Error:', error.response.data);
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.Details || 'Failed to send OTP. Please try again.'
            });
        } else if (error.request) {
            // Network error
            return res.status(503).json({
                success: false,
                message: 'Unable to connect to SMS service. Please try again later.'
            });
        }

        // Generic error
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

/**
 * Verify OTP Endpoint
 * POST /api/verify-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529",
 *   "otp": "1234"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "verified": true,
 *   "message": "OTP verified successfully"
 * }
 */
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        // Validate request body
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Phone number and OTP are required'
            });
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Validate OTP format (should be 4-6 digits)
        const otpRegex = /^\d{4,6}$/;
        if (!otpRegex.test(otp)) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Invalid OTP format. Please enter a valid OTP.'
            });
        }

        console.log(`\n🔐 Verifying OTP for: ${formattedPhone}`);
        console.log(`   OTP entered: ${otp}`);

        // Build VERIFY3 API URL
        // Format: https://2factor.in/API/V1/{api_key}/SMS/VERIFY3/{phone_number}/{otp}
        const verifyUrl = `${VERIFY_OTP_URL}/${API_KEY}/SMS/VERIFY3/${formattedPhone}/${otp}`;

        console.log('📤 Calling 2Factor Verify OTP API...');

        // Make API call to 2Factor
        const response = await axios.get(verifyUrl);

        console.log('📥 2Factor Verify Response:', response.data);

        // Check verification result
        if (response.data.Status === 'Success' && response.data.Details === 'OTP Matched') {
            return res.json({
                success: true,
                verified: true,
                message: 'OTP verified successfully! Logging you in...',
                phoneNumber: formattedPhone
            });
        } else {
            // OTP didn't match
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Invalid OTP. Please check and try again.'
            });
        }

    } catch (error) {
        console.error('❌ Verify Error:', error.message);

        // Handle specific axios errors
        if (error.response) {
            const errorDetails = error.response.data?.Details || '';
            
            // Check for specific error messages from 2Factor
            if (errorDetails.includes('OTP Mismatch') || errorDetails.includes('OTP not matched')) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Invalid OTP. Please check and try again.'
                });
            } else if (errorDetails.includes('OTP Expired')) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'OTP has expired. Please request a new OTP.'
                });
            } else if (errorDetails.includes('No OTP request')) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'No OTP was sent to this number. Please request OTP first.'
                });
            }

            console.error('2Factor API Error:', error.response.data);
            return res.status(error.response.status).json({
                success: false,
                verified: false,
                message: errorDetails || 'OTP verification failed. Please try again.'
            });
        } else if (error.request) {
            // Network error
            return res.status(503).json({
                success: false,
                verified: false,
                message: 'Unable to connect to verification service. Please try again later.'
            });
        }

        // Generic error
        return res.status(500).json({
            success: false,
            verified: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

/**
 * Resend OTP Endpoint
 * POST /api/resend-otp
 * 
 * Same as send-otp, but with a different message
 */
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate request body
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format and validate phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number.'
            });
        }

        console.log(`\n🔄 Resending OTP to: ${formattedPhone}`);

        // Prepare request data for 2Factor API
        const requestData = new URLSearchParams({
            module: 'SMS_OTP',
            apikey: API_KEY,
            to: formattedPhone,
            otpvalue: 'AUTOGEN2',
            templatename: OTP_TEMPLATE
        });

        // Make API call to 2Factor
        const response = await axios.post(SEND_OTP_URL, requestData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('📥 2Factor Response:', response.data);

        if (response.data.Status === 'Success') {
            return res.json({
                success: true,
                message: 'New OTP sent successfully!',
                phoneNumber: formattedPhone
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.Details || 'Failed to resend OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Resend Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP. Please try again later.'
        });
    }
});

// =====================================================
// WHATSAPP OTP ENDPOINTS
// =====================================================

/**
 * Send OTP via WhatsApp
 * POST /api/whatsapp/send-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529"
 * }
 */
app.post('/api/whatsapp/send-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate request body
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format and validate phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP for later verification
        storeOTP(formattedPhone, otp);

        console.log(`\n📱 Sending WhatsApp OTP to: ${formattedPhone}`);
        console.log(`   Generated OTP: ${otp}`);

        // Prepare request data for WhatsApp API
        const requestData = {
            receiver: `+91${formattedPhone}`,
            values: {
                "1": otp
            }
        };

        console.log('📤 Calling WhatsApp API...');

        // Make API call to WhatsApp
        const response = await axios.post(WHATSAPP_API_URL, requestData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('📥 WhatsApp API Response:', response.data);

        // Check if message was sent successfully
        // Adjust this based on actual API response structure
        if (response.data && (response.data.success || response.status === 200)) {
            return res.json({
                success: true,
                message: 'OTP sent successfully via WhatsApp! Please check your WhatsApp.',
                phoneNumber: formattedPhone
            });
        } else {
            // Remove stored OTP if sending failed
            otpStorage.delete(formattedPhone);
            return res.status(400).json({
                success: false,
                message: response.data?.message || 'Failed to send WhatsApp OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ WhatsApp Send Error:', error.message);
        
        // Remove stored OTP if sending failed
        const formattedPhone = formatPhoneNumber(req.body.phoneNumber || '');
        otpStorage.delete(formattedPhone);

        if (error.response) {
            console.error('WhatsApp API Error:', error.response.data);
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.message || 'Failed to send WhatsApp OTP.'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to send WhatsApp OTP. Please try again later.'
        });
    }
});

/**
 * Verify WhatsApp OTP
 * POST /api/whatsapp/verify-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529",
 *   "otp": "123456"
 * }
 */
app.post('/api/whatsapp/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        // Validate request body
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Phone number and OTP are required'
            });
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Validate OTP format
        const otpRegex = /^\d{4,6}$/;
        if (!otpRegex.test(otp)) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Invalid OTP format. Please enter a valid OTP.'
            });
        }

        console.log(`\n🔐 Verifying WhatsApp OTP for: ${formattedPhone}`);
        console.log(`   OTP entered: ${otp}`);

        // Verify OTP from storage
        const verificationResult = verifyStoredOTP(formattedPhone, otp);

        if (verificationResult.valid) {
            console.log('✅ OTP Verified Successfully!');
            return res.json({
                success: true,
                verified: true,
                message: 'OTP verified successfully! Logging you in...',
                phoneNumber: formattedPhone
            });
        } else {
            console.log('❌ OTP Verification Failed:', verificationResult.message);
            return res.status(400).json({
                success: false,
                verified: false,
                message: verificationResult.message
            });
        }

    } catch (error) {
        console.error('❌ WhatsApp Verify Error:', error.message);
        return res.status(500).json({
            success: false,
            verified: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

/**
 * Resend OTP via WhatsApp
 * POST /api/whatsapp/resend-otp
 */
app.post('/api/whatsapp/resend-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number.'
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        storeOTP(formattedPhone, otp);

        console.log(`\n🔄 Resending WhatsApp OTP to: ${formattedPhone}`);

        const requestData = {
            receiver: `+91${formattedPhone}`,
            values: {
                "1": otp
            }
        };

        const response = await axios.post(WHATSAPP_API_URL, requestData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && (response.data.success || response.status === 200)) {
            return res.json({
                success: true,
                message: 'New OTP sent via WhatsApp!',
                phoneNumber: formattedPhone
            });
        } else {
            otpStorage.delete(formattedPhone);
            return res.status(400).json({
                success: false,
                message: 'Failed to resend WhatsApp OTP.'
            });
        }

    } catch (error) {
        console.error('❌ WhatsApp Resend Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend WhatsApp OTP.'
        });
    }
});

// =====================================================
// META WHATSAPP OTP ENDPOINTS (Old Simple WhatsApp)
// =====================================================

/**
 * Send OTP via Meta WhatsApp
 * POST /api/whatsapp-meta/send-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529"
 * }
 */
app.post('/api/whatsapp-meta/send-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate request body
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Format and validate phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.'
            });
        }

        // Generate 4-digit OTP
        const otp = generateOTP();
        
        // Store OTP for later verification (reusing existing storage)
        storeOTP(formattedPhone, otp);

        console.log(`\n📱 Sending Meta WhatsApp OTP to: ${formattedPhone}`);
        console.log(`   Generated OTP: ${otp}`);

        // Prepare request data for Meta WhatsApp API
        const requestData = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,  // Without country code, API handles it
            type: "template",
            template: {
                name: "otp_template1",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: otp
                            }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            {
                                type: "payload",
                                payload: otp
                            }
                        ]
                    }
                ]
            }
        };

        console.log('📤 Calling Meta WhatsApp API...');

        // Make API call to Meta WhatsApp
        const response = await axios.post(META_WHATSAPP_API_URL, requestData, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': META_WHATSAPP_API_KEY
            }
        });

        console.log('📥 Meta WhatsApp API Response:', response.data);

        // Check if message was sent successfully
        // Response has "message_status": "accepted" when successful
        if (response.data && response.data.messages && response.data.messages[0]?.message_status === 'accepted') {
            return res.json({
                success: true,
                message: 'OTP sent successfully via WhatsApp! Please check your WhatsApp.',
                phoneNumber: formattedPhone
            });
        } else if (response.status === 200) {
            // Sometimes 200 OK is enough
            return res.json({
                success: true,
                message: 'OTP sent successfully via WhatsApp! Please check your WhatsApp.',
                phoneNumber: formattedPhone
            });
        } else {
            // Remove stored OTP if sending failed
            otpStorage.delete(formattedPhone);
            return res.status(400).json({
                success: false,
                message: response.data?.message || 'Failed to send WhatsApp OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Meta WhatsApp Send Error:', error.message);
        
        // Remove stored OTP if sending failed
        const formattedPhone = formatPhoneNumber(req.body.phoneNumber || '');
        otpStorage.delete(formattedPhone);

        if (error.response) {
            console.error('Meta WhatsApp API Error:', error.response.data);
            return res.status(error.response.status).json({
                success: false,
                message: error.response.data?.message || 'Failed to send WhatsApp OTP.'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to send WhatsApp OTP. Please try again later.'
        });
    }
});

/**
 * Verify Meta WhatsApp OTP
 * POST /api/whatsapp-meta/verify-otp
 * 
 * Request Body:
 * {
 *   "phoneNumber": "7021312529",
 *   "otp": "1234"
 * }
 */
app.post('/api/whatsapp-meta/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        // Validate request body
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Phone number and OTP are required'
            });
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Validate OTP format (4 digits)
        const otpRegex = /^\d{4}$/;
        if (!otpRegex.test(otp)) {
            return res.status(400).json({
                success: false,
                verified: false,
                message: 'Invalid OTP format. Please enter a valid 4-digit OTP.'
            });
        }

        console.log(`\n🔐 Verifying Meta WhatsApp OTP for: ${formattedPhone}`);
        console.log(`   OTP entered: ${otp}`);

        // Verify OTP from storage (reusing existing verification)
        const verificationResult = verifyStoredOTP(formattedPhone, otp);

        if (verificationResult.valid) {
            console.log('✅ OTP Verified Successfully!');
            return res.json({
                success: true,
                verified: true,
                message: 'OTP verified successfully! Logging you in...',
                phoneNumber: formattedPhone
            });
        } else {
            console.log('❌ OTP Verification Failed:', verificationResult.message);
            return res.status(400).json({
                success: false,
                verified: false,
                message: verificationResult.message
            });
        }

    } catch (error) {
        console.error('❌ Meta WhatsApp Verify Error:', error.message);
        return res.status(500).json({
            success: false,
            verified: false,
            message: 'Internal server error. Please try again later.'
        });
    }
});

/**
 * Resend OTP via Meta WhatsApp
 * POST /api/whatsapp-meta/resend-otp
 */
app.post('/api/whatsapp-meta/resend-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!validatePhoneNumber(formattedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number.'
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        storeOTP(formattedPhone, otp);

        console.log(`\n🔄 Resending Meta WhatsApp OTP to: ${formattedPhone}`);

        const requestData = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: "otp_template1",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: otp
                            }
                        ]
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            {
                                type: "payload",
                                payload: otp
                            }
                        ]
                    }
                ]
            }
        };

        const response = await axios.post(META_WHATSAPP_API_URL, requestData, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': META_WHATSAPP_API_KEY
            }
        });

        if (response.status === 200) {
            return res.json({
                success: true,
                message: 'New OTP sent via WhatsApp!',
                phoneNumber: formattedPhone
            });
        } else {
            otpStorage.delete(formattedPhone);
            return res.status(400).json({
                success: false,
                message: 'Failed to resend WhatsApp OTP.'
            });
        }

    } catch (error) {
        console.error('❌ Meta WhatsApp Resend Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend WhatsApp OTP.'
        });
    }
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// =====================================================
// ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log('\n=====================================================');
    console.log('🚀 OTP Login Backend Server');
    console.log('=====================================================');
    console.log(`✅ Server running on: http://localhost:${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log('=====================================================');
    console.log('📡 Available Endpoints:');
    console.log(`   POST /api/send-otp    - Send OTP to phone number`);
    console.log(`   POST /api/verify-otp  - Verify OTP entered by user`);
    console.log(`   POST /api/resend-otp  - Resend OTP to phone number`);
    console.log('=====================================================\n');
     console.log('-----------------------------------------------------');
    console.log('📱 WhatsApp OTP Endpoints:');
    console.log(`   POST /api/whatsapp/send-otp    - Send OTP via WhatsApp`);
    console.log(`   POST /api/whatsapp/verify-otp  - Verify WhatsApp OTP`);
    console.log(`   POST /api/whatsapp/resend-otp  - Resend WhatsApp OTP`);
    console.log('=====================================================\n');
    console.log('-----------------------------------------------------');
    console.log('📱 Meta WhatsApp OTP Endpoints (Old Simple):');
    console.log(`   POST /api/whatsapp-meta/send-otp    - Send OTP`);
    console.log(`   POST /api/whatsapp-meta/verify-otp  - Verify OTP`);
    console.log(`   POST /api/whatsapp-meta/resend-otp  - Resend OTP`);
    console.log('=====================================================\n');

});