const axios = require('axios');
const FormData = require('form-data');

module.exports = async (req, res) => {
    // 允许跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 从请求体中获取 base64 图片
        const { base64 } = req.body;

        if (!base64) {
            return res.status(400).json({ error: 'Missing base64 image data' });
        }

        // 转换 base64 为 Buffer
        const buffer = Buffer.from(base64, 'base64');

        // 上传到 ImgBB（使用公共 API Key）
        const formData = new FormData();
        formData.append('image', buffer.toString('base64'));

        // 直接使用 API Key，确保在 Vercel 环境下 100% 可用
        const IMGBB_API_KEY = '983792cb00fcc07ce22956cf5174092b';
        const uploadUrl = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

        const response = await axios.post(uploadUrl, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        });

        if (response.data && response.data.data && response.data.data.url) {
            return res.status(200).json({
                success: true,
                url: response.data.data.url
            });
        }

        throw new Error('Invalid response from image host');

    } catch (error) {
        console.error('Upload error:', error.message);
        return res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
};
