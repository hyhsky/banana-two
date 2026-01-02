# 速创 AI 图像生成 (Nano Banana Pro) API 调用逻辑说明

本文档详细说明了本项目如何集成速创（WuYinKeJi）提供的 AI 图像生成接口，重点描述了"图生图"和"多图融合"的实现逻辑。

---

## 1. 基础信息

- **接口地址**: `https://api.wuyinkeji.com/api/img/nanoBanana-pro`
- **查询详情地址**: `https://api.wuyinkeji.com/api/img/drawDetail`
- **请求方法**: `POST` (生成任务) / `GET` (轮询状态)
- **请求类型**: `application/json`

---


---

## 3. 图生图与多图融合的关键逻辑

速创 API 的 Nano Banana Pro 模型对输入图片有严格要求：**仅接受公网可访问的图片 URL 数组。**

### 3.1 处理流程 (Pipeline)
1. **压缩**: 前端对用户上传的图片进行等比例压缩，减少带宽占用。
2. **转换**: 将图片转为 Base64 格式。
3. **上传**: 调用 `uploadImage` 函数将 Base64 发往 ImgBB 图床。
4. **提交**: 获取图床直链（如 `https://i.ibb.co/xxx/image.jpg`），组装成数组 `img_url: [url1, url2...]` 发给速创 API。

### 3.2 请求参数示例 (JSON)
```json
{
  "key": "tLdPCRBfuA4nK1Exu9h9lNh2a6",
  "prompt": "将这个人物放在雪地背景中",
  "aspectRatio": "16:9",
  "imageSize": "2K",
  "img_url": ["https://i.ibb.co/60e1b8d33022.jpg"]
}
```

---

## 4. 异步轮询实现

任务提交后，API 会返回一个任务 ID。本项目通过 `pollTaskResult` 函数实现每隔 2 秒一次的自动查询：
- **状态 0/1**: 继续等待（排队或生成中）。
- **状态 2**: 成功，从响应中提取 `image_url` 并展示。
- **状态 3**: 失败，捕获 `fail_reason` 反馈给用户。

---

## 5. 开发建议

- **超时控制**: 由于生成高质量图片需要时间，建议前端接口超时时间设置为 60s 以上。
- **错误处理**: 如果遇到“密钥不正确”，请优先检查 Key 是否已在 `laozhangApi.js` 中更新并执行了网页强刷（Ctrl+F5）。
