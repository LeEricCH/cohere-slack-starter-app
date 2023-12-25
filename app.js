require("dotenv").config();

const { App, LogLevel } = require("@slack/bolt");
const { Mention, Reaction } = require("./plugins/index");
const { AskPlugin } = require('./plugins/ask/ask');
// const { SummarizePlugin } = require('../summarize'); // Import the SummarizePlugin


const cohere = require("cohere-ai");
/**
 * a co:here-flavoured @slack/bolt app
 *
 * register plugins on creation and expects callers to invoke `serve()`
 */
class CohereSlackApp {
  constructor() {
    const cfg = {
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    };
    this.app = new App(cfg);

    this.mentionPlugins = {};
    this.registerMentionPlugins();

    this.reactionPlugins = {};
    this.registerReactionPlugins();

    this.registerSlashCommands();

    this.registerInteractiveComponents();

    this.registerMessageReplies();
  }

  registerSlashCommands() {
    this.app.command('/ask', async ({ command, ack, say, client }) => {
      try {
        // Acknowledge the command request
        await ack();
  
        // Extract the question from the command text
        const question = command.text;
  
        const formattedQuestion = `*Question:*\n${question}`;

        // Start a thread with the initial question formatted with markdown
        const messageResponse = await say({
          text: formattedQuestion,
          thread_ts: command.ts,
          mrkdwn: true, // Enable markdown
        });


        // Verify the thread_ts is returned correctly
        if (!messageResponse.ts) {
          console.error('Error: thread_ts not returned from say method');
          return;
        }
  
        // Use the AskPlugin to handle the conversation logic and Cohere API call
        await AskPlugin.handle(command, client, messageResponse.ts);
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Register interactive components like buttons
  registerInteractiveComponents() {
    this.app.action('regenerate_response', async ({ ack, body, client }) => {
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

    // Add a new action listener for the like_response and dislike_response actions
this.app.action(/^(like|dislike)_response$/, async ({ ack, body, client, action }) => {
  await ack();
  console.log(JSON.stringify(body, null, 2));

  const { user, message } = body;
  const feedbackChannelId = process.env.FEEDBACK_CHANNEL_ID; // Replace with the actual channel ID of #happyai-feedback

  // Find the block with the AI response by looking for a block that starts with "*Response:*"
  const responseBlock = message.blocks.find(block =>
    block.type === 'section' &&
    block.text &&
    block.text.type === 'mrkdwn'
  );
  const responseText = responseBlock ? responseBlock.text.text : 'Response not found';

  const messageTs = body.container.thread_ts || body.container.message_ts; // Use thread_ts if available, otherwise fall back to message_ts

  // Construct the permalink to the original message in the thread
  const originalMessagePermalink = `https://${body.team.domain}.slack.com/archives/${body.channel.id}/p${messageTs.replace('.', '')}`;

  // Find the overflow menu within the blocks
  const overflowBlock = message.blocks.find(block => block.elements && block.elements.some(element => element.type === 'overflow'));
  const overflowMenu = overflowBlock ? overflowBlock.elements.find(element => element.type === 'overflow') : null;

  // Retrieve the stored query and user ID from the overflow menu options
  const queryOption = overflowMenu ? overflowMenu.options.find(option => option.value.startsWith('query:')) : null;
  const userOption = overflowMenu ? overflowMenu.options.find(option => option.value.startsWith('user:')) : null;

  const queryText = queryOption ? queryOption.value.split(':')[1] : 'Query not found';
  const askedByUserId = userOption ? userOption.value.split(':')[1] : 'User ID not found';

  const userId = body.user.id;
  const feedbackType = action.value;
  const originalMessageTs = body.message.ts;
  const channelId = body.channel.id;
  const threadTs = body.container.thread_ts || body.container.message_ts;
  console.log('threadTs', threadTs)
  
  // Fetch recent messages from the feedback channel
  const recentMessages = await client.conversations.history({
    channel: feedbackChannelId,
    limit: 30 // Adjust the limit as needed
  });

  // Check for existing feedback from the same user for the same original message
  const duplicateFeedback = recentMessages.messages.some(message => {
    // Assuming the feedback message format includes user ID and original message timestamp
    return message.text.includes(`<@${userId}>`) && message.text.includes(`Original message timestamp: ${originalMessageTs}`);
  });

  if (duplicateFeedback) {
    // Send an ephemeral message to the user informing them that they've already sent feedback
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: userId,
      text: "You've already provided feedback for this message."
    });
  } else {
     // Create blocks for the formatted feedback message
     const feedbackBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${feedbackType === 'like' ? '👍 Liked' : '👎 Disliked'} Response`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*User Query:*\n${queryText}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*Response:*```\n" + responseText + "\n```"
        },
      },
    ];
    
    // Check if askedByUserId is the same as userId
    if (askedByUserId === userId) {
      feedbackBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Query & Feedback by: <@${userId}>`,
          },
        ],
      });
    } else {
      feedbackBlocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Query by: <@${askedByUserId}> | Feedback by: <@${userId}>`,
          },
        ],
      });
    }

    // Add a "View Message" button to the feedbackBlocks
    feedbackBlocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Message'
          },
          url: originalMessagePermalink,
          action_id: 'view_original_message'
        }
      ]
    });

  // Open a modal for feedback if the feedback type is "dislike"
  if (feedbackType === 'dislike') {
    const metadata = JSON.stringify({
      responseText: responseText,
      queryText: queryText,
      askedByUserId: askedByUserId,
      userId: userId,
      channel: channelId,
      thread_ts: threadTs,
      originalMessagePermalink: originalMessagePermalink,
    });
   
  
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'improvement_feedback_modal', // Unique identifier for the modal
        title: {
          type: 'plain_text',
          text: 'Improvement Feedback'
        },
        submit: {
          type: 'plain_text',
          text: 'Submit'
        },
        blocks: [
          {
            type: 'input',
            block_id: 'improvement_feedback',
            element: {
              type: 'plain_text_input',
              action_id: 'feedback_input',
              multiline: true
            },
            label: {
              type: 'plain_text',
              text: 'Your feedback'
            }
          }
        ],
        private_metadata: metadata, 
      }
    });
  } else if (action.value === 'like') {

    const postResult = await client.chat.postMessage({
      channel: feedbackChannelId,
      blocks: feedbackBlocks,
    });
    
  // Check if the feedback message was posted successfully
  if (postResult.ok) {
    // Send an ephemeral message to the user to confirm successful posting
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: threadTs,
      user: userId,
      text: "Thank you for your feedback! It has been posted successfully."
    });
  } else {
    // If the feedback message failed to post, log the error and notify the user
    console.error('Failed to post feedback message:', postResult.error);
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: threadTs,
      user: userId,
      text: "Sorry, there was an issue posting your feedback. Please try again."
    });
  }

    
  }
  }

  


});

this.app.view('improvement_feedback_modal', async ({ ack, body, view, client }) => {
  await ack();

  const userId = body.user.id;
  const feedbackChannelId = process.env.FEEDBACK_CHANNEL_ID
  const feedbackInput = view.state.values.improvement_feedback.feedback_input.value;
  // Parse the private_metadata to get the stored data
  const metadata = JSON.parse(view.private_metadata);
  const { responseText, queryText, askedByUserId, originalMessagePermalink, channel, thread_ts } = metadata;

  // Reconstruct feedbackBlocks using the data from private_metadata
  const feedbackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '👎 Disliked Response',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*User Query:*\n${queryText}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "*Response:*```\n" + responseText + "\n```"
      },
    },

  ];

    // Add the user's additional comments to the feedbackBlocks
    if (feedbackInput) {
      feedbackBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Additional Feedback:*\n${feedbackInput}`
        }
      });
    }

  // Check if askedByUserId is the same as userId
  if (askedByUserId === userId) {
    feedbackBlocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Query & Feedback by: <@${userId}>`,
        },
      ],
    });
  } else {
    feedbackBlocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Query by: <@${askedByUserId}> | Feedback by: <@${userId}>`,
        },
      ],
    });
  }

  try {
  // Post the feedback to the feedback channel including the additional comments
  const postResult = await client.chat.postMessage({
    channel: feedbackChannelId,
    text: 'Feedback submitted',
    blocks: feedbackBlocks
  });

  // Check if the feedback message was posted successfully
  if (postResult.ok) {
    // Send an ephemeral message to the user to confirm successful posting
    await client.chat.postEphemeral({
      channel: channel,
      thread_ts: thread_ts,
      user: userId,
      text: "Thank you for your feedback! It has been posted successfully."
    });
  } else {
    // If the feedback message failed to post, log the error and notify the user
    console.error('Failed to post feedback message:', postResult.error);
    await client.chat.postEphemeral({
      channel: channel,
      thread_ts: thread_ts,
      user: userId,
      text: "Sorry, there was an issue posting your feedback. Please try again."
    });
  }


} catch (error) {
  console.error('Failed to post feedback message:', error);
}

});

      // Add a new action listener for the view_document_details action
      this.app.action('view_document_details', async ({ ack, body, client }) => {
        await ack();
      
        if (!AskPlugin.searchResults || AskPlugin.searchResults.length === 0) {
          console.error('Error: searchResults is not populated.');
          // Send an error message to the user
          await client.chat.postEphemeral({
            channel: body.channel.id,
            thread_ts: body.message.thread_ts,
            user: body.user.id,
            text: "Sorry, I couldn't find the search results. Please try again."
          });
          return;
        }
      
        const action = body.actions[0];
        if (!action || !action.selected_option) {
          console.error('Error: No selected option found.');
          // Send an error message to the user
          await client.chat.postEphemeral({
            channel: body.channel.id,
            thread_ts: body.message.thread_ts,
            user: body.user.id,
            text: "Sorry, I couldn't find the selected document. Please try again."
          });
          return;
        }
      
        const selectedDocumentValue = action.selected_option.value;
        const docIndex = parseInt(selectedDocumentValue.replace('document_', ''), 10);
        const document = AskPlugin.searchResults[docIndex];
      
        if (!document) {
          console.error('Error: Document not found.');
          // Send an error message to the user
          await client.chat.postEphemeral({
            channel: body.channel.id,
            thread_ts: body.message.thread_ts,
            user: body.user.id,
            text: "Sorry, I couldn't find the document details. Please try again."
          });
          return;
        }
      
        const user = body.user.id;
        const channel = body.channel.id;
        const thread_ts = body.message.thread_ts || body.message.ts; // Use the thread_ts from the original message
      
        // Create blocks for the ephemeral message
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: document.url ? `:mag: *<${document.url}|${document.title}>*` : `:mag: *${document.title}*`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: document.snippet
            },
          },
        ];
        
      
        // Send an ephemeral message with the details of the selected document
        await client.chat.postEphemeral({
          channel: channel,
          thread_ts: thread_ts, // Post in the thread
          user: user,
          blocks: blocks,
          mrkdwn: true,
        });
      });
  }



  

  async handleConversation(command, client, thread_ts) {
    // Initialize the Cohere client
    cohere.init(process.env.COHERE_API_TOKEN);
  
    // Get the conversation history for the thread
    const history = await this.getThreadHistory(client, command.channel_id, thread_ts);
  
    // Format the chat_history for the Cohere API
    const chat_history = history.map((msg) => ({
      role: msg.user === command.user_id ? 'USER' : 'ASSISTANT',
      message: msg.text
    }));
  
    // Call the Cohere chat endpoint
    const cohereResponse = await cohere.chat({
      model: 'command', // Use the appropriate model
      chat_history,
      message: command.text
    });
  
    // Check for errors in the Cohere response
    if (cohereResponse.statusCode !== 200) {
      throw new Error(`${cohereResponse.statusCode} received from Cohere API`);
    }
  
    // Post the Cohere response in the thread
    await client.chat.postMessage({
      channel: command.channel_id,
      thread_ts: thread_ts,
      text: cohereResponse.body.message // Use the message from the response
    });
  }
  
  async getThreadHistory(client, channel, thread_ts) {
    // Fetch the history of messages in the thread
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts
    });
  
    // Return an array of messages
    return result.messages;
  }


// Add this method to register an event listener for messages in a thread
registerMessageReplies() {
  this.app.message(async ({ message, say, client, event }) => {
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
}



  /**
   * start an http server configured with handlers supplied by
   * registered plugins
   */
  async serve() {
    await this.app.start(process.env.PORT || 3000);
    console.log("⚡️ Bolt app is running!", process.env.PORT);
  }

  /**
   * register plugins from ./plugins/mentions
   *
   * 🔧 require a plugin and add it to `mentionPlugins`
   */
  registerMentionPlugins() {
    const { PingPlugin } = require("./plugins/mentions/ping");
    // const { SummarizePlugin } = require("./plugins/mentions/summarize");
    const mentionPlugins = [PingPlugin];

    mentionPlugins.forEach((plugin) => {
      const { name, exec } = plugin;
      this.mentionPlugins[name] = exec;
    });

    this.app.event("app_mention", async ({ event, context, client, say }) => {
      console.info(event);

      const mention = new Mention(event);
      const subcommand = mention.subcommand();
      const func = this.mentionPlugins[subcommand];

      try {
        const response = await func(event);

        // threaded response
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: response,
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  /**
   * register plugins from ./plugins/reactions
   *
   * 🔧 require a plugin and add it to `reactionPlugins`
   */
  registerReactionPlugins() {
    const { SummarizePlugin } = require("./plugins/reactions/summarize");
  
    this.app.event("reaction_added", async ({ event, client }) => {
      console.info(event);
  
      if (event.reaction === SummarizePlugin.name) {
        await SummarizePlugin.exec(event, client);
      }
    });
  }

  
}

module.exports = { CohereSlackApp };
