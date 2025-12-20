import express from "express";
import fs from "fs";
import path from "path";
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";  

const app = express();
app.use(express.json());

const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));

function loadConfig() {
  const raw = fs.readFileSync(path.join(process.cwd(), "local-config.json"), "utf8");
  return JSON.parse(raw);
}

function makeCognitoClient(cfg) {
  return new CognitoIdentityProviderClient({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: "local", secretAccessKey: "local" }
  });
}

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Invalid Username or Password" });
    }

    const cfg = loadConfig();
    const cognito = makeCognitoClient(cfg);

    const out = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: cfg.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password
        }
      })
    );

    return res.json(out.AuthenticationResult || {});
  } catch (err) {
    return res.status(401).json({
      error: "Login failed",
      detail: String(err?.message || err)
    });
  }
});

app.post("/api/signup", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: "Missing username or password" });
      }
  
      const cfg = loadConfig();
      const cognito = makeCognitoClient(cfg);
      try {
        await cognito.send(
          new AdminCreateUserCommand({
            UserPoolId: cfg.userPoolId,
            Username: email,
            MessageAction: "SUPPRESS",
            UserAttributes: [
              { Name: "email", Value: email },
              { Name: "email_verified", Value: "true" }
            ]
          })
        );
      } catch (err) {
        const msg = String(err?.name || err?.message || err);
        if (msg.includes("UsernameExistsException")) {
          return res.status(409).json({ error: "User already exists" });
        }
        throw err;
      }
      await cognito.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: cfg.userPoolId,
          Username: email,
          Password: password,
          Permanent: true
        })
      );
      const out = await cognito.send(
        new InitiateAuthCommand({
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: cfg.clientId,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password
          }
        })
      );
  
      return res.json(out.AuthenticationResult || {});
    } catch (err) {
      return res.status(400).json({
        error: "Signup failed",
        detail: String(err?.message || err)
      });
    }
  });  

app.get("/api/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const cfg = loadConfig();
    const cognito = makeCognitoClient(cfg);

    const out = await cognito.send(new GetUserCommand({ AccessToken: token }));
    return res.json(out);
  } catch (err) {
    return res.status(401).json({ error: "Not authorized", detail: String(err?.message || err) });
  }
});

const port = 8000;
app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
