// helpers/details.js

const viewDocumentDetails = async ({ ack, body, client }) => {
    await ack();
  
    if (!AskPlugin.searchResults || AskPlugin.searchResults.length === 0) {
      console.error('Error: searchResults is not populated.');
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
    const thread_ts = body.message.thread_ts || body.message.ts;
  
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
  
    await client.chat.postEphemeral({
      channel: channel,
      thread_ts: thread_ts,
      user: user,
      blocks: blocks,
      mrkdwn: true,
    });
  };
  
  module.exports = {
    viewDocumentDetails
  };