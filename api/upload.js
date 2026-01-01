export default async function handler(req, res) {
    // 设置 CORS 响应头
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { base64 } = req.body;
        if (!base64) {
            return res.status(400).json({ message: 'Missing base64 data' });
        }

        // 剔除前缀
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

        // 使用您刚提供的第一个新 Key
        const apiKey = 'bd521134b0e14ad15cf962e2d002544e';

        // 发送到 ImgBB
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ image: cleanBase64 })
        });

        const data = await response.json();

        if (data.success) {
            return res.status(200).json({ success: true, url: data.data.url });
        } else {
            console.error('ImgBB Error:', data);
            return res.status(500).json({ success: false, error: data.error });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
