// 默认的 AI 配置，确保用户开箱即用
const DEFAULT_CONFIGS = [
    {
        id: 'free-claude-trial',
        name: '免费试用（第三方API）',
        apiUrl: 'http://www.miaoda.vip/v1',
        apiKey: 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44',
        model: 'claude-3-7-sonnet-20250219',
        proxy: false,
        proxyPort: 0,
        note: '免费试用，无需配置即可使用',
        isDefault: true,
        isFree: true
    },
    {
        id: 'official-claude',
        name: '官方 Claude',
        apiUrl: 'https://api.anthropic.com',
        apiKey: '',
        model: 'claude-3-7-sonnet-20250219',
        proxy: false,
        proxyPort: 0,
        note: '需要 Anthropic API Key'
    },
    {
        id: 'local-llm',
        name: '本地模型 (Ollama)',
        apiUrl: 'http://localhost:11434',
        apiKey: 'not-required',
        model: 'llama2',
        proxy: false,
        proxyPort: 0,
        note: '需要先安装 Ollama'
    }
];

// 获取推荐配置
function getRecommendedConfig() {
    // 优先返回免费试用配置
    return DEFAULT_CONFIGS.find(config => config.isFree) || DEFAULT_CONFIGS[0];
}

// 初始化默认配置
async function initializeDefaultConfigs() {
    try {
        const existingConfigs = await window.electronAPI.getConfigs();
        
        // 如果没有任何配置，添加默认配置
        if (!existingConfigs || existingConfigs.length === 0) {
            for (const config of DEFAULT_CONFIGS) {
                await window.electronAPI.saveConfig(config);
            }
            
            // 自动选择推荐配置
            const recommended = getRecommendedConfig();
            await window.electronAPI.setConfig('selectedConfigId', recommended.id);
            
            return DEFAULT_CONFIGS;
        }
        
        // 检查是否有可用的配置
        const hasValidConfig = existingConfigs.some(config => 
            config.apiUrl && config.apiKey && config.model
        );
        
        if (!hasValidConfig) {
            // 添加免费试用配置
            const freeConfig = DEFAULT_CONFIGS.find(config => config.isFree);
            if (freeConfig) {
                await window.electronAPI.saveConfig(freeConfig);
            }
        }
        
        return existingConfigs;
    } catch (error) {
        console.error('初始化默认配置失败:', error);
        return [];
    }
}

// 检查配置是否需要设置
function needsConfiguration(config) {
    if (!config) return true;
    
    // 检查必要字段
    if (!config.apiUrl || !config.model) return true;
    
    // 检查 API Key（除了本地模型）
    if (!config.apiUrl.includes('localhost') && !config.apiKey) {
        return true;
    }
    
    // 如果是免费试用配置，不需要设置
    if (config.id === 'free-claude-trial' && config.apiKey === 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44') {
        return false;
    }
    
    // 如果是试用 key，提示需要替换
    if (config.apiKey === 'trial-key-please-replace') {
        return true;
    }
    
    return false;
}

// 获取配置提示信息
function getConfigurationTips(config) {
    const tips = [];
    
    if (!config) {
        tips.push('请选择或创建一个配置');
        return tips;
    }
    
    // 如果是免费试用配置且配置完整，不需要提示
    if (config.id === 'free-claude-trial' && 
        config.apiKey === 'sk-3vxiV5wctLaERpZ6F7ap0Ys4nh0cmE1uK9NNmYg08DcHzQ44' &&
        config.apiUrl && config.model) {
        return tips;
    }
    
    if (!config.apiUrl) {
        tips.push('需要设置 API 地址');
    }
    
    if (!config.apiKey || config.apiKey === 'trial-key-please-replace') {
        if (config.isFree) {
            tips.push('请替换为您的 API Key 以开始使用');
            tips.push('访问 https://console.anthropic.com 获取免费 API Key');
        } else {
            tips.push('需要设置 API Key');
        }
    }
    
    if (!config.model) {
        tips.push('需要选择模型');
    }
    
    return tips;
}

// 导出
window.DEFAULT_CONFIGS = DEFAULT_CONFIGS;
window.initializeDefaultConfigs = initializeDefaultConfigs;
window.needsConfiguration = needsConfiguration;
window.getConfigurationTips = getConfigurationTips;
window.getRecommendedConfig = getRecommendedConfig;