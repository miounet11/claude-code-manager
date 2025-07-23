module.exports = {
  appId: "com.miaoda.app",
  productName: "Miaoda",
  directories: {
    output: "dist"
  },
  files: [
    "src/**/*",
    "assets/**/*",
    "node_modules/**/*"
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: "assets/icon.icns",
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"]
      },
      {
        target: "zip",
        arch: ["x64", "arm64"]
      }
    ]
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64", "ia32"]
      },
      {
        target: "portable",
        arch: ["x64"]
      }
    ],
    icon: "assets/icon.ico"
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Miaoda"
  },
  publish: null  // 禁用自动发布
};