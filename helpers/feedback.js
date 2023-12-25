// feedback.js

const processFeedback = async ({ ack, body, client, action, say }) => {
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
      text: "Thank you for your feedback!"
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

};

const openImprovementFeedbackModal = async ({ ack, body, client, say }) => {
  // Acknowledge the view request
  await ack();

  // Logic to open the improvement feedback modal
  // ...
};

const handleImprovementFeedbackSubmission = async ({ ack, body, view, client, say }) => {
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
      text: "Thank you for your feedback!"
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
};

module.exports = {
  processFeedback,
  openImprovementFeedbackModal,
  handleImprovementFeedbackSubmission
};