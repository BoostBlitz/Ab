// index.js

// This line loads the environment variables from your .env file (for local testing)
// or from the hosting platform's environment variables (when deployed).
// 'dotenv' is a dependency listed in package.json.
require('dotenv').config();

// These lines import the libraries (dependencies) that were installed
// because they are listed in package.json.
const TelegramBot = require('node-telegram-bot-api'); // Core Telegram library
const yts = require('yt-search');                     // For YouTube search
const ytdl = require('ytdl-core');                    // For YouTube downloads
const axios = require('axios');                       // For making web requests (TikTok placeholder)
const sharp = require('sharp');                       // For basic image processing (upscale)
const fs = require('fs');                             // Built-in Node.js module for file system
const path = require('path');                         // Built-in Node.js module for file paths
// const ffmpeg = require('fluent-ffmpeg'); // Uncomment if you directly use fluent-ffmpeg commands

// Read the Telegram Bot Token from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
// Read Opay info from environment variables
const opayInfo = process.env.OWNER_OPAY_INFO || "Opay details not set in environment variables.";

if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN is not set. Please set it in your .env file (locally) or in your hosting platform's environment variables.");
    process.exit(1); // Stop the bot if the token is missing
}

// Create the bot instance using the token
const bot = new TelegramBot(token, { polling: true });
const PREFIX = '.'; // Your desired command prefix
const BOT_NAME = "A.A.W Blitz ⚡ Bot";

console.log(`${BOT_NAME} is starting up...`);

// --- Helper to send "typing..." action ---
const sendTyping = (chatId) => bot.sendChatAction(chatId, 'typing');

// --- Main message handler ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Ignore messages that are not text or don't start with the prefix
    if (!text || !text.startsWith(PREFIX)) {
        return;
    }

    await sendTyping(chatId); // Show "typing..."

    // Parse the command and arguments
    const args = text.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const startTime = Date.now(); // For calculating ping latency

    try {
        // --- Command Switch ---
        switch (command) {
            case 'start':
            case 'alive':
                bot.sendMessage(chatId, `Hey there! ${BOT_NAME} is online and ready to roll! ⚡\nType ${PREFIX}menu to see what I can do.`);
                break;

            case 'ping':
                // 1. React with ⚡ (if supported and enabled)
                try {
                    // Note: setMessageReaction might not be available in all library versions or bot types
                    // or might require specific permissions.
                    await bot.setMessageReaction(chatId, msg.message_id, { reaction: '⚡', is_big: false });
                } catch (reactError) {
                    console.warn("Could not react to message (ping):", reactError.message);
                    // Silently fail or log, as reacting isn't critical for ping's main function.
                }
                // 2. Reply with "pong" and latency
                const endTime = Date.now();
                const latency = endTime - startTime;
                bot.sendMessage(chatId, `Pong! ${latency}ms`, { reply_to_message_id: msg.message_id });
                break;

            case 'menu':
                const menuText = `
${BOT_NAME} - Command Menu ⚡
-----------------------------------
▫️ ${PREFIX}start, ${PREFIX}alive - Check if bot is online
▫️ ${PREFIX}ping - Check bot latency & react
▫️ ${PREFIX}menu - Show this command menu
▫️ ${PREFIX}aza, ${PREFIX}acc, ${PREFIX}donate - Show Opay account info
▫️ ${PREFIX}ytmp3 [youtube_link] - Download YouTube audio
▫️ ${PREFIX}ytmp4 [youtube_link] - Download YouTube video
▫️ ${PREFIX}play [song_name] - Play music from YouTube
▫️ ${PREFIX}tiktok [tiktok_link] - Download TikTok video (Experimental)
▫️ ${PREFIX}upscale (reply to image) - Enhance replied image (Basic)
▫️ ${PREFIX}ttt - Play Tic Tac Toe (e.g., ${PREFIX}ttt @username or ${PREFIX}ttt move 1)
-----------------------------------
                `;
                bot.sendMessage(chatId, menuText, { parse_mode: "Markdown" }); // Markdown for better formatting
                break;

            case 'aza':
            case 'acc':
            case 'donate':
                bot.sendMessage(chatId, opayInfo);
                break;

            case 'ytmp3':
            case 'ytmp4':
                if (args.length === 0 || !ytdl.validateURL(args[0])) {
                    bot.sendMessage(chatId, `Please provide a valid YouTube link.\nExample: ${PREFIX}${command} https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
                    return;
                }
                const videoUrl = args[0];
                try {
                    const info = await ytdl.getInfo(videoUrl);
                    const title = info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, ''); // Sanitize title
                    const formatType = command === 'ytmp3' ? 'audioonly' : 'videoandaudio';
                    const quality = command === 'ytmp3' ? 'highestaudio' : 'highestvideo';
                    const extension = command === 'ytmp3' ? 'mp3' : 'mp4';
                    const fileName = `${title}.${extension}`;

                    await bot.sendMessage(chatId, `Downloading "${title}" as ${extension}... This might take a moment.`);
                    await sendTyping(chatId);

                    const stream = ytdl(videoUrl, { filter: formatType, quality: quality });

                    if (command === 'ytmp3') {
                        await bot.sendAudio(chatId, stream, { caption: title, title: title }, { filename: fileName, contentType: 'audio/mpeg' });
                    } else {
                        await bot.sendVideo(chatId, stream, { caption: title }, { filename: fileName, contentType: 'video/mp4' });
                    }
                } catch (err) {
                    console.error("YTDL Error (ytmp3/ytmp4):", err.message);
                    bot.sendMessage(chatId, "Sorry, I couldn't download that. The video might be private, age-restricted, or the link is invalid. Error: " + err.message.substring(0, 100));
                }
                break;

            case 'play':
                if (args.length === 0) {
                    bot.sendMessage(chatId, `Please provide a song name to search.\nExample: ${PREFIX}play Never Gonna Give You Up`);
                    return;
                }
                const query = args.join(' ');
                try {
                    await bot.sendMessage(chatId, `Searching for "${query}" on YouTube...`);
                    await sendTyping(chatId);

                    const searchResults = await yts(query); // yt-search library
                    const video = searchResults.videos[0];

                    if (!video) {
                        bot.sendMessage(chatId, `Sorry, I couldn't find any songs matching "${query}".`);
                        return;
                    }

                    const songInfo = await ytdl.getInfo(video.url); // ytdl-core library
                    const title = songInfo.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '');
                    const fileName = `${title}.mp3`;

                    await bot.sendMessage(chatId, `Found: ${video.title}\nDuration: ${video.timestamp}\nDownloading audio... Please wait.`);
                    await sendTyping(chatId);

                    const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
                    await bot.sendAudio(chatId, audioStream, { caption: video.title, title: video.title, duration: video.seconds }, { filename: fileName, contentType: 'audio/mpeg' });

                } catch (err) {
                    console.error("Play Command Error:", err.message);
                    bot.sendMessage(chatId, "Sorry, an error occurred while trying to play the song. Error: " + err.message.substring(0,100));
                }
                break;

            case 'tiktok':
                if (args.length === 0) {
                    bot.sendMessage(chatId, `Please provide a TikTok video link.\nExample: ${PREFIX}tiktok [link]`);
                    return;
                }
                const tiktokLink = args[0];
                await bot.sendMessage(chatId, "Attempting to download TikTok video (experimental)...");
                await sendTyping(chatId);
                try {
                    // Using a common (but often unreliable) public API pattern.
                    // You might need to find a more stable API or library for TikTok.
                    const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokLink)}`, { timeout: 15000 });
                    if (response.data && response.data.data && response.data.data.play) {
                        await bot.sendVideo(chatId, response.data.data.play, { caption: response.data.data.title || "TikTok Video" });
                    } else if (response.data && response.data.msg) {
                         bot.sendMessage(chatId, `Could not fetch TikTok video. API says: ${response.data.msg}`);
                    }
                    else {
                        bot.sendMessage(chatId, "Could not fetch TikTok video. The API might be down, the link invalid/private, or the format isn't supported by this method.");
                    }
                } catch (err) {
                    console.error("TikTok Download Error:", err.message);
                    bot.sendMessage(chatId, "Failed to download TikTok video. This feature is highly unstable due to TikTok's restrictions.");
                }
                break;

            case 'upscale':
                if (!msg.reply_to_message || !msg.reply_to_message.photo) {
                    bot.sendMessage(chatId, "Please reply to an image to use the upscale command.");
                    return;
                }
                await bot.sendMessage(chatId, "Enhancing image (basic resize)... Please wait. This is NOT an AI upscale like Remini.");
                await sendTyping(chatId);
                try {
                    const photo = msg.reply_to_message.photo;
                    const fileId = photo[photo.length - 1].file_id; // Get highest resolution available
                    const fileStream = bot.getFileStream(fileId);

                    // Using 'sharp' library for basic image manipulation
                    const tempFileName = `temp_upscaled_${Date.now()}.jpg`;
                    const outputPath = path.join(__dirname, tempFileName); // Save temporarily

                    // Collect stream into a buffer
                    const imageChunks = [];
                    fileStream.on('data', (chunk) => imageChunks.push(chunk));
                    fileStream.on('end', async () => {
                        const imageBuffer = Buffer.concat(imageChunks);
                        try {
                            const metadata = await sharp(imageBuffer).metadata();
                            await sharp(imageBuffer)
                                .resize(metadata.width * 2, metadata.height * 2, { // Double the dimensions
                                    kernel: sharp.kernel.lanczos3, // A good quality resampling algorithm
                                })
                                .toFile(outputPath);

                            await bot.sendPhoto(chatId, outputPath, { caption: "Image Enhanced (Basic 2x Resize)" });
                            fs.unlinkSync(outputPath); // Delete the temporary file
                        } catch (sharpError) {
                            console.error("Sharp Processing Error (upscale):", sharpError);
                            bot.sendMessage(chatId, "Sorry, I couldn't process that image for upscaling.");
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        }
                    });
                    fileStream.on('error', (streamErr) => {
                        console.error("File Stream Error (upscale):", streamErr);
                        bot.sendMessage(chatId, "Error downloading image for upscaling.");
                    });

                } catch (err) {
                    console.error("Upscale Command Error:", err);
                    bot.sendMessage(chatId, "Sorry, an error occurred while trying to upscale the image.");
                }
                break;

            case 'ttt':
                // Tic Tac Toe logic (defined below)
                await handleTicTacToe(chatId, userId, msg.from.username || msg.from.first_name, args, msg);
                break;

            default:
                bot.sendMessage(chatId, `Unknown command: ${PREFIX}${command}\nType ${PREFIX}menu to see available commands.`);
        }
    } catch (error) {
        console.error(`Error processing command '${command}':`, error.message, error.stack);
        bot.sendMessage(chatId, "Oops! Something went wrong while I was processing that. Please try again. ⚡");
    }
});


// --- Tic Tac Toe Game State & Logic ---
const ticTacToeGames = {}; // In-memory store: { chatId: { board: [], currentPlayer: 'X', players: { X: {id, name}, O: {id, name} }, messageId: null, status: 'pending'/'active' } }

function getTicTacToeBoardText(board, players) {
    let boardText = "Tic Tac Toe:\n";
    for (let i = 0; i < 3; i++) {
        boardText += ` ${board[i * 3] || (i * 3 + 1)} | ${board[i * 3 + 1] || (i * 3 + 2)} | ${board[i * 3 + 2] || (i * 3 + 3)} \n`;
        if (i < 2) boardText += "---|---|---\n";
    }
    if(players) {
        boardText += `\nX: ${players.X.name}\nO: ${players.O.name ? players.O.name : '(Waiting...)'}\n`;
    }
    return boardText;
}

function checkTicTacToeWin(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let line of lines) {
        if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[0]] === board[line[2]]) {
            return board[line[0]]; // Returns 'X' or 'O'
        }
    }
    if (board.every(cell => cell)) return 'draw'; // All cells filled
    return null; // No winner yet
}

async function handleTicTacToe(chatId, userId, userName, args, originalMsg) {
    const subCommand = args[0] ? args[0].toLowerCase() : null;
    let game = ticTacToeGames[chatId];

    if ((subCommand === 'start' || (subCommand && subCommand.startsWith('@'))) && (!game || game.status === 'ended')) {
        if (game && game.status !== 'ended') { // A game is active or pending
            bot.sendMessage(chatId, "A game is already in progress or pending in this chat!");
            return;
        }
        const opponentMention = subCommand.startsWith('@') ? subCommand : (args[1] && args[1].startsWith('@') ? args[1] : null);
        if (!opponentMention) {
            bot.sendMessage(chatId, `To start a game, mention an opponent: ${PREFIX}ttt @username`);
            return;
        }
        const opponentUsername = opponentMention.slice(1);

        // Prevent playing against self by username
        if (opponentUsername.toLowerCase() === userName.toLowerCase()) {
            bot.sendMessage(chatId, "You can't play Tic Tac Toe against yourself!");
            return;
        }


        ticTacToeGames[chatId] = {
            board: Array(9).fill(null),
            currentPlayer: 'X',
            players: { X: { id: userId, name: userName }, O: { id: null, name: opponentUsername } },
            status: 'pending',
            messageId: null
        };
        game = ticTacToeGames[chatId]; // refresh game variable
        const invMsg = await bot.sendMessage(chatId, `@${opponentUsername}, ${userName} challenges you to Tic Tac Toe!\nType \`${PREFIX}ttt accept\` to play. Or \`${PREFIX}ttt decline\`.`, { parse_mode: "Markdown" });
        game.messageId = invMsg.message_id;
        return;
    }

    if (subCommand === 'accept') {
        if (!game || game.status !== 'pending') {
            bot.sendMessage(chatId, "No pending game to accept or game already started.");
            return;
        }
        // Check if the acceptor is the one who was challenged
        if (game.players.O.name.toLowerCase() !== userName.toLowerCase()) {
            bot.sendMessage(chatId, "This challenge is not for you, or you are the challenger.");
            return;
        }
        // Prevent challenger from accepting
        if (game.players.X.id === userId) {
            bot.sendMessage(chatId, "You started this challenge, waiting for the opponent to accept.");
            return;
        }

        game.players.O.id = userId; // Assign ID to player O
        game.status = 'active';
        const boardText = getTicTacToeBoardText(game.board, game.players);
        const turnMsg = await bot.sendMessage(chatId, `${boardText}\nGame started! It's ${game.players[game.currentPlayer].name}'s (${game.currentPlayer}) turn.\nUse \`${PREFIX}ttt move [1-9]\``, { parse_mode: "Markdown" });
        if (game.messageId) { try { await bot.deleteMessage(chatId, game.messageId); } catch(e){/*ignore*/} }
        game.messageId = turnMsg.message_id;
        return;
    }
     if (subCommand === 'decline') {
        if (!game || game.status !== 'pending') {
            bot.sendMessage(chatId, "No pending game to decline.");
            return;
        }
        if (game.players.O.name.toLowerCase() === userName.toLowerCase() || game.players.X.id === userId) {
            await bot.sendMessage(chatId, `${userName} declined/cancelled the Tic Tac Toe challenge.`);
            if (game.messageId) { try { await bot.deleteMessage(chatId, game.messageId); } catch(e){/*ignore*/} }
            delete ticTacToeGames[chatId];
        } else {
            bot.sendMessage(chatId, "You are not part of this pending challenge.");
        }
        return;
    }


    if (!game || game.status !== 'active') {
        bot.sendMessage(chatId, `No active game. Start one with ${PREFIX}ttt @username or accept a pending challenge.`);
        return;
    }

    if (subCommand === 'move') {
        if (game.players[game.currentPlayer].id !== userId) {
            bot.sendMessage(chatId, "It's not your turn!");
            return;
        }
        const move = parseInt(args[1]);
        if (isNaN(move) || move < 1 || move > 9 || game.board[move - 1]) {
            bot.sendMessage(chatId, "Invalid move. Choose an empty cell number from 1 to 9.");
            return;
        }
        game.board[move - 1] = game.currentPlayer;
        const winner = checkTicTacToeWin(game.board);
        
        let messageContent = getTicTacToeBoardText(game.board, game.players) + "\n";

        if (winner) {
            if (winner === 'draw') {
                messageContent += "It's a draw! 🤝";
            } else {
                messageContent += `Player ${game.players[winner].name} (${winner}) wins! 🎉`;
            }
            game.status = 'ended'; // Mark game as ended
            // No need to delete game from ticTacToeGames immediately if you want to show final board
            // delete ticTacToeGames[chatId];
        } else {
            game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
            messageContent += `It's ${game.players[game.currentPlayer].name}'s (${game.currentPlayer}) turn.\nUse \`${PREFIX}ttt move [1-9]\``;
        }
        
        // Edit the existing game message or send a new one
        if (game.messageId) {
            try {
                await bot.editMessageText(messageContent, { chat_id: chatId, message_id: game.messageId, parse_mode: "Markdown" });
            } catch (editError) { // If editing fails (e.g., message too old), send a new one
                console.warn("TTT: Could not edit message, sending new one.", editError.message);
                const newMsg = await bot.sendMessage(chatId, messageContent, { parse_mode: "Markdown" });
                game.messageId = newMsg.message_id;
            }
        } else {
            const newMsg = await bot.sendMessage(chatId, messageContent, { parse_mode: "Markdown" });
            game.messageId = newMsg.message_id;
        }
        if (winner) delete ticTacToeGames[chatId]; // Clean up ended game

        return;
    }
     if (subCommand === 'quit' || subCommand === 'end') {
        if (game.players.X.id === userId || (game.players.O.id && game.players.O.id === userId)) {
            await bot.sendMessage(chatId, `${userName} has ended the Tic Tac Toe game.`);
            if (game.messageId) { try { await bot.deleteMessage(chatId, game.messageId); } catch(e){/*ignore*/} }
            delete ticTacToeGames[chatId];
        } else {
            bot.sendMessage(chatId, "Only players in the current game can end it.");
        }
        return;
    }
    
    // If just .ttt and game is active, show current board and turn
    if (game && game.status === 'active') {
        const boardText = getTicTacToeBoardText(game.board, game.players);
        const currentTurnPlayer = game.players[game.currentPlayer];
        const statusMessage = `${boardText}\nIt's ${currentTurnPlayer.name}'s (${game.currentPlayer}) turn.\nUse \`${PREFIX}ttt move [1-9]\``;
        if (game.messageId) {
            try {
                await bot.editMessageText(statusMessage, { chat_id: chatId, message_id: game.messageId, parse_mode: "Markdown" });
            } catch (e) {
                const newMsg = await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
                game.messageId = newMsg.message_id;
            }
        } else {
            const newMsg = await bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" });
            game.messageId = newMsg.message_id;
        }
    } else if (game && game.status === 'pending') {
         await bot.sendMessage(chatId, `Game pending. Waiting for @${game.players.O.name} to type \`${PREFIX}ttt accept\`.`, {parse_mode: "Markdown"});
    }
}

// --- Global Error Handlers ---
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.code} - ${error.message}`);
    // You might want to add more sophisticated error handling or restart logic here.
});

bot.on('webhook_error', (error) => {
    console.error(`Webhook error: ${error.code} - ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Application specific logging, throwing an error, or other logic here
  // It's often recommended to gracefully shutdown the process on uncaught exceptions
  // process.exit(1);
});

console.log(`${BOT_NAME} is now fully initialized and listening for commands.`);