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
const stripe = require('stripe')('sk_test_51OacRkBAoDiFLBXwJw5Pg3ujPQfvSlYXsqAqrVflNlcO5aANsFpC6JituNYFLc6Yi9e2cseqY2QBelXzifgD1fGg00AiXWcdxD');
// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendNotificationOnUpdate = functions.firestore
  .document("messages/{messageId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();

    const userIds = newData.userId;

    if (userIds && userIds.length > 0) {
      // Fetch user information from the "users" collection
      const user1Doc = await admin
        .firestore()
        .collection("user")
        .doc(userIds[0])
        .get();
      const user2Doc = await admin
        .firestore()
        .collection("user")
        .doc(userIds[1])
        .get();

      // Extract user names
      const userName1 = user1Doc.exists ? user1Doc.data().name : "User 1";
      const userName2 = user2Doc.exists ? user2Doc.data().name : "User 2";

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
        console.log("No new messages.");
      }
    }
  });

exports.updateReview = functions.firestore
  .document("post/{postId}")
  .onCreate(async (snapshot, context) => {
    const postData = snapshot.data();

    if (!postData || !postData.rating) {
      console.log("Rating is not available or not a number. Exiting function.");
      return null;
    }

    const { bookId, rating } = postData;

    const bookRef = admin.firestore().collection("book").doc(bookId);

    try {
      const bookDoc = await bookRef.get();

      if (!bookDoc.exists) {
        throw new Error("Book document does not exist");
      }

      const bookData = bookDoc.data();

      const updatedTotalRating = (bookData.totalRating || 0) + rating;
      const updatedTotalRatingCount = (bookData.totalRatingCount || 0) + 1;

      // Update the book document
      await bookRef.update({
        totalRating: updatedTotalRating,
        totalRatingCount: updatedTotalRatingCount,
      });

      console.log("Book document updated successfully");
    } catch (error) {
      console.error("Error updating book document:", error);
      throw new Error("Update failed");
    }
    // Extract userId from the new post
    const userId = postData.userId;

    const postOwner = await admin
      .firestore()
      .collection("user")
      .doc(userId)
      .get();

    const taggedBook = await admin
      .firestore()
      .collection("book")
      .doc(postData.bookId)
      .get();

    // Construct the topic using userId
    const topic = `user_${userId}_posts`;

    // Notification payload
    const payload = {
      notification: {
        title: `${postOwner.data().name} just posted a new review for ${taggedBook.data().title}`,
        body: newPost.title,
        // You can customize other notification properties here
      },
      android: {
        notification: {
          imageUrl: taggedBook.imageUrl,
        }
      },
    };

    // Send the notification to the constructed topic
    return admin.messaging().sendToTopic(topic, payload)
      .then((response) => {
        console.log('Notification sent successfully:', response);
        return null;
      })
      .catch((error) => {
        console.error('Error sending notification:', error);
        return null;
      });
  });

exports.createPaymentIntent = functions.https.onRequest(async (req, res) => {
  // Use an existing Customer ID if this is a returning customer.
  const customer = await stripe.customers.create();
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2023-10-16' }
  );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1099,
    currency: 'usd',
    customer: customer.id,
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.json({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
    publishableKey: 'pk_test_51OacRkBAoDiFLBXw3m5QAZhwJwX3kqnYqNBMxa9ZPqkCbGWumFwlsysuvCXCeBMgoDFkrdbHMIeYI4Vx3sPk0m9T00VkLoUMAP'
  });
});
