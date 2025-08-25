# Miaoda - यूनिवर्सल AI सेवा एकत्रीकरण प्लेटफॉर्म

[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md) | **हिन्दी**

## 🚀 अवलोकन

Miaoda एक यूनिवर्सल AI सेवा एकत्रीकरण प्लेटफॉर्म है, जो मूल रूप से Claude Code (claude.ai/code) के लिए डिज़ाइन किया गया था, अब यह एकीकृत इंटरफेस के साथ कई AI सेवा प्रदाताओं का समर्थन करने के लिए अपग्रेड किया गया है। Electron फ्रेमवर्क के साथ निर्मित, यह VSCode-शैली टर्मिनल अनुभव, बुद्धिमान API प्रारूप रूपांतरण, गतिशील रूटिंग और स्थानीय मॉडल समर्थन प्रदान करता है।

## ✨ मुख्य विशेषताएं

### 🤖 मल्टी-सेवा समर्थन
- **क्लाउड सेवाएं**: OpenAI, Claude, Google Gemini, Groq Cloud, Perplexity AI
- **स्थानीय सेवाएं**: Ollama, LM Studio, LocalAI
- **गतिशील रूटिंग**: URL पथ के माध्यम से सेवा और मॉडल निर्दिष्ट करें
- **प्रारूप रूपांतरण**: विभिन्न AI सेवा API प्रारूपों के बीच स्वचालित रूपांतरण

### 💻 टर्मिनल अनुभव
- **VSCode-शैली इंटरफेस**: परिचित विकास वातावरण
- **मल्टी-सत्र प्रबंधन**: एक साथ कई टर्मिनल सत्र संभालें
- **कमांड इतिहास**: localStorage में स्थानीय भंडारण
- **क्रॉस-प्लेटफॉर्म**: macOS और Windows के लिए समर्थन

### 🔧 उन्नत सुविधाएं
- **स्मार्ट विश्लेषण** (v4.2.1): उपयोग ट्रैकिंग और अनुकूलन सुझाव
- **स्वचालित अपडेट** (v4.2.1): साइलेंट इंस्टॉलेशन के साथ बैकग्राउंड अपडेट
- **कॉन्फ़िगरेशन विज़ार्ड**: 4-चरण निर्देशित सेटअप प्रक्रिया
- **टोकन आंकड़े**: रीयल-टाइम टोकन गिनती और लागत गणना
- **त्रुटि हैंडलिंग**: बुद्धिमान त्रुटि पहचान और समाधान संकेत

## 📦 स्थापना

### पूर्व-निर्मित रिलीज़ डाउनलोड करें

[रिलीज़](https://github.com/miounet11/claude-code-manager/releases) से नवीनतम संस्करण डाउनलोड करें:

- **macOS**: `Miaoda-5.0.1.dmg` (यूनिवर्सल - Intel और Apple Silicon)
- **Windows**: `Miaoda-Setup-5.0.1.exe` (x64)

### स्रोत से निर्माण

```bash
# रिपॉजिटरी क्लोन करें
git clone https://github.com/miounet11/claude-code-manager.git
cd claude-code-manager

# निर्भरताएं स्थापित करें
npm install

# विकास मोड
npm run dev

# macOS के लिए निर्माण
npm run build

# Windows के लिए निर्माण
npm run build:windows
```

## 🎯 त्वरित प्रारंभ

### 1. प्रारंभिक सेटअप
1. Miaoda एप्लिकेशन लॉन्च करें
2. 4-चरण कॉन्फ़िगरेशन विज़ार्ड का पालन करें
3. अपनी पसंदीदा AI सेवा कॉन्फ़िगर करें (API कुंजी, एंडपॉइंट)
4. कनेक्शन का परीक्षण करें

### 2. गतिशील रूटिंग का उपयोग
एकीकृत URL के माध्यम से विभिन्न AI सेवाओं तक पहुंचें:

```
http://localhost:8118/proxy/{service}/{model}/v1/chat/completions
```

उदाहरण:
- OpenAI GPT-4: `/proxy/openai/gpt-4/v1/chat/completions`
- Claude Opus: `/proxy/claude/claude-3-opus/v1/messages`
- Ollama Llama2: `/proxy/ollama/llama2/api/chat`

### 3. स्थानीय मॉडल सेटअप
1. स्थानीय सेवा स्थापित करें (Ollama/LM Studio)
2. स्थानीय मॉडल प्रबंधक में कॉन्फ़िगर करें
3. गतिशील रूटिंग के माध्यम से पहुंचें

## 🛠️ विकास

### परियोजना संरचना
```
src/
├── main/                      # मुख्य प्रक्रिया
│   ├── services/              # कोर सेवाएं
│   │   ├── proxy-server.js    # API प्रॉक्सी सर्वर
│   │   ├── service-registry.js # AI सेवा रजिस्ट्री
│   │   └── format-converter.js # API प्रारूप कनवर्टर
│   └── index.js               # एप्लिकेशन प्रवेश
├── renderer/                  # रेंडरर प्रक्रिया
│   ├── components/            # UI घटक
│   └── xterm-terminal.js      # टर्मिनल UI
└── preload/                   # प्रीलोड स्क्रिप्ट
```

### सामान्य कमांड
```bash
# विकास
npm run dev              # विकास मोड में चलाएं
npm run lint            # ESLint जांच
npm run test:core       # कोर परीक्षण चलाएं

# निर्माण
npm run build           # macOS के लिए निर्माण
npm run build:windows   # Windows के लिए निर्माण

# Git Flow
./scripts/git-flow-helper.sh help     # सहायता दिखाएं
./scripts/git-flow-helper.sh feature <name>  # फीचर शाखा बनाएं
./scripts/git-flow-helper.sh release <version> # रिलीज़ शाखा बनाएं
```

## 📝 कॉन्फ़िगरेशन

### कॉन्फ़िगरेशन भंडारण
- **स्थान**: `~/Library/Application Support/miaoda/` (macOS)
- **एन्क्रिप्शन**: electron-store एन्क्रिप्शन का उपयोग
- **बैकअप**: अपडेट से पहले स्वचालित बैकअप

### पर्यावरण चर
```bash
ANTHROPIC_API_URL=http://localhost:8118/proxy
ANTHROPIC_API_KEY=your-api-key
```

## 🔄 संस्करण इतिहास

### v5.0.1 (2025-08-25)
- बहु-भाषा दस्तावेज़ समर्थन
- प्रदर्शन अनुकूलन
- बग फिक्स और स्थिरता सुधार

### v4.2.1 (2024-01-28)
- स्मार्ट विश्लेषण प्रणाली
- स्वचालित अपडेट कार्यक्षमता
- उपयोग पैटर्न के आधार पर प्रदर्शन अनुकूलन

### v4.1.0 (2024-01-25)
- यूनिवर्सल ब्रिज आर्किटेक्चर
- स्थानीय मॉडल समर्थन
- गतिशील रूटिंग प्रणाली

## 🤝 योगदान

योगदान का स्वागत है! कृपया बेझिझक पुल अनुरोध सबमिट करें।

1. रिपॉजिटरी फोर्क करें
2. अपनी फीचर शाखा बनाएं (`git checkout -b feature/AmazingFeature`)
3. अपने परिवर्तनों को कमिट करें (`git commit -m 'Add some AmazingFeature'`)
4. शाखा में पुश करें (`git push origin feature/AmazingFeature`)
5. पुल अनुरोध खोलें

## 📄 लाइसेंस

यह परियोजना MIT लाइसेंस के तहत लाइसेंस प्राप्त है - विवरण के लिए [LICENSE](LICENSE) फ़ाइल देखें।

## 🙏 आभार

- क्रॉस-प्लेटफॉर्म डेस्कटॉप ऐप्स के लिए Electron फ्रेमवर्क
- टर्मिनल एमुलेशन के लिए xterm.js
- उनके APIs के लिए सभी AI सेवा प्रदाता
- निरंतर समर्थन के लिए ओपन-सोर्स समुदाय

## 📞 समर्थन

- **Issues**: [GitHub Issues](https://github.com/miounet11/claude-code-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/miounet11/claude-code-manager/discussions)
- **Email**: support@miaoda.app

---

Miaoda Team द्वारा ❤️ से बनाया गया