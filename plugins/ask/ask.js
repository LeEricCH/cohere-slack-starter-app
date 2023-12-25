// ./plugins/ask/ask.js

const axios = require('axios');

const COHERE_API_TOKEN = process.env.COHERE_API_TOKEN;
const COHERE_API_ENDPOINT = 'https://api.cohere.ai/v1/chat';

class AskPlugin {
  static searchResults = [];
  static async handle(command, client, thread_ts, isRegeneration = false, originalResponseTs = null) {
    let loadingMessageTs = originalResponseTs;

    if (!isRegeneration) {
      // Post a loading message only if it's not a regeneration
      const loadingMessage = await client.chat.postMessage({
        channel: command.channel_id,
        thread_ts: thread_ts,
        text: "Generating response...",
      });
      loadingMessageTs = loadingMessage.ts;
    } else {
      // Update the message to "Re-generating..." if it's a regeneration
      await client.chat.update({
        channel: command.channel_id,
        ts: loadingMessageTs,
        text: "Re-generating...",
      });
    }
    try {
    
      // Get the conversation history for the thread
      const history = await AskPlugin.getThreadHistory(client, command.channel_id, thread_ts);

      // Exclude the last message (user's query) from the history if it's not a regeneration
      const filteredHistory = isRegeneration ? history : history.slice(0, -1);

      // Format the chat_history for the Cohere API
      const chat_history = filteredHistory.map(msg => ({
        role: msg.user === command.user_id ? 'USER' : 'ASSISTANT',
        message: msg.text,
      }));

      console.log(chat_history);

      // Initialize the connectors array
      const connectors = [{ id: "web-search" }];

      // Regular expression to find URLs in the text
      const urlRegex = /https?:\/\/(?:www\.)?([^\/\s]+)(\/\S*)?/gi;
      // Extract the first URL from the message text
      const urlMatch = urlRegex.exec(command.text);
      
      // If a URL is found, restrict the web search to the domain of the URL
      if (urlMatch) {
        const fullDomain = urlMatch[1]; // Full domain from the URL
        const domainParts = fullDomain.split('.').slice(-3); // Get the last three parts of the domain
        const restrictedDomain = domainParts.join('.'); // Join to get domain.tld or subdomain.domain.tld

        // Add the 'site' option to the connectors
        connectors[0].options = { site: restrictedDomain };
      }

      // Prepare the request body for the Cohere API call
      const requestBody = {
        model: 'command',
        chat_history,
        message: command.text,
        connectors: connectors // Include the web-search connector with optional site restriction
      };

      // Perform the API call to Cohere
      const response = await axios.post(COHERE_API_ENDPOINT, requestBody, {
        headers: {
          'Authorization': `Bearer ${COHERE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      // Check if the Cohere API returned a message
      if (!response.data.text) {
        throw new Error('No message returned from Cohere API');
      }

      // Format the message with markdown (if needed)
      const formattedMessageText = `${response.data.text}`;

    // Extract search queries and results (if any) from the Cohere response
    let searchResultsSection;
    if (response.data.documents && response.data.documents.length > 0) {
      // Store the search results
      AskPlugin.searchResults = response.data.documents;

      // Truncate text to fit within the character limit for static_select options
      const truncateText = (text, maxLength) => {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength - 3) + '...';
      };


      // Create an option for each document
      const documentOptions = response.data.documents.map((document, index) => ({
        text: {
          type: "plain_text",
          text: truncateText(document.title, 75),
        },
        value: `document_${index}`, // Unique value for each option
      }));

      // Add a multi_static_select block for search results
      searchResultsSection = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Search Results:*",
        },
        accessory: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Results...",
          },
          options: documentOptions,
          action_id: "view_document_details",
        },
      };
    }

    // Build the blocks array conditionally
    const blocks = [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": formattedMessageText,
        }
      },
      {
        "type": "divider"
      }
    ];

    // Only add the searchResultsSection if it is defined
    if (searchResultsSection) {
      blocks.push(searchResultsSection);
    }

    // Always include the Regenerate button and Like/Dislike buttons
    blocks.push({
      "type": "actions",
      "elements": [
        // Existing Regenerate button
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Regenerate",
          },
          "value": "regenerate",
          "action_id": "regenerate_response"
        },
        // Like button
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "emoji": true,
            "text": ":thumbsup:" // Use an emoji or text for the Like button
          },
          "value": "like",
          "action_id": "like_response"
        },
        // Dislike button
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "emoji": true,
            "text": ":thumbsdown:" // Use an emoji or text for the Dislike button
          },
          "value": "dislike",
          "action_id": "dislike_response"
        },
            // Overflow menu
        {
          "type": "overflow",
          "options": [
            {
              "text": {
                "type": "plain_text",
                "text": "META VALUES BELOW",
                "emoji": true
              },
              "value": "ignore"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "Query: " + command.text
              },
              "value": `query:${command.text}` // Store the user's query in the value
            },
            {
              "text": {
                "type": "plain_text",
                "text": "Asked by <@" + command.user_id + ">"
              },
              "value": `user:${command.user_id}` // Store the user ID in the value
            }
          ],
          "action_id": "store_query_and_user"
        }
      ]
    });

      // Filter out any undefined or invalid blocks before sending
      const validBlocks = blocks.filter(block => block !== undefined && block !== null);

      // Update the loading message with the actual response and search results using Blocks
      await client.chat.update({
        channel: command.channel_id,
        ts: loadingMessageTs,
        text: response.data.text, // Fallback text for notifications and environments without blocks
        blocks: validBlocks,
        mrkdwn: true,
      });
    } catch (error) {
      console.error(error);
      
      // Update the loading message with an error message
      await client.chat.update({
        channel: command.channel_id,
        ts: loadingMessageTs, // Timestamp of the loading message
        text: "Sorry, I encountered an error while generating a response. (Error: " + error.message + ")",
      });
    }
  }

  static async getThreadHistory(client, channel, thread_ts) {
    // Fetch the history of messages in the thread
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts,
    });

    // Return an array of messages
    return result.messages;
  }
}

module.exports = { AskPlugin };