import { useState } from 'react';
import { Layers, Download, Loader2, Upload, X } from 'lucide-react';
import { multiFusion, fileToBase64 } from '../api/laozhangApi';
import './MultiFusion.css';

const ASPECT_RATIOS = [
    { value: '1:1', label: '1:1' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '3:2', label: '3:2' },
    { value: '2:3', label: '2:3' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
];

const RESOLUTIONS = [
    { value: '1k', label: '1K' },
    { value: '2k', label: '2K' },
    { value: '4k', label: '4K' },
];

const FUSION_MODES = [
    { value: 'blend', label: '混合', desc: '平滑混合多张图像' },
    { value: 'merge', label: '合并', desc: '保留更多细节' },
    { value: 'combine', label: '组合', desc: '创意组合' },
];

function MultiFusion() {
    const [images, setImages] = useState([]);
    const [prompt, setPrompt] = useState('');
    const [mode, setMode] = useState('blend');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [resolution, setResolution] = useState('2k');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files || []);

        if (images.length + files.length > 4) {
            setError('最多只能上传 4 张图像');
            return;
        }

        files.forEach((file) => {
            if (!file.type.startsWith('image/')) {
                setError('请上传图像文件');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                setImages((prev) => [
                    ...prev,
                    {
                        id: Date.now() + Math.random(),
                        file,
                        preview: e.target.result,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });

        setError(null);
    };

    const removeImage = (id) => {
        setImages((prev) => prev.filter((img) => img.id !== id));
    };

    const handleGenerate = async () => {
        if (images.length < 2) {
            setError('请至少上传 2 张图像');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const imageBase64Array = await Promise.all(
                images.map((img) => fileToBase64(img.file))
            );

            const response = await multiFusion({
                images: imageBase64Array,
                prompt,
                mode,
                aspectRatio,
                resolution,
            });

            if (response.success) {
                setResult(response);
            } else {
                setError(response.error);
            }
        } catch (err) {
            setError('融合失败,请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!result?.imageUrl) return;

        const link = document.createElement('a');
        link.href = result.imageUrl;
        link.download = `banana-ai-fusion-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="multi-fusion">
            <div className="generation-panel glass-card">
                <h2 className="panel-title">
                    <Layers size={24} />
                    多图融合
                </h2>

                {/* 图像上传 */}
                <div className="form-group">
                    <label className="label">上传图像 (2-4 张) *</label>
                    <div className="images-grid">
                        {images.map((img) => (
                            <div key={img.id} className="image-item">
                                <img src={img.preview} alt="Upload" />
                                <button
                                    className="btn-remove"
                                    onClick={() => removeImage(img.id)}
                                    title="移除"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}

                        {images.length < 4 && (
                            <label htmlFor="multi-upload" className="upload-slot">
                                <Upload size={32} />
                                <span>添加图像</span>
                                <input
                                    id="multi-upload"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        )}
                    </div>
                    <p className="helper-text">已上传 {images.length} / 4 张图像</p>
                </div>

                {/* 提示词 */}
                <div className="form-group">
                    <label className="label">提示词(可选)</label>
                    <textarea
                        className="input textarea"
                        placeholder="描述融合后的期望效果,例如:创造一个梦幻般的场景"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                    />
                </div>

                {/* 融合模式 */}
                <div className="form-group">
                    <label className="label">融合模式</label>
                    <div className="mode-grid">
                        {FUSION_MODES.map((m) => (
                            <label key={m.value} className="mode-card">
                                <input
                                    type="radio"
                                    name="mode"
                                    value={m.value}
                                    checked={mode === m.value}
                                    onChange={(e) => setMode(e.target.value)}
                                />
                                <div className={`mode-content ${mode === m.value ? 'active' : ''}`}>
                                    <h4>{m.label}</h4>
                                    <p>{m.desc}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 参数选择 */}
                <div className="params-grid">
                    <div className="form-group">
                        <label className="label">宽高比</label>
                        <div className="radio-group">
                            {ASPECT_RATIOS.map((ratio) => (
                                <label key={ratio.value} className="radio-label">
                                    <input
                                        type="radio"
                                        name="aspectRatio"
                                        value={ratio.value}
                                        checked={aspectRatio === ratio.value}
                                        onChange={(e) => setAspectRatio(e.target.value)}
                                    />
                                    <span className="radio-custom">{ratio.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">分辨率</label>
                        <div className="radio-group">
                            {RESOLUTIONS.map((res) => (
                                <label key={res.value} className="radio-label">
                                    <input
                                        type="radio"
                                        name="resolution"
                                        value={res.value}
                                        checked={resolution === res.value}
                                        onChange={(e) => setResolution(e.target.value)}
                                    />
                                    <span className="radio-custom">{res.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 生成按钮 */}
                <button
                    className="btn btn-primary btn-generate"
                    onClick={handleGenerate}
                    disabled={loading || images.length < 2}
                >
                    {loading ? (
                        <>
                            <Loader2 size={20} className="spinner" />
                            融合中...
                        </>
                    ) : (
                        <>
                            <Layers size={20} />
                            开始融合
                        </>
                    )}
                </button>

                {/* 错误提示 */}
                {error && (
                    <div className="error-message slide-up">
                        ⚠️ {error}
                    </div>
                )}
            </div>

            {/* 结果展示 */}
            {result && (
                <div className="result-panel glass-card fade-in">
                    <div className="result-header">
                        <h3>融合结果</h3>
                        <button className="btn btn-secondary" onClick={handleDownload}>
                            <Download size={18} />
                            下载图像
                        </button>
                    </div>
                    <div className="result-image-container">
                        <img src={result.imageUrl} alt="Fused" className="result-image" />
                    </div>
                    <div className="result-info">
                        <p><strong>融合模式:</strong> {FUSION_MODES.find(m => m.value === mode)?.label}</p>
                        <p><strong>图像数量:</strong> {images.length} 张</p>
                        <p><strong>参数:</strong> {aspectRatio} • {resolution.toUpperCase()}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MultiFusion;
