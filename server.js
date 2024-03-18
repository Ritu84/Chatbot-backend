const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Conversation data storage
const conversationData = {};

// Function to send API request
async function sendRequest(method, url, headers, data) {
    try {
        const response = await axios({
            method,
            url,
            headers,
            data
        });
        return response.data;
    } catch (error) {
        throw new Error(`API Request Failed: ${error.message}`);
    }
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        const { Sender, Conversation } = req.body;
        const conversationId = Conversation.id;

        // Initialize conversation data if not exists
        if (!conversationData[conversationId]) {
            conversationData[conversationId] = {};
        }

        // Process user messages
        for (const message of Conversation.Message) {
            if (message.Type === 'incoming') {
                switch (Object.keys(conversationData[conversationId]).length) {
                    case 0: // No data collected yet, start account creation process
                        await handleAccountCreation(Sender.Id, message.Content, conversationId);
                        break;
                    case 1: // Account name collected, now collect other details for user creation
                        conversationData[conversationId].name = message.Content;
                        await handleUserCreation(Sender.Id, message.Content, conversationId);
                        break;
                    default:
                        break;
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});

// Function to handle account creation
async function handleAccountCreation(userId, accountName, conversationId) {
    try {
        const accountExists = await checkAccountExistence(accountName);
        if (accountExists) {
            await sendMessage(userId, 'Account already exists. Please provide a new account name.', conversationId);
        } else {
            const accountData = await sendRequest('POST', 'https://bow.app/platform/api/v1/account', {
                api_access_token: 'dummytokenvalue'
            }, {
                name: accountName,
                agents: 1,
                Inboxes: 1
            });
            conversationData[conversationId].accountId = accountData.Id;
            await sendMessage(userId, 'Account created successfully. Please provide your name.', conversationId);
        }
    } catch (error) {
        throw error;
    }
}

// Function to handle user creation
async function handleUserCreation(userId, userName, conversationId) {
    try {
        const userData = await sendRequest('POST', 'https://bow.app/platform/api/v1/users', {
            api_access_token: 'dummytokenvalue'
        }, {
            name: userName,
            email: conversationData[conversationId].email,
            password: 'password' // You might want to handle password input securely
        });
        conversationData[conversationId].userId = userData.id;
        await sendUserToAccount(conversationData[conversationId].accountId, userData.id);
        await sendMessage(userId, 'User created successfully.', conversationId);
    } catch (error) {
        throw error;
    }
}

// Function to check if account exists
async function checkAccountExistence(accountName) {
    try {
        const response = await sendRequest('GET', 'https://bow.app/platform/api/v1/accounts', {
            api_access_token: 'dummytokenvalue'
        }, {
            params: {
                name: accountName
            }
        });
        return response.length > 0;
    } catch (error) {
        throw error;
    }
}

// Function to send user to account
async function sendUserToAccount(accountId, userId) {
    try {
        await sendRequest('POST', `https://bow.app/platform/api/v1/accounts/${accountId}/account_users`, {
            api_access_token: 'dummytokenvalue'
        }, {
            user_id: userId,
            role: 'agent' // Assuming role is 'agent'
        });
    } catch (error) {
        throw error;
    }
}

// Function to send message
async function sendMessage(userId, message, conversationId) {
    // Implement sending message logic here, such as using a messaging platform API
    console.log(`Message sent to user ${userId}: ${message}`);
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
