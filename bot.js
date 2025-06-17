const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Your bot token from @BotFather
const BOT_TOKEN = process.env.BOT_TOKEN || '7664899794:AAF4pSZMODZlgouvcL3jim-9_1ntDsmWvsY';

// Admin notification channel ID (you'll need to set this)
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || '-1002510281572'; // Your channel ID

// File to store signups
const SIGNUPS_FILE = 'pulse_signups.json';
const TRACKER_FILE = 'channel_tracker.json'; // Stores the pinned message ID

// Create bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Function to load signups from file
function loadSignups() {
    try {
        if (fs.existsSync(SIGNUPS_FILE)) {
            const data = fs.readFileSync(SIGNUPS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading signups:', error);
        return [];
    }
}

// Function to save signups to file
function saveSignups(signups) {
    try {
        fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
    } catch (error) {
        console.error('Error saving signups:', error);
    }
}

// Function to load tracker data
function loadTracker() {
    try {
        if (fs.existsSync(TRACKER_FILE)) {
            const data = fs.readFileSync(TRACKER_FILE, 'utf8');
            return JSON.parse(data);
        }
        return { pinnedMessageId: null };
    } catch (error) {
        console.error('Error loading tracker:', error);
        return { pinnedMessageId: null };
    }
}

// Function to save tracker data
function saveTracker(data) {
    try {
        fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving tracker:', error);
    }
}

// Function to format signup list for channel (FIXED for Markdown parsing)
function formatSignupList(signups) {
    const header = `📊 Pulse Waitlist Dashboard\n\nTotal Signups: ${signups.length}\n\n`;
    
    if (signups.length === 0) {
        return header + "No signups yet.";
    }
    
    let list = header + "Recent Signups:\n";
    
    // Show signups in reverse order (most recent first)
    const recentSignups = signups.slice().reverse();
    
    for (let i = 0; i < recentSignups.length; i++) {
        const signup = recentSignups[i];
        const date = new Date(signup.timestamp).toLocaleDateString();
        const username = signup.username ? `@${signup.username}` : 'No username';
        const name = (signup.firstName || 'Unknown') + (signup.lastName ? ` ${signup.lastName}` : '');
        
        const newLine = `${i + 1}. ${name} (${username}) - ${date}\n`;
        
        // Check if adding this line would exceed 4000 characters
        if ((list + newLine).length > 3900) { // Leave some buffer
            list += `\n...+${signups.length - i} more signups`;
            break;
        }
        
        list += newLine;
    }
    
    list += `\n🕐 Last updated: ${new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })} EST`;
    
    return list;
}

// Function to send notification to admin channel (FIXED)
async function notifyAdminChannel(signup, isNew = true) {
    console.log(`notifyAdminChannel called - isNew: ${isNew}, channelId: ${ADMIN_CHANNEL_ID}`);
    
    try {
        const signups = loadSignups();
        const tracker = loadTracker();
        
        console.log(`Loaded ${signups.length} signups, tracker pinnedMessageId: ${tracker.pinnedMessageId}`);
        
        // Update the pinned message with current signup list
        const listMessage = formatSignupList(signups);
        
        console.log(`Dashboard message length: ${listMessage.length} characters`);
        
        if (tracker.pinnedMessageId && isNew) {
            // Edit existing pinned message
            try {
                await bot.editMessageText(listMessage, {
                    chat_id: ADMIN_CHANNEL_ID,
                    message_id: tracker.pinnedMessageId,
                    parse_mode: 'HTML' // Changed from Markdown to HTML
                });
                console.log('Successfully updated pinned message');
            } catch (editError) {
                console.log('Could not edit pinned message:', editError.message);
                console.log('Creating new pinned message...');
                
                const newMessage = await bot.sendMessage(ADMIN_CHANNEL_ID, listMessage, { parse_mode: 'HTML' });
                tracker.pinnedMessageId = newMessage.message_id;
                saveTracker(tracker);
                console.log(`Created new pinned message with ID: ${newMessage.message_id}`);
            }
        } else if (!tracker.pinnedMessageId) {
            // Create initial pinned message
            console.log('Creating initial pinned message...');
            const pinnedMessage = await bot.sendMessage(ADMIN_CHANNEL_ID, listMessage, { parse_mode: 'HTML' });
            tracker.pinnedMessageId = pinnedMessage.message_id;
            saveTracker(tracker);
            console.log(`Created initial pinned message with ID: ${pinnedMessage.message_id}`);
            
            // Try to pin the message
            try {
                await bot.pinChatMessage(ADMIN_CHANNEL_ID, pinnedMessage.message_id);
                console.log('Successfully pinned message');
            } catch (pinError) {
                console.log('Could not pin message (bot needs admin rights):', pinError.message);
            }
        }
        
        // Send individual notification for new signups
        if (isNew && signup) {
            const username = signup.username ? `@${signup.username}` : 'No username';
            const name = (signup.firstName || 'Unknown') + (signup.lastName ? ` ${signup.lastName}` : '');
            
            // Convert to EST timezone
            const estTime = new Date().toLocaleString('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            
            const notificationMessage = `🎉 New Signup!\n\n👤 ${name}\n📱 ${username}\n🆔 ${signup.userId}\n⏰ ${estTime} EST\n\nTotal: ${signups.length} signups`;
            
            await bot.sendMessage(ADMIN_CHANNEL_ID, notificationMessage, { parse_mode: 'HTML' });
            console.log('Successfully sent new signup notification');
        }
        
    } catch (error) {
        console.error('Error in notifyAdminChannel:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            response: error.response?.body
        });
    }
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

// Callback query handler for button presses
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const username = callbackQuery.from.username;
    const firstName = callbackQuery.from.first_name;
    const lastName = callbackQuery.from.last_name;

    if (callbackQuery.data === 'signup_early_access') {
        // Load existing signups
        let signups = loadSignups();
        
        // Check if user already signed up
        const existingSignup = signups.find(signup => signup.userId === userId);
        let success = false;
        
        if (!existingSignup) {
            // Create new signup entry
            const newSignup = {
                userId: userId,
                username: username || null,
                firstName: firstName || null,
                lastName: lastName || null,
                timestamp: new Date().toISOString(),
                chatId: chatId
            };
            
            // Save the new signup
            signups.push(newSignup);
            saveSignups(signups);
            
            // Send notification to admin channel
            await notifyAdminChannel(newSignup, true);
            
            success = true;
        }
        
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

// Admin command to view signups (FIXED)
bot.onText(/\/signups/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        // Admin user IDs - both you and your team member
        const ADMIN_USER_IDS = [1492845635, 7430251226];
        
        if (!ADMIN_USER_IDS.includes(userId)) {
            await bot.sendMessage(chatId, '❌ Unauthorized access.');
            return;
        }
        
        console.log(`Admin ${userId} requested signups list`);
        
        const signups = loadSignups();
        console.log(`Loaded ${signups.length} signups`);
        
        if (signups.length === 0) {
            await bot.sendMessage(chatId, '📋 No signups yet!');
            return;
        }
        
        // Split signups into chunks, showing MOST RECENT FIRST
        const chunkSize = 15; // Define chunkSize variable
        const chunks = [];
        
        for (let i = 0; i < signups.length; i += chunkSize) {
            const chunk = signups.slice().reverse().slice(i, i + chunkSize); // Reverse entire array first
            let message = '';
            
            if (i === 0) {
                message = `📋 Pulse Waitlist Signups (${signups.length} total)\n\n`;
            } else {
                message = `📋 Signups continued... (${i + 1}-${Math.min(i + chunkSize, signups.length)} of ${signups.length})\n\n`;
            }
            
            chunk.forEach((signup, index) => {
                const date = new Date(signup.timestamp).toLocaleDateString();
                const username = signup.username ? `@${signup.username}` : 'No username';
                const name = (signup.firstName || 'Unknown') + (signup.lastName ? ` ${signup.lastName}` : '');
                
                // Fix numbering: most recent should have highest number
                const signupNumber = signups.length - (i + index);
                message += `${signupNumber}. ${name} (${username}) - ${date}\n`;
            });
            
            chunks.push(message);
        }
        
        // Send all chunks
        for (const chunk of chunks) {
            await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
            // Small delay between messages to avoid rate limiting
            if (chunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`Successfully sent ${chunks.length} signup messages to admin`);
        
    } catch (error) {
        console.error('Error in /signups command:', error);
        await bot.sendMessage(chatId, `❌ Error loading signups: ${error.message}`);
    }
});

// Admin command to view signups OLDEST FIRST
bot.onText(/\/old/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        // Admin user IDs - both you and your team member
        const ADMIN_USER_IDS = [1492845635, 7430251226];
        
        if (!ADMIN_USER_IDS.includes(userId)) {
            await bot.sendMessage(chatId, '❌ Unauthorized access.');
            return;
        }
        
        console.log(`Admin ${userId} requested signups list (oldest first)`);
        
        const signups = loadSignups();
        console.log(`Loaded ${signups.length} signups`);
        
        if (signups.length === 0) {
            await bot.sendMessage(chatId, '📋 No signups yet!');
            return;
        }
        
        // Split signups into chunks, showing OLDEST FIRST (no reverse)
        const chunkSize = 15;
        const chunks = [];
        
        for (let i = 0; i < signups.length; i += chunkSize) {
            const chunk = signups.slice(i, i + chunkSize); // No reverse - keeps original order
            let message = '';
            
            if (i === 0) {
                message = `📋 Pulse Waitlist Signups - OLDEST FIRST (${signups.length} total)\n\n`;
            } else {
                message = `📋 Signups continued... (${i + 1}-${Math.min(i + chunkSize, signups.length)} of ${signups.length})\n\n`;
            }
            
            chunk.forEach((signup, index) => {
                const date = new Date(signup.timestamp).toLocaleDateString();
                const username = signup.username ? `@${signup.username}` : 'No username';
                const name = (signup.firstName || 'Unknown') + (signup.lastName ? ` ${signup.lastName}` : '');
                
                message += `${i + index + 1}. ${name} (${username}) - ${date}\n`;
            });
            
            chunks.push(message);
        }
        
        // Send all chunks
        for (const chunk of chunks) {
            await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
            // Small delay between messages to avoid rate limiting
            if (chunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`Successfully sent ${chunks.length} signup messages to admin (oldest first)`);
        
    } catch (error) {
        console.error('Error in /old command:', error);
        await bot.sendMessage(chatId, `❌ Error loading signups: ${error.message}`);
    }
});

// Admin command to delete a user (debugging)
bot.onText(/\/delete_user (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const searchTerm = match[1].trim();
    
    // Admin user IDs - both you and your team member
    const ADMIN_USER_IDS = [1492845635, 7430251226];
    
    if (!ADMIN_USER_IDS.includes(userId)) {
        await bot.sendMessage(chatId, '❌ Unauthorized access.');
        return;
    }
    
    let signups = loadSignups();
    const originalCount = signups.length;
    
    // Find and remove user by username, name, or user ID
    signups = signups.filter(signup => {
        const username = signup.username || '';
        const fullName = `${signup.firstName || ''} ${signup.lastName || ''}`.trim();
        const userIdStr = signup.userId.toString();
        
        // Check if search term matches username (with or without @), name, or user ID
        const searchLower = searchTerm.toLowerCase().replace('@', '');
        return !(
            username.toLowerCase().includes(searchLower) ||
            fullName.toLowerCase().includes(searchLower) ||
            userIdStr.includes(searchTerm)
        );
    });
    
    if (signups.length < originalCount) {
        saveSignups(signups);
        const deletedCount = originalCount - signups.length;
        await bot.sendMessage(chatId, `✅ Deleted ${deletedCount} user(s) matching "${searchTerm}"\n\nNew total: ${signups.length} signups`);
        
        // Update admin channel dashboard
        await notifyAdminChannel(null, false);
        
    } else {
        await bot.sendMessage(chatId, `❌ No users found matching "${searchTerm}"`);
    }
});

// Add Express server for web endpoints
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Download signups as JSON file
app.get('/download/signups', (req, res) => {
    try {
        const signups = loadSignups();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="pulse_signups.json"');
        res.send(JSON.stringify(signups, null, 2));
    } catch (error) {
        res.status(500).send('Error loading signups');
    }
});

// View signups in browser (formatted)
app.get('/signups', (req, res) => {
    try {
        const signups = loadSignups();
        
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pulse Waitlist Signups</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a2e; color: white; }
                h1 { color: #e94560; }
                .stats { background: #16213e; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; background: #16213e; border-radius: 8px; overflow: hidden; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #0f3460; }
                th { background: #e94560; color: white; }
                tr:hover { background: #0f3460; }
                .download-btn { background: #e94560; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>🚀 Pulse Waitlist Signups</h1>
            <div class="stats">
                <h3>📊 Stats</h3>
                <p><strong>Total Signups:</strong> ${signups.length}</p>
                <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <a href="/download/signups" class="download-btn">📥 Download JSON</a>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th>User ID</th>
                        <th>Signup Date</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        signups.forEach((signup, index) => {
            const date = new Date(signup.timestamp).toLocaleString();
            const username = signup.username ? `@${signup.username}` : 'No username';
            const name = (signup.firstName || 'Unknown') + (signup.lastName ? ` ${signup.lastName}` : '');
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${name}</td>
                    <td>${username}</td>
                    <td>${signup.userId}</td>
                    <td>${date}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('Error loading signups');
    }
});

// Middleware for JSON parsing
app.use(express.json());

// Restore form (GET) - shows upload form with password protection
app.get('/restore/signups', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Restore Pulse Signups</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a2e; color: white; }
            h1 { color: #e94560; }
            .form-container { background: #16213e; padding: 20px; border-radius: 8px; max-width: 600px; }
            input, textarea { width: 100%; background: #0f3460; color: white; border: 1px solid #e94560; border-radius: 4px; padding: 10px; margin-bottom: 10px; }
            textarea { height: 300px; font-family: monospace; }
            button { background: #e94560; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 10px; }
            button:hover { background: #d63851; }
            .back-btn { background: #16213e; border: 1px solid #e94560; margin-right: 10px; }
            .back-btn:hover { background: #0f3460; }
            .password-section { margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <h1>🔄 Restore Pulse Signups</h1>
        <div class="form-container">
            <div class="password-section">
                <h3>🔐 Admin Password Required:</h3>
                <input type="password" id="password" placeholder="Enter admin password..." />
                <button onclick="checkPassword()">Unlock</button>
            </div>
            
            <div id="restore-form" style="display: none;">
                <h3>Paste your backup JSON below:</h3>
                <form action="/restore/signups" method="POST">
                    <textarea name="backup" placeholder='Paste your JSON backup here... Should start with [ and end with ]'></textarea>
                    <br>
                    <button type="button" class="back-btn" onclick="window.location.href='/signups'">← Back to Dashboard</button>
                    <button type="submit">🔄 Restore Signups</button>
                </form>
            </div>
        </div>
        
        <script>
            function checkPassword() {
                const password = document.getElementById('password').value;
                if (password === 'latke123') {
                    document.querySelector('.password-section').style.display = 'none';
                    document.getElementById('restore-form').style.display = 'block';
                } else {
                    alert('❌ Incorrect password!');
                }
            }
            
            // Handle form submission
            document.querySelector('form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const backup = document.querySelector('textarea').value.trim();
                
                if (!backup) {
                    alert('Please paste your backup JSON first!');
                    return;
                }
                
                try {
                    const jsonData = JSON.parse(backup);
                    
                    const response = await fetch('/restore/signups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(jsonData)
                    });
                    
                    const result = await response.text();
                    
                    if (response.ok) {
                        alert('✅ ' + result);
                        window.location.href = '/signups';
                    } else {
                        alert('❌ ' + result);
                    }
                } catch (error) {
                    alert('❌ Invalid JSON format: ' + error.message);
                }
            });
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

// RESTORE endpoint for backup data (POST)
app.post('/restore/signups', (req, res) => {
    try {
        const signups = req.body;
        if (!Array.isArray(signups)) {
            return res.status(400).send('❌ Invalid data format - must be an array');
        }
        
        fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
        console.log(`✅ Restored ${signups.length} signups from backup`);
        res.send(`✅ Successfully restored ${signups.length} signups!`);
    } catch (error) {
        console.error('Error restoring signups:', error);
        res.status(500).send(`❌ Error restoring signups: ${error.message}`);
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send('🚀 Pulse Waitlist Bot is running!');
});

// Start Express server
app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📊 View signups: https://your-app-name.onrender.com/signups`);
    console.log(`📥 Download JSON: https://your-app-name.onrender.com/download/signups`);
});

// Initialize the bot and send initial dashboard message
bot.on('ready', async () => {
    console.log('🚀 Pulse Waitlist Bot is running...');
    console.log('Bot URL: https://t.me/pulse_waitlist_bot');
    console.log('Signups will be saved to:', SIGNUPS_FILE);
    
    // Send initial dashboard message to admin channel (FIXED)
    console.log('Sending initial dashboard to admin channel...');
    await notifyAdminChannel(null, false); // Send initial dashboard
});

// Fallback console logs
console.log('🚀 Pulse Waitlist Bot is running...');
console.log('Bot URL: https://t.me/pulse_waitlist_bot');
console.log('Signups will be saved to:', SIGNUPS_FILE);