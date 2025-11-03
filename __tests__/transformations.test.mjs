import emailToSms from "../src/transformations/postmark-email-to-vonage-sms.mjs";
import smsToEmail from "../src/transformations/vonage-sms-to-postmark-email.mjs";

const resetEnvVars = () => {
  process.env.REPLY_TO_EMAIL = "reply-to@example.test";
  process.env.FROM_EMAIL = "from@example.test";
  process.env.TO_EMAIL = "to@example.test";
  process.env.TO_NUMBER = "447700900000";
  process.env.FROM_NUMBER = "447700900001";
  process.env.SUBJECT = "A great conversation!";
  process.env.POSTMARK_MESSAGE_STREAM = "outbound";
};

beforeEach(resetEnvVars);

describe("Hookdeck addHandler", () => {
  test("transformations call addHandler", () => {
    expect(global.addHandlerCallCount).toBe(2);
  });
});

describe("Email to SMS", () => {
  const emailTextValue = "hello from email";

  const inboundEmailWebhookRequest = {
    body: {
      StrippedTextReply: emailTextValue,
    },
    headers: {},
  };

  test("emailToSms transformation to have expected structure", () => {
    const transformedRequest = emailToSms(inboundEmailWebhookRequest, {});

    const expectedSmsRequest = {
      body: {
        channel: "sms",
        from: process.env.FROM_NUMBER,
        message_type: "text",
        text: emailTextValue,
        to: process.env.TO_NUMBER,
      },
      headers: {},
    };

    expect(transformedRequest).toEqual(expectedSmsRequest);
  });
});

describe("SMS to Email", () => {
  const smsTextValue = "hello from SMS";

  const inboundSmsWebhookRequest = {
    headers: {},
    body: {
      text: smsTextValue,
      msisdn: "447700900002",
      to: "447700900003",
      type: "text",
      "message-id": "some-message-id",
      "message-timestamp": "2024-03-30 16:00:00",
    },
  };

  test("smsToEmail transformation to have expected structure", () => {
    const transformedRequest = smsToEmail(inboundSmsWebhookRequest, {});

    expect(transformedRequest.body.TextBody.startsWith(smsTextValue)).toBe(
      true
    );
    expect(transformedRequest.body.TextBody).toContain("--- SMS Metadata ---");
    expect(transformedRequest.body.TextBody).toContain(
      '"text": "hello from SMS"'
    );
    expect(transformedRequest.body.MessageStream).toEqual("outbound");
    expect(transformedRequest.body.Subject).toEqual(process.env.SUBJECT);
    expect(transformedRequest.body.Headers.length).toEqual(1);
    expect(transformedRequest.body.Metadata).toEqual({
      from_number: "447700900002",
      to_number: "447700900003",
      message_type: "text",
      message_id: "some-message-id",
    });
  });

  test("smsToEmail transformation header has default example.com domain", () => {
    process.env.TO_EMAIL = "user@";

    const transformedRequest = smsToEmail(inboundSmsWebhookRequest, {});

    const messageIdHeader = transformedRequest.body.Headers[0];
    expect(messageIdHeader.Value).toEqual(
      "<omnitext/conversation/1@example.com>"
    );
  });

  test("smsToEmail transformation decodes binary payload when text not present", () => {
    const binaryPayload = {
      headers: {},
      body: {
        type: "binary",
        data: Buffer.from("123456", "utf8").toString("hex"),
        msisdn: "447700900004",
      },
    };

    process.env.SUBJECT = "";

    const transformedRequest = smsToEmail(binaryPayload, {});

    expect(transformedRequest.body.Subject).toEqual("SMS from 447700900004");
    expect(transformedRequest.body.TextBody).toContain("123456");
  });
});
