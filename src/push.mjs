import fs from "fs";
import * as url from "url";
import dotenv from "dotenv";

dotenv.config();

const syncDate = new Date().toISOString();
const fileDir = url.fileURLToPath(new URL(".", import.meta.url));

const syncSmsToEmail = async () => {
  console.log("syncing SMS to Email transformation");

  const smsToEmailTransformationJs =
    `// Last updated: ${syncDate}\n\n${fs.readFileSync(
      `${fileDir}/transformations/vonage-sms-to-postmark-email.mjs`,
      "utf8"
    )}`.replace(/^(export default.*)/m, "// $1");

  const smsToEmailTransformation = {
    name: "vonage-sms-to-postmark-email",
    code: smsToEmailTransformationJs,
    env: {
      REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,
      FROM_EMAIL: process.env.FROM_EMAIL,
      TO_EMAIL: process.env.TO_EMAIL,
      SUBJECT: process.env.SUBJECT,
      POSTMARK_MESSAGE_STREAM: process.env.POSTMARK_MESSAGE_STREAM,
    },
  };

  const createOrUpdateSmsToEmailTransformation = await fetch(
    "https://api.hookdeck.com/2023-07-01/transformations",
    {
      body: JSON.stringify(smsToEmailTransformation),
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HOOKDECK_API_KEY}`,
      },
    }
  );

  if (createOrUpdateSmsToEmailTransformation.status !== 200) {
    console.error(
      "Error creating Vonage SMS to Postmark Email transformation",
      createOrUpdateSmsToEmailTransformation.statusText
    );
    throw new Error("Failed to create transformation");
  }

  const createOrUpdateSmsToEmailTransformationResponse =
    await createOrUpdateSmsToEmailTransformation.json();

  console.log("✅ success");

  console.log("syncing SMS to Email connection");

  const smsToEmailConnection = {
    name: "sms-to-email",
    rules: [
      {
        type: "transform",
        transformation_id: createOrUpdateSmsToEmailTransformationResponse.id,
      },
    ],
    description: null,
    destination: {
      url: "https://api.postmarkapp.com/email",
      name: "outbound-email",
      auth_method: {
        type: "API_KEY",
        config: {
          to: "header",
          key: "X-Postmark-Server-Token",
          api_key: process.env.POSTMARK_SERVER_API_TOKEN,
        },
      },
    },
    source: {
      name: "inbound-sms",
      verification: null,
    },
    full_name: "inbound-sms -> sms-to-email",
  };

  const createOrUpdateSmsToEmailConnection = await fetch(
    "https://api.hookdeck.com/2023-07-01/connections",
    {
      body: JSON.stringify(smsToEmailConnection),
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HOOKDECK_API_KEY}`,
      },
    }
  );

  if (createOrUpdateSmsToEmailConnection.status !== 200) {
    console.error(
      "Error creating SMS to email connection",
      createOrUpdateSmsToEmailConnection.statusText
    );
    throw new Error("Failed to create connection");
  }

  console.log("✅ success");

  return createOrUpdateSmsToEmailConnection.json();
};

const syncEmailToSms = async () => {
  console.log("syncing Email to SMS transformation");

  const emailToSmsTransformationJs =
    `// Last updated: ${syncDate}\n\n${fs.readFileSync(
      `${fileDir}/transformations/postmark-email-to-vonage-sms.mjs`,
      "utf8"
    )}`.replace(/^(export default.*)/m, "// $1");

  const emailToSmsTransformation = {
    name: "postmark-email-to-vonage-sms",
    code: emailToSmsTransformationJs,
    env: {
      TO_NUMBER: process.env.TO_NUMBER,
      FROM_NUMBER: process.env.FROM_NUMBER,
    },
  };

  const createOrUpdateEmailToSmsTransformation = await fetch(
    "https://api.hookdeck.com/2023-07-01/transformations",
    {
      body: JSON.stringify(emailToSmsTransformation),
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HOOKDECK_API_KEY}`,
      },
    }
  );

  if (createOrUpdateEmailToSmsTransformation.status !== 200) {
    console.error(
      "Error creating Postmark email to Vonage SMS transformation",
      createOrUpdateEmailToSmsTransformation.statusText
    );
    throw new Error("Failed to create transformation");
  }

  const createOrUpdateEmailToSmsTransformationResponse =
    await createOrUpdateEmailToSmsTransformation.json();

  console.log("✅ success");

  console.log("syncing Email to SMS connection");

  const emailToSmsConnection = {
    name: "email-to-sms",
    rules: [
      {
        type: "transform",
        transformation_id: createOrUpdateEmailToSmsTransformationResponse.id,
      },
    ],
    destination: {
      url: "https://api.nexmo.com/v1/messages",
      name: "outbound-sms",
      auth_method: {
        type: "BASIC_AUTH",
        config: {
          username: process.env.VONAGE_API_KEY,
          password: process.env.VONAGE_API_SECRET,
        },
      },
    },
    source: {
      name: "inbound-email",
      verification: null, // TODO: add this
    },
    full_name: "inbound-email -> email-to-sms",
  };

  const createOrUpdateEmailToSmsConnection = await fetch(
    "https://api.hookdeck.com/2023-07-01/connections",
    {
      body: JSON.stringify(emailToSmsConnection),
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HOOKDECK_API_KEY}`,
      },
    }
  );

  if (createOrUpdateEmailToSmsConnection.status !== 200) {
    console.error(
      "Error creating email to SMS connection",
      createOrUpdateEmailToSmsConnection.statusText
    );
    throw new Error("Failed to create transformation");
  }

  console.log("✅ success");

  return createOrUpdateEmailToSmsConnection.json();
};

const smsToEmailConnection = await syncSmsToEmail();
const emailToSmsConnection = await syncEmailToSms();

console.log();
console.log(
  `Set your Vonage webhook URL for your phone number to "${smsToEmailConnection.source.url}"`
);
console.log(
  `Set your Postmark webhook URL for your inbound stream to "${emailToSmsConnection.source.url}"`
);
