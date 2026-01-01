const https = require('https');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { base64 } = req.body;
        if (!base64) {
            return res.status(400).json({ error: 'Missing base64 data' });
        }

        // 去掉 base64 前缀（如有）
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

        // 直接使用写死的 API Key
        const apiKey = '983792cb00fcc07ce22956cf5174092b';
        const postData = `image=${encodeURIComponent(cleanBase64)}`;

        const options = {
            hostname: 'api.imgbb.com',
            path: `/1/upload?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const imgbbReq = https.request(options, (imgbbRes) => {
            let data = '';
            imgbbRes.on('data', (chunk) => { data += chunk; });
            imgbbRes.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.success) {
                        res.status(200).json({ url: result.data.url });
                    } else {
                        res.status(500).json({ error: 'ImgBB upload failed', details: result });
                    }
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse ImgBB response' });
                }
            });
        });

        imgbbReq.on('error', (e) => {
            res.status(500).json({ error: 'ImgBB request error', message: e.message });
        });

        imgbbReq.write(postData);
        imgbbReq.end();

    } catch (error) {
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}
