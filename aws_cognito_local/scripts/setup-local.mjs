import fs from "fs";
import path from "path";
import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  CreateUserPoolClientCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";

const endpoint = "http://localhost:9229";
const region = "us-east-1";

const client = new CognitoIdentityProviderClient({
  region,
  endpoint,
  credentials: { accessKeyId: "local", secretAccessKey: "local" }
});

const POOL_NAME = "NavBudLocalPool";
const APP_CLIENT_NAME = "NavBudLocalClient";
const TEST_USERNAME = "demo@example.com";
const TEST_PASSWORD = "DemoPass123!";

async function findOrCreateUserPool() {
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const existing = (pools.UserPools || []).find((p) => p.Name === POOL_NAME);
  if (existing?.Id) return existing.Id;

  const created = await client.send(new CreateUserPoolCommand({ PoolName: POOL_NAME }));
  return created.UserPool?.Id;
}

async function findOrCreateAppClient(userPoolId) {
  const list = await client.send(
    new ListUserPoolClientsCommand({ UserPoolId: userPoolId, MaxResults: 60 })
  );

  const existing = (list.UserPoolClients || []).find((c) => c.ClientName === APP_CLIENT_NAME);
  if (existing?.ClientId) return existing.ClientId;

  const created = await client.send(
    new CreateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientName: APP_CLIENT_NAME,
      GenerateSecret: false,
      ExplicitAuthFlows: [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH"
      ]
    })
  );

  return created.UserPoolClient?.ClientId;
}

async function createOrUpdateTestUser(userPoolId) {
  try {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: TEST_USERNAME,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: TEST_USERNAME },
          { Name: "email_verified", Value: "true" }
        ]
      })
    );
  } catch (e) {
    const msg = String(e?.name || e?.message || e);
    if (!msg.includes("UsernameExistsException")) throw e;
  }

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: TEST_USERNAME,
      Password: TEST_PASSWORD,
      Permanent: true
    })
  );
}

async function main() {
  const userPoolId = await findOrCreateUserPool();
  if (!userPoolId) throw new Error("Failed to create or find user pool.");

  const clientId = await findOrCreateAppClient(userPoolId);
  if (!clientId) throw new Error("Failed to create or find app client.");

  await createOrUpdateTestUser(userPoolId);

  const out = {
    endpoint,
    region,
    userPoolId,
    clientId,
    testUser: { username: TEST_USERNAME, password: TEST_PASSWORD }
  };

  fs.writeFileSync(path.join(process.cwd(), "local-config.json"), JSON.stringify(out, null, 2));
  console.log("Created local-config.json");
  console.log("Test login:");
  console.log(TEST_USERNAME);
  console.log(TEST_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
