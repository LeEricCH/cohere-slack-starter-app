// ./tests/ask.test.js

const test = require("ava");
const sinon = require('sinon');
const { AskPlugin } = require("../../plugins/ask/ask");

// Mock data and functions
let mockClient;
let mockCommand;

test.beforeEach((t) => {
  mockClient = {
    chat: {
      postMessage: sinon.stub().resolves({ ts: "mock_ts" }),
      update: sinon.stub().resolves({}),
    },
    conversations: {
      replies: sinon.stub().resolves({
        messages: [
          { user: "mock_user_1", text: "Say Ping" },
          { user: "mock_user_2", text: "message 2" },
        ]
      }),
    },
  };

  mockCommand = {
    channel_id: "mock_channel",
    user_id: "mock_user_1",
    text: "Say Ping",
  };

  t.context = {
    client: mockClient,
    command: mockCommand,
    thread_ts: "mock_thread_ts",
  };
});

test("AskPlugin handles 'Say Ping' command and sends appropriate response", async (t) => {
    // Mock the API call to return an error
    const mockCohereResponse = Promise.reject(new Error('Request failed with status code 401'));
    sinon.stub(AskPlugin, 'cohereApiCall').returns(mockCohereResponse);
  
    // Call the handle method with the mock data
    await AskPlugin.handle(t.context.command, t.context.client, t.context.thread_ts);
  
    // Verify that postMessage was called with the loading message
    sinon.assert.calledWith(mockClient.chat.postMessage, {
      channel: t.context.command.channel_id,
      thread_ts: t.context.thread_ts,
      text: "Generating response...",
    });
  
    // Verify that the update method was called with the error message
    sinon.assert.calledWith(mockClient.chat.update, {
      channel: t.context.command.channel_id,
      ts: "mock_ts", // The timestamp returned by postMessage
      text: "Sorry, I encountered an error while generating a response. (Error: Request failed with status code 401)"
    });
  
    t.pass(); // Test passes if the above assertions are successful
  });

  test.afterEach(() => {
    // Restore the original function if it was stubbed
    if (AskPlugin.cohereApiCall.restore) {
      AskPlugin.cohereApiCall.restore();
    }
  });
// Add more tests as needed for different scenarios, including error handling