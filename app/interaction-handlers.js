// app/interaction-handlers.js

const feedbackHelper = require('../helpers/feedback');
const detailsHelper = require('../helpers/details');
const { AskPlugin } = require('../plugins/ask/ask');

const registerInteractiveComponents = (app) => {
  app.action('regenerate_response', async ({ ack, body, client }) => {
    await ack();
  
      const { channel, message } = body;
  
      // Find the timestamp of the AI's response message
      const originalResponseTs = message.ts;
  
      const pseudoCommand = {
        channel_id: channel.id,
        text: message.blocks[0].text.text, // This assumes the first block contains the user's question
        user_id: body.user.id,
      };
  
      const thread_ts = message.thread_ts || message.ts;
  
      // Pass the timestamp of the original AI response to handle method
      await AskPlugin.handle(pseudoCommand, client, thread_ts, true, originalResponseTs);
  });

  app.action(/^(like|dislike)_response$/, async (args) => {
    await feedbackHelper.processFeedback(args);
  });

  app.view('improvement_feedback_modal', async (args) => {
    await feedbackHelper.handleImprovementFeedbackSubmission(args);
  });

  app.action('view_document_details', async (args) => {
    await detailsHelper.viewDocumentDetails(args);
  });

  // Add more interactive components here
};

const registerMessageReplies = (app) => {
  app.message(async ({ message, client, event }) => {
       // Ignore messages from the bot itself to prevent an infinite loop
       if (message.subtype === 'bot_message') {
        return;
      }
   
      // Check if the message is in a thread
      if (message.thread_ts) {
        // Construct a pseudo-command object to match the expected structure in AskPlugin.handle
        const pseudoCommand = {
          channel_id: event.channel,
          text: message.text,
          user_id: message.user,
        };
        
        // Use the AskPlugin to handle the conversation logic and Cohere API call
        await AskPlugin.handle(pseudoCommand, client, message.thread_ts);
      }
  });

  // Add more message reply handlers here
};

module.exports = {
  registerInteractiveComponents,
  registerMessageReplies,
};