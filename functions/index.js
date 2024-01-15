/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendNotificationOnUpdate = functions.firestore
    .document('messages/{messageId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        const userIds = newData.userId;

        if (userIds && userIds.length > 0) {
            // Fetch user information from the "users" collection
            const user1Doc = await admin.firestore().collection('user').doc(userIds[0]).get();
            const user2Doc = await admin.firestore().collection('user').doc(userIds[1]).get();

            // Extract user names
            const userName1 = user1Doc.exists ? user1Doc.data().name : 'User 1';
            const userName2 = user2Doc.exists ? user2Doc.data().name : 'User 2';

            const topic1 = userIds[0];
            const topic2 = userIds[1];

            // Check if the "messages" field length has changed
            if (newData.messages.length > oldData.messages.length) {
                // Extract the last message from the "messages" field
                const lastMessage = newData.messages[newData.messages.length - 1];

                const payload1 = {
                    notification: {
                        title: userName2,
                        body: lastMessage.message,
                    },
                };

                const payload2 = {
                    notification: {
                        title: userName1,
                        body: lastMessage.message,
                    },
                };

                if (lastMessage.sender === topic1) {
                    // Send notification to the second topic
                    await admin.messaging().sendToTopic(topic2, payload2);
                    console.log(`Notification sent to topic: ${topic2}`);
                } else {
                    // Send notification to the first topic
                    await admin.messaging().sendToTopic(topic1, payload1);
                    console.log(`Notification sent to topic: ${topic1}`);
                }

            } else {
                console.log('No new messages.');
            }
        }
    });
