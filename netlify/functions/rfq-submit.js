const https = require("https");

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const TO_EMAIL = "jon@mn-micro.com";
const FROM_EMAIL = "noreply@mn-micro.com";

function sendEmail(payload) {
  return new Promise((resolve, reject) => {
    const {
      firstName, lastName, company, email, phone,
      industry, capability, volume, timeline,
      description, nda, source, files = []
    } = payload;

    const name = `${firstName} ${lastName}`.trim();

    // Build plain text body
    const text = [
      `New RFQ from ${name} at ${company}`,
      ``,
      `Contact`,
      `  Name:    ${name}`,
      `  Email:   ${email}`,
      `  Phone:   ${phone || "—"}`,
      `  Company: ${company}`,
      ``,
      `Project`,
      `  Industry:   ${industry || "—"}`,
      `  Capability: ${capability || "—"}`,
      `  Volume:     ${volume || "—"}`,
      `  Timeline:   ${timeline || "—"}`,
      `  NDA Needed: ${nda === "yes" ? "Yes — send NDA first" : "No"}`,
      ``,
      `Description`,
      `  ${description || "—"}`,
      ``,
      `Source: ${source || "—"}`,
      files.length ? `\nAttachments: ${files.map(f => f.name).join(", ")}` : "",
    ].filter(l => l !== undefined).join("\n");

    // Build HTML body
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e293b;margin:0 0 4px">New RFQ Submission</h2>
  <p style="color:#64748b;margin:0 0 24px;font-size:14px">Received via mn-micro.com</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 12px;font-weight:700;color:#334155">Contact</td></tr>
    <tr><td style="padding:8px 12px;color:#64748b;width:140px">Name</td><td style="padding:8px 12px">${esc(name)}</td></tr>
    <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b">Email</td><td style="padding:8px 12px"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
    <tr><td style="padding:8px 12px;color:#64748b">Phone</td><td style="padding:8px 12px">${esc(phone || "—")}</td></tr>
    <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b">Company</td><td style="padding:8px 12px">${esc(company)}</td></tr>

    <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 12px;font-weight:700;color:#334155">Project Details</td></tr>
    <tr><td style="padding:8px 12px;color:#64748b">Industry</td><td style="padding:8px 12px">${esc(industry || "—")}</td></tr>
    <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b">Capability</td><td style="padding:8px 12px">${esc(capability || "—")}</td></tr>
    <tr><td style="padding:8px 12px;color:#64748b">Annual Volume</td><td style="padding:8px 12px">${esc(volume || "—")}</td></tr>
    <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#64748b">Timeline</td><td style="padding:8px 12px">${esc(timeline || "—")}</td></tr>
    <tr><td style="padding:8px 12px;color:#64748b">NDA Needed</td><td style="padding:8px 12px">${nda === "yes" ? "✅ Yes — send NDA first" : "No"}</td></tr>

    <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 12px;font-weight:700;color:#334155">Description</td></tr>
    <tr><td colspan="2" style="padding:8px 12px">${esc(description || "—")}</td></tr>

    ${files.length ? `
    <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 12px;font-weight:700;color:#334155">Attachments (${files.length})</td></tr>
    <tr><td colspan="2" style="padding:8px 12px">${files.map(f => esc(f.name)).join("<br>")}</td></tr>
    ` : ""}

    <tr style="background:#f1f5f9"><td colspan="2" style="padding:10px 12px;font-weight:700;color:#334155">Source</td></tr>
    <tr><td colspan="2" style="padding:8px 12px;color:#64748b;font-size:13px">${esc(source || "—")}</td></tr>
  </table>
</div>`;

    // Build attachments array for SendGrid
    const attachments = files.map(f => ({
      content: f.base64,
      filename: f.name,
      type: f.mimeType || "application/octet-stream",
      disposition: "attachment",
    }));

    const body = JSON.stringify({
      personalizations: [{ to: [{ email: TO_EMAIL, name: "Jon Baklund" }] }],
      from: { email: FROM_EMAIL, name: "M5 Micro Website" },
      reply_to: { email, name },
      subject: `New RFQ: ${company} — ${capability || industry || "General Inquiry"}`,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      ...(attachments.length ? { attachments } : {}),
    });

    const req = https.request(
      {
        hostname: "api.sendgrid.com",
        path: "/v3/mail/send",
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      res => {
        let data = "";
        res.on("data", d => (data += d));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true });
          } else {
            reject(new Error(`SendGrid ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };
  }

  if (!SENDGRID_KEY) {
    console.error("SENDGRID_API_KEY not set");
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server configuration error" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!payload.email || !payload.firstName || !payload.company) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  try {
    await sendEmail(payload);
    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    console.error("Email send error:", e.message);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to send email" }),
    };
  }
};
