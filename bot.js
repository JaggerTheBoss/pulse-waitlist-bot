const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Your bot token from @BotFather
const BOT_TOKEN = '7664899794:AAF4pSZMODZlgouvcL3jim-9_1ntDsmWvsY';

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// File to store signups
const SIGNUPS_FILE = path.join(__dirname, 'pulse_signups.json');

// Initialize signups file if it doesn't exist
if (!fs.existsSync(SIGNUPS_FILE)) {
    fs.writeFileSync(SIGNUPS_FILE, JSON.stringify([], null, 2));
}

// Helper function to load signups
function loadSignups() {
    try {
        const data = fs.readFileSync(SIGNUPS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading signups:', error);
        return [];
    }
}

// Helper function to save signups
function saveSignups(signups) {
    try {
        fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving signups:', error);
        return false;
    }
}

// Helper function to add signup
function addSignup(username, userId, firstName, lastName) {
    const signups = loadSignups();
    
    // Check if user already signed up
    const existingSignup = signups.find(signup => signup.userId === userId);
    if (existingSignup) {
        return false; // Already signed up
    }
    
    const newSignup = {
        username: username || 'N/A',
        userId: userId,
        firstName: firstName || 'N/A',
        lastName: lastName || 'N/A',
        signupDate: new Date().toISOString(),
        timestamp: Date.now()
    };
    
    signups.push(newSignup);
    return saveSignups(signups);
}

// Start command handler
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name;
    
    // Welcome message with inline keyboard
    const welcomeMessage = `🚀 *Welcome to Pulse Waitlist!*

Speed, strategy, precision— all in rhythm. One-click execution—because every millisecond counts.

🌐 Website: pulse.trade
🐦 Twitter: @UsePulseX

Ready to get early access to the future of trading?`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '⚡ Sign Up for Early Access',
                    callback_data: 'signup_early_access'
                }
            ]]
        }
    };
    
    // Send photo with caption instead of just text message
    const bannerPath = './PulseTGBanner.png'; // Path to your banner image
    
    bot.sendPhoto(chatId, bannerPath, {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: options.reply_markup
    }).catch(error => {
        // Fallback to text message if image fails
        console.log('Banner image not found, sending text message instead');
        bot.sendMessage(chatId, welcomeMessage, options);
    });
});

// Handle callback queries (button presses)
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const username = callbackQuery.from.username;
    const firstName = callbackQuery.from.first_name;
    const lastName = callbackQuery.from.last_name;
    
    if (callbackQuery.data === 'signup_early_access') {
        // Try to add signup
        const success = addSignup(username, userId, firstName, lastName);
        
        let responseMessage;
        if (success) {
            responseMessage = `✅ *You're all set!*

Welcome to the Pulse waitlist, ${firstName || 'trader'}!

You'll be among the first to experience:
• Lightning-fast execution
• Advanced trading strategies  
• Precision tools built by trenchers

We'll notify you as soon as early access opens.

🌐 pulse.trade | 🐦 @UsePulseX

*Get ready to trade in rhythm!* 🎯`;

            // Log the signup
            console.log(`New signup: @${username || 'N/A'} (${firstName || 'N/A'} ${lastName || 'N/A'}) - User ID: ${userId}`);
        } else {
            responseMessage = `ℹ️ *Already on the waitlist!*

You're already signed up for Pulse early access, ${firstName || 'trader'}!

We'll notify you as soon as it's ready. Thanks for your patience!

🌐 pulse.trade | 🐦 @UsePulseX 🚀`;
        }
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🏠 Back to Start',
                        callback_data: 'back_to_start'
                    }
                ]]
            }
        };
        
        // Send a new message instead of trying to edit the photo message
        bot.sendMessage(chatId, responseMessage, options);
    } else if (callbackQuery.data === 'back_to_start') {
        // Send a new banner message instead of trying to edit
        const welcomeMessage = `🚀 *Welcome to Pulse Waitlist!*

Speed, strategy, precision— all in rhythm. One-click execution—because every millisecond counts.

🌐 Website: pulse.trade
🐦 Twitter: @UsePulseX

Ready to get early access to the future of trading?`;

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '⚡ Sign Up for Early Access',
                        callback_data: 'signup_early_access'
                    }
                ]]
            }
        };
        
        const bannerPath = './PulseTGBanner.png';
        
        bot.sendPhoto(chatId, bannerPath, {
            caption: welcomeMessage,
            parse_mode: 'Markdown',
            reply_markup: options.reply_markup
        }).catch(error => {
            // Fallback to text message if image fails
            bot.sendMessage(chatId, welcomeMessage, options);
        });
    }
    
    // Answer the callback query to remove loading state
    bot.answerCallbackQuery(callbackQuery.id);
});

// Admin command to view signups (optional)
bot.onText(/\/signups/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Admin user IDs - both you and your team member
    const ADMIN_USER_IDS = [1492845635, 7430251226];
    
    if (!ADMIN_USER_IDS.includes(userId)) {
        bot.sendMessage(chatId, '❌ Unauthorized access.');
        return;
    }
    
    const signups = loadSignups();
    
    if (signups.length === 0) {
        bot.sendMessage(chatId, '📋 No signups yet.');
        return;
    }
    
    let message = `📋 *Pulse Waitlist Signups* (${signups.length} total)\n\n`;
    
    signups.forEach((signup, index) => {
        const date = new Date(signup.signupDate).toLocaleDateString();
        message += `${index + 1}. @${signup.username} (${signup.firstName} ${signup.lastName}) - ${date}\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

// Polling error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('🚀 Pulse Waitlist Bot is running...');
console.log('Bot URL: https://t.me/pulse_waitlist_bot');
console.log('Signups will be saved to:', SIGNUPS_FILE);