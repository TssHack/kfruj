const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const winston = require("winston");
const app = express();
const port = 3000;

app.use(express.json());

const url = "https://api.binjie.fun/api/generateStream";
const headers = {
    "authority": "api.binjie.fun",
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://chat18.aichatos.xyz",
    "referer": "https://chat18.aichatos.xyz/",
    "user-agent": "Mozilla/5.0",
    "Content-Type": "application/json"
};

const licenseFilePath = "licenses.json";
const requestLimits = {};
const dailyLimit = 50;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

function loadLicenses() {
    try {
        return JSON.parse(fs.readFileSync(licenseFilePath, "utf8"));
    } catch (error) {
        return {};
    }
}

function saveLicenses(licenses) {
    try {
        fs.writeFileSync(licenseFilePath, JSON.stringify(licenses, null, 2), "utf8");
    } catch (error) {
        console.error("Error saving licenses:", error);
    }
}

function generateRandomUserId() {
    return crypto.randomBytes(8).toString("hex");
}

async function fetchData(query, userId, network = true, withoutContext = false, stream = false) {
    try {
        const data = { prompt: query, userId, network, system: "", withoutContext, stream };
        const response = await axios.post(url, data, { headers, timeout: 10000 });

        console.log("API Response:", response.data);  // بررسی خروجی کامل API

        return response.data.result || response.data;
    } catch (error) {
        console.error("API request failed:", error.response ? error.response.data : error.message);
        return { error: "Failed to fetch response from AI API", details: error.response ? error.response.data : error.message };
    }
}

function checkLicense(key) {
    return loadLicenses()[key] || null;
}

function handleRequestLimit(key) {
    if (!requestLimits[key]) requestLimits[key] = { count: 0, reset: Date.now() };
    if (Date.now() - requestLimits[key].reset > 24 * 60 * 60 * 1000) {
        requestLimits[key] = { count: 0, reset: Date.now() };
    }
    if (requestLimits[key].count >= dailyLimit) return false;
    requestLimits[key].count++;
    return true;
}

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    const licenseKey = req.query.license || req.body.license;
    if (!licenseKey) return res.status(403).json({ error: "Missing license key" });

    const license = checkLicense(licenseKey);
    if (!license) return res.status(403).json({ error: "Invalid license key" });
    if (license.type === "limited" && !handleRequestLimit(licenseKey)) {
        return res.status(429).json({ error: "Daily request limit exceeded" });
    }
    req.licenseType = license.type;
    next();
});

app.get("/ehsan/g", async (req, res) => {
    const { q, userId, network, withoutContext, stream } = req.query;

    console.log("Prompt sent to API:", q);  // بررسی محتوای ارسالی

    const data = await fetchData(q || "Hello, how are you?", userId || generateRandomUserId(), network === "true", withoutContext === "true", stream === "true");
    res.json({ developer: "Ehsan Fazli", developerId: "@abj0o", response: data });
});

app.post("/ehsan/g", async (req, res) => {
    const { q, userId, network, withoutContext, stream } = req.body;
    if (!q) return res.status(400).json({ error: "Missing prompt" });

    const data = await fetchData(q, userId || generateRandomUserId(), network, withoutContext, stream);
    res.json({ developer: "Ehsan Fazli", developerId: "@abj0o", response: data });
});

app.post("/api/license", (req, res) => {
    const { key, type, enabled = true, dailyLimit = 50 } = req.body;
    if (!key || !["limited", "unlimited"].includes(type)) {
        return res.status(400).json({ error: "Invalid key or type" });
    }
    const licenses = loadLicenses();
    licenses[key] = { type, enabled, dailyLimit };
    saveLicenses(licenses);
    res.json({ success: true, message: "License updated successfully" });
});

app.listen(port, () => logger.info(`Server is running on http://localhost:${port}`));
