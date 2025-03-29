const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const winston = require("winston");
const app = express();
const port = 3000;

app.use(express.json());

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' })
    ]
});

const url = "https://api.binjie.fun/api/generateStream";
const headers = {
    "authority": "api.binjie.fun",
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "origin": "https://chat18.aichatos.xyz",
    "referer": "https://chat18.aichatos.xyz/",
    "user-agent": "Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
};

const licenseFilePath = "licenses.json";
const requestLimits = {};
const dailyLimit = 50;

function sanitizeInput(input) {
    return String(input).replace(/[^a-zA-Z0-9 ?!.,]/g, "");
}

function loadLicenses() {
    try {
        return JSON.parse(fs.readFileSync(licenseFilePath, "utf8"));
    } catch (error) {
        logger.error("Error loading licenses", error);
        return {};
    }
}

function saveLicenses(licenses) {
    try {
        fs.writeFileSync(licenseFilePath, JSON.stringify(licenses, null, 2), "utf8");
    } catch (error) {
        logger.error("Error saving licenses", error);
    }
}

function generateRandomUserId() {
    return crypto.randomBytes(8).toString("hex");
}

async function fetchData(query, userId, network = true, withoutContext = false, stream = false) {
    try {
        const data = { prompt: sanitizeInput(query), userId, network, system: "", withoutContext, stream };
        const response = await axios.post(url, data, { headers, timeout: 10000 });
        return response.data;
    } catch (error) {
        logger.error("API request failed", error);
        return { error: "Failed to fetch response from AI API" };
    }
}

function checkLicense(key) {
    return loadLicenses()[key] || null;
}

function handleRequestLimit(key) {
    if (!requestLimits[key]) requestLimits[key] = { count: 0, reset: Date.now(), delay: 0 };
    if (Date.now() - requestLimits[key].reset > 24 * 60 * 60 * 1000) {
        requestLimits[key] = { count: 0, reset: Date.now(), delay: 0 };
    }
    if (requestLimits[key].count >= dailyLimit) {
        requestLimits[key].delay = Math.min(requestLimits[key].delay * 2 || 1000, 60000); 
        setTimeout(() => {}, requestLimits[key].delay); 
        return false;
    }
    requestLimits[key].count++;
    requestLimits[key].delay = 0; 
    return true;
}

app.use((req, res, next) => {
    logger.info(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    const licenseKey = sanitizeInput(req.query.license || req.body.license);
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
