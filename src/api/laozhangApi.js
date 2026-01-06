import axios from 'axios';

/**
 * 🍌 Banana AI - GRSAI API Service
 * 严格按照最新国内直连节点文档实现
 */

// API 配置 - GRSAI 国内直连节点
const API_BASE_URL = 'https://grsai.dakka.com.cn';
// 从环境变量获取 API Key，增强安全性（在 Netlify 后台设置）

const API_ENDPOINT = '/v1/draw/nano-banana'; // Nano Banana 绘画接口
const RESULT_ENDPOINT = '/v1/draw/result';   // 单独轮询结果接口
const MODEL_NAME = 'nano-banana-pro';        // 用户指定的模型

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  timeout: 60000,
});

/**
 * 压缩图片并转为 Base64
 */
export const compressImage = (file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

/**
 * 将图片上传并获取 URL (ImgBB)
 * Note: 文档显示 urls 支持 Base64，但为了稳定性推荐使用 URL
 */
export const uploadImage = async (base64) => {
  try {
    const imgbbKey = 'bd521134b0e14ad15cf962e2d002544e';
    const formData = new FormData();
    formData.append('image', base64.replace(/^data:image\/\w+;base64,/, ""));

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    });

    if (response.data && response.data.success && response.data.data.url) {
      console.log('✅ ImgBB 上传成功:', response.data.data.url);
      return response.data.data.url;
    }
    throw new Error(response.data?.error?.message || '图床返回异常');
  } catch (error) {
    console.error('❌ 上传失败:', error.response?.data || error.message);
    throw new Error('图片上传失败：请检查网络连接');
  }
};

/**
 * 通用生成函数 (适配 GRSAI 最新文档)
 */
const generateContent = async ({ prompt, images = [], aspectRatio, resolution }) => {
  // 分辨率处理: 默认 1K
  const imageSize = resolution ? resolution.toUpperCase() : '1K';

  // 构造请求 Body (严格遵循文档)
  const body = {
    model: MODEL_NAME,
    prompt: prompt,
    aspectRatio: aspectRatio || '1:1',
    imageSize: imageSize,
    webHook: "-1",   // CRITICAL: 填 "-1" 以便立即返回任务 ID 用于轮询
    shutProgress: false
  };

  // 处理参考图
  if (images && images.length > 0) {
    const imageUrls = await Promise.all(images.map(async img => {
      // 如果已经是公网 URL，直接返回
      if (typeof img === 'string' && img.startsWith('http')) return img;
      
      // 如果是 Base64 (带前缀或不带前缀)，直接组合成 API 要求的格式
      // 注意：GRSAI 文档通常支持 data:image/... 格式或纯 base64
      // 这里我们为了兼容性，统一确保它是带 data:image/jpeg;base64, 前缀的格式，或者按文档直接传
      if (typeof img === 'string' && img.startsWith('data:')) {
        return img;
      }
      
      // 如果是纯 Base64 (来自 compressImage)，补充前缀
      return `data:image/jpeg;base64,${img}`;
    }));
    body.urls = imageUrls;
  }

  try {
    // 1. 提交任务
    console.log('🚀 正在提交 GRSAI 任务:', body);
    const response = await apiClient.post(API_ENDPOINT, body);
    const data = response.data;

    // 2. 检查 code 是否为 0 (成功)
    if (data.code === 0 && data.data?.id) {
      const taskId = data.data.id;
      console.log('📝 任务已创建, ID:', taskId);

      // 3. 轮询结果
      const imageUrl = await pollTaskResult(taskId);

      return {
        success: true,
        data: data,
        imageUrl: imageUrl,
      };
    } else {
      throw new Error(data.msg || '提交绘画任务失败');
    }

  } catch (error) {
    console.error('❌ Generation Error (GRSAI):', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.msg || error.message || '生成失败，请检查配置',
    };
  }
};

/**
 * 轮询任务结果 (适配 GRSAI 单独结果接口)
 */
const pollTaskResult = async (taskId, maxAttempts = 60, interval = 3000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // 等待间隔
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, interval));

      // POST /v1/draw/result { "id": "xxxxx" }
      const response = await apiClient.post(RESULT_ENDPOINT, { id: taskId });
      const res = response.data;

      // code: 0 为成功/任务存在, -22 为任务不存在
      if (res.code === 0 && res.data) {
        const taskData = res.data;
        const status = taskData.status;
        const progress = taskData.progress;

        console.log(`⏳ 任务进度: ${progress}%, 状态: ${status}`);

        if (status === 'succeeded') {
          const resultImg = taskData.results?.[0]?.url;
          if (resultImg) return resultImg;
          throw new Error('未获取到生成的图片地址');
        } else if (status === 'failed') {
          const reason = taskData.failure_reason || taskData.error || '图片生成失败';
          throw new Error(`生成失败: ${reason}`);
        }
        // status 为 "running" 时继续轮询
      } else if (res.code !== 0 && res.code !== -22) {
        throw new Error(res.msg || '查询结果异常');
      }

      // 如果 code 为 -22，表示任务可能还在初始化，继续轮询
      if (res.code === -22) {
        console.log('📡 任务初始化中...');
      }

    } catch (error) {
      // 如果是明确的失败（业务失败），不再重试
      if (error.message.startsWith('生成失败:')) throw error;

      if (attempt === maxAttempts - 1) throw error;
      console.warn(`轮询尝试 ${attempt} 异常:`, error.message);
    }
  }
  throw new Error('获取结果超时，请尝试刷新页面重试');
};

/**
 * 文本生成图像
 */
export const textToImage = async ({ prompt, negativePrompt = '', aspectRatio = '1:1', resolution = '1k' }) => {
  const fullPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt;
  return generateContent({ prompt: fullPrompt, images: [], aspectRatio, resolution });
};

/**
 * 图像生成图像 / 多图融合
 */
export const imageToImage = async ({
  images = [],
  prompt,
  strength = 0.75,
  aspectRatio = '1:1',
  resolution = '1k'
}) => {
  return generateContent({
    prompt,
    images: images,
    aspectRatio,
    resolution
  });
};

/**
 * 多图融合
 */
export const multiFusion = async ({
  images,
  prompt = '',
  mode = 'blend',
  aspectRatio = '1:1',
  resolution = '1k'
}) => {
  const fusionPrompt = prompt || `mode: ${mode}`;
  return generateContent({
    prompt: fusionPrompt,
    images: images,
    aspectRatio,
    resolution
  });
};

/**
 * 文件转 Base64
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default {
  textToImage,
  imageToImage,
  multiFusion,
  fileToBase64,
};
