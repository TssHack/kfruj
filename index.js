const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
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
    "user-agent": "Mozilla/5.0 (Windows NT 6.3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
};

const licenseFilePath = "licenses.json";
const requestLimits = {};
const dailyLimit = 50;

function loadLicenses() {
    try {
        const data = fs.readFileSync(licenseFilePath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading licenses:", error);
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

async function fetchData(query, userId, network, withoutContext, stream) {
    try {
        const data = {
            prompt: query,
            userId: userId || generateRandomUserId(),
            network: network !== undefined ? network : true,
            system: "",
            withoutContext: withoutContext !== undefined ? withoutContext : false,
            stream: stream !== undefined ? stream : false
        };

        const response = await axios.post(url, data, { headers, timeout: 10000 });
        return response.data;
    } catch (error) {
        return { error: error.message };
    }
}

function checkLicense(key) {
    const licenses = loadLicenses();
    return licenses[key] || null;
}

function handleRequestLimit(key) {
    if (!requestLimits[key]) {
        requestLimits[key] = { count: 0, reset: Date.now() };
    }
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - requestLimits[key].reset;
    
    if (elapsedTime > 24 * 60 * 60 * 1000) {
        requestLimits[key] = { count: 0, reset: currentTime };
    }
    
    if (requestLimits[key].count >= dailyLimit) {
        return false;
    }
    
    requestLimits[key].count++;
    return true;
}

app.use((req, res, next) => {
    const licenseKey = req.headers["x-api-key"];
    const license = checkLicense(licenseKey);

    if (!license) {
        return res.status(403).json({ error: "Invalid or missing API key" });
    }
    if (license.type === "limited" && !handleRequestLimit(licenseKey)) {
        return res.status(429).json({ error: "Daily request limit exceeded" });
    }
    req.licenseType = license.type;
    next();
});

app.get("/ehsan/g", async (req, res) => {
    const query = req.query.q || "Hello, how are you?";
    const userId = req.query.userId || generateRandomUserId();
    const network = req.query.network ? req.query.network === "true" : true;
    const withoutContext = req.query.withoutContext ? req.query.withoutContext === "true" : false;
    const stream = req.query.stream ? req.query.stream === "true" : false;

    const data = await fetchData(query, userId, network, withoutContext, stream);
    res.json({
        developer: "Ehsan Fazli",
        developerId: "@abj0o",
        response: data
    });
});

app.post("/ehsan/g", async (req, res) => {
    const { q, userId, network, withoutContext, stream } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
    }
    
    const data = await fetchData(q, userId, network, withoutContext, stream);
    res.json({
        developer: "Ehsan Fazli",
        developerId: "@abj0o",
        response: data
    });
});

app.post("/ehsan/license", (req, res) => {
    const { key, type, enabled, dailyLimit } = req.body;
    if (!key || !type) {
        return res.status(400).json({ error: "Missing key or type" });
    }
    
    const licenses = loadLicenses();
    licenses[key] = { type, enabled: enabled !== undefined ? enabled : true, dailyLimit: dailyLimit || 50 };
    saveLicenses(licenses);
    res.json({ success: true, message: "License updated successfully" });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
