const getMessageStream = () => {
  const configured = (process.env.POSTMARK_MESSAGE_STREAM || "outbound").trim();
  return configured.length > 0 ? configured : "outbound";
};

const decodeBinaryPayload = (payload = {}) => {
  if (payload.type !== "binary" || !payload.data) {
    return "";
  }

  try {
    return Buffer.from(payload.data, "hex").toString("utf8");
  } catch (error) {
    return payload.data;
  }
};

const buildMessageBody = (payload = {}) => {
  const textCandidates = [payload.text, payload.message, decodeBinaryPayload(payload)];
  const primaryText = textCandidates.find(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  const metadataLines = [
    payload.msisdn && `From: ${payload.msisdn}`,
    payload.to && `To: ${payload.to}`,
    payload.type && `Type: ${payload.type}`,
    payload["message-id"] && `Message ID: ${payload["message-id"]}`,
    payload["message-timestamp"] &&
      `Timestamp: ${payload["message-timestamp"]}`,
  ].filter(Boolean);

  const sections = [];

  if (primaryText) {
    sections.push(primaryText.trim());
  }

  if (metadataLines.length > 0) {
    sections.push(["--- SMS Metadata ---", ...metadataLines].join("\n"));
  }

  try {
    const serialized = JSON.stringify(payload, null, 2);
    if (serialized) {
      sections.push(["--- Raw Payload ---", serialized].join("\n"));
    }
  } catch (error) {
    // If serialization fails, skip including the raw payload
  }

  if (sections.length === 0) {
    sections.push("(no text body received)");
  }

  return sections.join("\n\n");
};

const buildSubject = (payload = {}) => {
  const configuredSubject = (process.env.SUBJECT || "").trim();

  if (configuredSubject.length > 0) {
    return configuredSubject;
  }

  const fromNumber = payload.msisdn || payload.from;
  if (fromNumber) {
    return `SMS from ${fromNumber}`;
  }

  return "New SMS message";
};

const buildMetadata = (payload = {}) => {
  const metadata = {
    from_number: payload.msisdn || payload.from,
    to_number: payload.to,
    message_type: payload.type,
    message_id: payload["message-id"] || payload.messageId,
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) =>
      typeof value === "string" && value.trim().length > 0
        ? true
        : value !== undefined && value !== null
    )
  );
};

const smsToEmail = (request) => {
  const replyToEmail = (process.env.REPLY_TO_EMAIL || "").trim() || undefined;
  const fromEmail = (process.env.FROM_EMAIL || "").trim();
  const toEmail = (process.env.TO_EMAIL || "").trim();

  if (!fromEmail || !toEmail) {
    throw new Error(
      "FROM_EMAIL and TO_EMAIL environment variables must be set for smsToEmail transformation"
    );
  }

  const emailDomain = toEmail.replace(/.*@/, "");
  const conversationId = `<omnitext/conversation/1@${emailDomain || "example.com"}>`;

  const textBody = buildMessageBody(request.body || {});
  const metadata = buildMetadata(request.body || {});

  const postmarkSendEmailRequest = {
    From: fromEmail,
    To: toEmail,
    ReplyTo: replyToEmail,
    Subject: buildSubject(request.body || {}),
    TextBody: textBody,
    MessageStream: getMessageStream(),
    Headers: [
      {
        Name: "Message-ID",
        Value: conversationId,
      },
    ],
  };

  if (Object.keys(metadata).length > 0) {
    postmarkSendEmailRequest.Metadata = metadata;
  }

  request.body = postmarkSendEmailRequest;

  return request;
};

addHandler("transform", smsToEmail);

export default smsToEmail;
